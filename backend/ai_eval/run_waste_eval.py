"""Opt-in evaluation of the existing consent-gated Gemini waste classifier."""

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from app.ai.image import prepare_photo
from app.ai.waste import SIZES, GeminiWasteClassifier, waste_prompt_contract
from app.config import settings
from app.recycling_schemas import MATERIAL_IDS

from .metrics import canonical_prompt_hash, is_timeout_error, waste_metrics

PROMPT_HASH = canonical_prompt_hash(waste_prompt_contract())


def load_manifest(path: Path) -> list[dict]:
    cases = [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]
    if not 1 <= len(cases) <= 20:
        raise ValueError("manifest needs 1..20 cases")
    for case in cases:
        expected = case.get("expected")
        if (
            case.get("consent") is not True
            or not isinstance(case.get("asset"), str)
            or not isinstance(expected, dict)
            or not isinstance(expected.get("materials"), list)
            or any(material not in MATERIAL_IDS for material in expected["materials"])
            or expected.get("size") not in SIZES
        ):
            raise ValueError("each case needs consent, a local asset, known expected materials, and a valid size")
    return cases


async def evaluate(cases: list[dict]) -> dict:
    if not settings.gemini_api_key or not settings.gemini_photo_analysis_enabled:
        raise RuntimeError("blocked: configured Gemini credentials and photo-analysis enablement are required")
    classifier = GeminiWasteClassifier(settings.gemini_api_key, settings.gemini_model)
    prepared = []
    for case in cases:
        prepared.append((case, prepare_photo(Path(case["asset"]).read_bytes())))
    expected, predicted = [], []
    provider_calls = provider_errors = timeouts = fallbacks = 0
    for case, asset in prepared:
        provider_calls += 1
        try:
            output = await asyncio.wait_for(classifier.classify(asset), timeout=5.0)
            if output.get("source") == "fallback":
                fallbacks += 1
                continue
            predicted.append(
                {"materials": [item["materialId"] for item in output["materials"]], "size": output["size"]}
            )
            expected.append(case["expected"])
        except Exception as error:
            if is_timeout_error(error):
                timeouts += 1
            else:
                provider_errors += 1
    report = {
        "model": settings.gemini_model,
        "promptHash": PROMPT_HASH,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "providerCalls": provider_calls,
        "providerErrors": provider_errors,
        "timeouts": timeouts,
        "fallbacks": fallbacks,
        "metrics": waste_metrics(expected, predicted) if expected else None,
    }
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    if not args.live:
        raise SystemExit("blocked: pass --live to permit bounded Gemini calls")
    try:
        cases = load_manifest(args.manifest)
        result = asyncio.run(evaluate(cases))
    except RuntimeError as error:
        raise SystemExit(str(error)) from error
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    if result["providerErrors"] or result["timeouts"] or result["fallbacks"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
