"""Run the Arabic triage smoke corpus and report quality metrics."""

import argparse
import asyncio
import json
import math
import statistics
import time
from pathlib import Path
from typing import Any

from app.ai.llm import GeminiClient
from app.ai.schemas import CategoryId, Severity, TriageSuggestion
from app.ai.triage import analyze_report

DATASET = Path(__file__).parent / "dataset" / "triage.jsonl"


def load_cases(path: Path = DATASET) -> list[dict[str, str]]:
    cases = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        try:
            case = json.loads(line)
        except json.JSONDecodeError as error:
            raise ValueError(f"Invalid JSON on line {line_number}: {error.msg}") from error
        if not isinstance(case, dict) or not all(
            isinstance(case.get(key), str) and case[key].strip() for key in ("description", "categoryId", "severity")
        ):
            raise ValueError(f"Line {line_number} needs description, categoryId, and severity")
        try:
            CategoryId(case["categoryId"])
            Severity(case["severity"])
        except ValueError as error:
            raise ValueError(f"Line {line_number} has an unknown category or severity") from error
        cases.append(case)
    if not cases:
        raise ValueError(f"No evaluation cases found in {path}")
    return cases


def score_cases(cases: list[dict[str, str]], predictions: list[TriageSuggestion]) -> dict[str, Any]:
    if len(cases) != len(predictions) or not cases:
        raise ValueError("Cases and predictions must have the same non-zero length")
    top1 = 0
    top3 = 0
    severity = 0
    fallback = 0
    for case, prediction in zip(cases, predictions, strict=True):
        ranked = [option.category_id.value for option in prediction.options]
        top1 += ranked[0] == case["categoryId"]
        top3 += case["categoryId"] in ranked[:3]
        severity += prediction.severity.value == case["severity"]
        fallback += prediction.source == "fallback"
    count = len(cases)
    return {
        "samples": count,
        "top1Accuracy": top1 / count,
        "top3Accuracy": top3 / count,
        "severityAgreement": severity / count,
        "fallbackRate": fallback / count,
    }


def percentile(values: list[float], percent: float) -> float:
    if not values:
        return 0
    ordered = sorted(values)
    index = max(0, math.ceil(percent / 100 * len(ordered)) - 1)
    return ordered[index]


async def run(cases: list[dict[str, str]], use_model: bool) -> dict[str, Any]:
    provider = GeminiClient.from_env() if use_model else None
    if use_model and provider is None:
        raise RuntimeError("Set GEMINI_API_KEY before running with --model")
    predictions = []
    latencies = []
    for case in cases:
        started = time.perf_counter()
        result = await analyze_report(
            provider,
            case["description"],
            timeout_seconds=5.0,
        )
        latencies.append((time.perf_counter() - started) * 1000)
        predictions.append(result)
    scores = score_cases(cases, predictions)
    scores["latencyMs"] = {
        "p50": round(statistics.median(latencies), 1),
        "p95": round(percentile(latencies, 95), 1),
    }
    scores["mode"] = "gemini" if use_model else "keyword-fallback"
    return scores


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", action="store_true", help="Call Gemini using GEMINI_API_KEY")
    parser.add_argument("--dataset", type=Path, default=DATASET)
    args = parser.parse_args()
    report = asyncio.run(run(load_cases(args.dataset), args.model))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
