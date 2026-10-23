from ai_eval.metrics import normalize_arabic, transcription_metrics, waste_metrics


def test_waste_metrics_score_material_macro_f1_and_size_accuracy():
    result = waste_metrics([{"materials": ["glass"], "size": "small"}], [{"materials": ["glass"], "size": "small"}])
    assert result["samples"] == 1
    assert result["macroF1"] > 0
    assert result["sizeAccuracy"] == 1


def test_transcription_metrics_normalize_arabic_and_handle_empty_reference():
    assert normalize_arabic("إِنْسَانـٌ") == "انسان"
    assert transcription_metrics([""], ["x"])["wer"] == 1
    assert transcription_metrics(["البيت"], ["البيت"])["cer"] == 0


def test_eval_cli_refuses_network_without_live_even_before_manifest_read(monkeypatch):
    import sys

    import pytest

    from ai_eval import run_transcription_eval

    monkeypatch.setattr(
        sys, "argv", ["run_transcription_eval", "--manifest", "/does/not/exist", "--output", "/tmp/report.json"]
    )
    with pytest.raises(SystemExit, match="pass --live"):
        run_transcription_eval.main()


def test_live_evaluation_reports_missing_credentials_without_calls(monkeypatch):
    import asyncio

    import pytest

    from ai_eval import run_transcription_eval
    from app.config import settings

    monkeypatch.setattr(settings, "gemini_api_key", "")
    with pytest.raises(RuntimeError, match="blocked: configured Gemini credentials"):
        asyncio.run(run_transcription_eval.evaluate([{"asset": "/unused", "mimeType": "audio/mp4", "reference": ""}]))


def test_timeout_classification_includes_wrapped_http_provider_timeouts():
    import httpx

    from ai_eval.metrics import is_timeout_error
    from app.ai.schemas import ProviderError

    wrapped = ProviderError("provider failed")
    wrapped.__cause__ = httpx.ReadTimeout("provider deadline")
    assert is_timeout_error(wrapped)


def test_waste_eval_reports_success_timeout_error_fallback_and_prompt_hash(monkeypatch, tmp_path):
    import asyncio
    import json

    from ai_eval import run_waste_eval
    from ai_eval.metrics import canonical_prompt_hash
    from app.ai.waste import waste_prompt_contract
    from app.config import settings

    assets = []
    for index in range(4):
        path = tmp_path / f"fixture-{index}.jpg"
        path.write_bytes(b"synthetic")
        assets.append(str(path))
    monkeypatch.setattr(settings, "gemini_api_key", "local-test-key")
    monkeypatch.setattr(settings, "gemini_photo_analysis_enabled", True)
    monkeypatch.setattr(run_waste_eval, "prepare_photo", lambda data: data)

    class FakeClassifier:
        def __init__(self, *args, **kwargs):
            self.index = 0

        async def classify(self, image):
            self.index += 1
            if self.index == 2:
                raise TimeoutError
            if self.index == 3:
                raise ValueError("private error detail")
            if self.index == 4:
                return {"materials": [], "size": "medium", "source": "fallback"}
            return {"materials": [{"materialId": "glass"}], "size": "small"}

    monkeypatch.setattr(run_waste_eval, "GeminiWasteClassifier", FakeClassifier)
    cases = [{"asset": path, "expected": {"materials": ["glass"], "size": "small"}} for path in assets]
    report = asyncio.run(run_waste_eval.evaluate(cases))
    assert report["providerCalls"] == 4
    assert report["timeouts"] == report["providerErrors"] == report["fallbacks"] == 1
    assert report["metrics"]["samples"] == 1
    assert report["metrics"]["sizeAccuracy"] == 1
    assert report["promptHash"] == canonical_prompt_hash(waste_prompt_contract())
    safe_json = json.dumps(report)
    assert "fixture-" not in safe_json and "private error detail" not in safe_json


def test_transcription_eval_reports_success_wrapped_timeout_and_sanitized_metrics(monkeypatch, tmp_path):
    import asyncio
    from types import SimpleNamespace

    import httpx

    from ai_eval import run_transcription_eval
    from ai_eval.metrics import canonical_prompt_hash
    from app.ai.schemas import ProviderError
    from app.ai.transcribe import transcription_prompt_contract
    from app.config import settings

    path = tmp_path / "local-audio.m4a"
    path.write_bytes(b"synthetic audio")
    monkeypatch.setattr(settings, "gemini_api_key", "local-test-key")
    monkeypatch.setattr(
        run_transcription_eval, "inspect_audio", lambda *args: SimpleNamespace(duration_seconds=1, peak_dbfs=-10)
    )

    class FakeTranscriber:
        def __init__(self, *args, **kwargs):
            self.calls = 0

        async def transcribe(self, audio, mime):
            self.calls += 1
            if self.calls == 2:
                error = ProviderError("provider failed")
                error.__cause__ = httpx.ReadTimeout("private provider details")
                raise error
            return SimpleNamespace(text="البيت")

    monkeypatch.setattr(run_transcription_eval, "GeminiAudioTranscriber", FakeTranscriber)
    cases = [{"asset": str(path), "mimeType": "audio/mp4", "reference": "البيت"} for _ in range(2)]
    report = asyncio.run(run_transcription_eval.evaluate(cases))
    assert report["providerCalls"] == 2
    assert report["timeouts"] == 1 and report["providerErrors"] == report["fallbacks"] == 0
    assert report["metrics"] == {"samples": 1, "wer": 0.0, "cer": 0.0}
    assert report["promptHash"] == canonical_prompt_hash(transcription_prompt_contract())
    assert "local-audio" not in str(report) and "private provider details" not in str(report)


def test_eval_manifests_require_consent_and_enforce_twenty_case_limit(tmp_path):
    import json

    import pytest

    from ai_eval.run_waste_eval import load_manifest

    path = tmp_path / "waste.jsonl"
    valid = {"consent": True, "asset": "/local/fixture.jpg", "expected": {"materials": ["glass"], "size": "small"}}
    path.write_text("\n".join(json.dumps(valid) for _ in range(21)), encoding="utf-8")
    with pytest.raises(ValueError, match="1..20"):
        load_manifest(path)
    path.write_text(json.dumps(valid | {"consent": False}), encoding="utf-8")
    with pytest.raises(ValueError, match="consent"):
        load_manifest(path)
