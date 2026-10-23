# CityFix AI evaluation

## Triage smoke corpus

From `backend/`, run the deterministic keyword baseline with:

```bash
python -m ai_eval.run_eval
```

The checked-in 33-case corpus contains synthetic Egyptian Arabic text only. It is a smoke set for category ranking and severity behavior, not a representative accuracy benchmark. It has no photos, real citizen reports, or independent human review. Do not use its score to claim production accuracy or to enable photo analysis.

The recorded local keyword-baseline results are:

| Metric | Result |
| --- | ---: |
| Top-1 category | 90.9% |
| Top-3 category | 100% |
| Severity agreement | 87.9% |
| Fallback responses | 100% |

Latency values measure the local deterministic classifier and do not predict hosted-model latency. An explicit `--model` run sends the synthetic descriptions to Google and consumes the configured Gemini quota:

```bash
python -m ai_eval.run_eval --model
```

Before using evaluation results for a release decision, add consented, de-identified, human-labeled data with representative Egyptian Arabic and photos, then report its source and limitations.

## Waste classification and transcription

The waste-classifier and voice-transcription harnesses call the existing Gemini implementations only when explicitly opted in. No fixtures or provider results are included in this change.

Create a local JSONL manifest with 1–20 consented cases. Waste entries use `{"consent":true,"asset":"/local/path/photo.jpg","expected":{"materials":["glass"],"size":"small"}}`. Transcription entries use `{"consent":true,"asset":"/local/path/audio.m4a","mimeType":"audio/mp4","reference":"..."}`. Example metadata is in `waste.example.jsonl` and `transcription.example.jsonl`; those paths are placeholders. Keep raw media and transcripts private. Output contains only aggregate metrics, model, timestamp, canonical prompt hash, call count, and error/timeout/fallback count.

From `backend/`, install the development requirements (which include OR-Tools for solver regression coverage), then run the harnesses with `--live` to permit bounded provider calls:

```bash
python -m ai_eval.run_waste_eval --live --manifest /local/waste.jsonl --output /local/waste-result.json
python -m ai_eval.run_transcription_eval --live --manifest /local/audio.jsonl --output /local/audio-result.json
```

Without `--live`, they stop before reading assets or making a request. Missing credentials or disabled photo analysis yields an explicit blocked status. Provider failures count separately and return a nonzero exit. Arabic transcription metrics normalize Unicode, remove tatweel and harakat, map alef variants to alef, and collapse whitespace before token WER and codepoint CER. Empty references score 0 only for empty hypotheses, otherwise 1. Waste macro F1 averages over the fixed `MATERIAL_IDS` list with zero-division set to 0; pile-size accuracy is separate.

No live Gemini run was possible in this environment: Gemini credentials and permitted consented media fixtures are not configured. No quality score is claimed. The actual prompt and generation schema are hashed from the shared production request builders. Prompt changes remain deferred until a baseline and candidate are measured on the same reviewed fixtures.
