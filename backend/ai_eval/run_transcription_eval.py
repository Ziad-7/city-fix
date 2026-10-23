"""Opt-in evaluation of the existing Gemini Egyptian Arabic transcriber."""

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from app.ai.transcribe import (
    FFMPEG_TIMEOUT_SECONDS,
    MAX_TRANSCRIPTION_AUDIO_BYTES,
    MAX_TRANSCRIPTION_DURATION_SECONDS,
    SILENCE_PEAK_DBFS,
    GeminiAudioTranscriber,
    inspect_audio,
    transcription_prompt_contract,
)
from app.config import settings

from .metrics import canonical_prompt_hash, is_timeout_error, transcription_metrics

PROMPT_HASH = canonical_prompt_hash(transcription_prompt_contract())


def load_manifest(path: Path) -> list[dict]:
    cases = [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    ]
    supported_mimes = {"audio/mp4", "audio/mpeg", "audio/webm", "audio/ogg"}
    if not 1 <= len(cases) <= 20:
        raise ValueError("manifest needs 1..20 cases")
    if any(
        c.get("consent") is not True
        or not isinstance(c.get("asset"), str)
        or c.get("mimeType") not in supported_mimes
        or not isinstance(c.get("reference"), str)
        for c in cases
    ):
        raise ValueError("each case needs consent, a local audio asset, supported MIME type, and reference text")
    return cases


async def evaluate(cases: list[dict]) -> dict:
    if not settings.gemini_api_key:
        raise RuntimeError("blocked: configured Gemini credentials are required")
    transcriber = GeminiAudioTranscriber(settings.gemini_api_key, settings.gemini_model)
    prepared = []
    for case in cases:
        audio = Path(case["asset"]).read_bytes()
        if len(audio) > MAX_TRANSCRIPTION_AUDIO_BYTES:
            raise ValueError("audio exceeds the application size limit")
        analysis = await asyncio.wait_for(
            asyncio.to_thread(inspect_audio, audio, case["mimeType"]), timeout=FFMPEG_TIMEOUT_SECONDS + 0.5
        )
        if analysis.duration_seconds > MAX_TRANSCRIPTION_DURATION_SECONDS or analysis.peak_dbfs <= SILENCE_PEAK_DBFS:
            raise ValueError("audio exceeds the duration limit or is too quiet")
        prepared.append((case, audio))
    references, hypotheses = [], []
    provider_calls = provider_errors = timeouts = fallbacks = 0
    for case, audio in prepared:
        provider_calls += 1
        try:
            result = await asyncio.wait_for(transcriber.transcribe(audio, case["mimeType"]), timeout=6.0)
            if getattr(result, "source", None) == "fallback":
                fallbacks += 1
                continue
            references.append(case["reference"])
            hypotheses.append(result.text)
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
        "metrics": transcription_metrics(references, hypotheses) if references else None,
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
