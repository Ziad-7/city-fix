# CityBrain AI status

**Status snapshot:** 2026-10-22 · **Current implementation branch:** `feat/ai-silence-validation`

This page describes what is actually in the repository today. The broader [free hosted implementation plan](superpowers/plans/2026-10-22-citybrain-free-hosted.md) is a proposal and its task checkboxes have not been maintained as a progress tracker. Do not treat its proposed providers, schedules, or unchecked items as the current implementation.

## Implemented

- **Report triage:** authenticated `POST /triage` uses Gemini for structured suggestions when configured, with deterministic Arabic/English keyword fallback on provider failure or timeout. It adds emergency metadata and nearby duplicate/already-reported matches; it does not automatically change a report.
- **Photo input safeguards:** consent and caller-owned private media are required; images are normalized, metadata is removed, size/dimensions are bounded, and face/plate regions are blurred before inference. Photo analysis is **disabled by default** until privacy validation passes. The bundled Russian-plate cascade is not validated for Egyptian plates.
- **Voice transcription:** authenticated `POST /ai/transcribe` reads only caller-owned private media and uses Gemini audio transcription (not Groq/Whisper). Recordings are limited to 5 MB and 30 seconds; FFmpeg measures decoded frames in a bounded pass, supporting streamed WebM without duration metadata and ignoring forged container durations, and rejects invalid or near-silent audio before the provider call. The stored recording is not modified by validation.
- **Client integration:** mobile and citizen web have API adapters, request timeouts, local keyword fallback on triage network/API failures, and editable voice transcription flows. Photo analysis requires explicit consent. Both clients continue to support mock mode.
- **Admin helpers:** budget optimization uses deterministic 0/1 knapsack logic; weekly insights use database-derived deterministic summaries. These features do not depend on a generative model.
- **Evaluation and tests:** a 33-example synthetic Arabic text triage smoke set and backend AI tests are present. The corpus is not a representative accuracy benchmark and contains no photos or real citizen data.

## Remaining work, in recommended order

1. **Complete privacy validation before enabling photos.** Gather consented, staged Egyptian face/plate images outside Git, annotate and hold out a test set, measure misses and false positives, and pass the zero-miss gate in [`backend/ai_tests/PHOTO_PRIVACY_VALIDATION.md`](../backend/ai_tests/PHOTO_PRIVACY_VALIDATION.md). If the current detector misses any region, retain the disabled-by-default behavior and choose a safer flow or detector.
2. **Add deployment-grade abuse and quota controls.** Replace the local single-worker staff login limiter with shared request limits for AI endpoints, set provider/project ceilings and monitoring, and define behavior when free quotas are exhausted. The API currently has no shared per-user AI rate limiter.
3. **Evaluate provider behavior with sanitized live samples.** Confirm the current Gemini model name and free-tier quota on the actual project, then test safe consented photo examples and Egyptian Arabic recordings. Measure transcription quality, provider errors/429s, latency, and preserve the manual-entry/fallback experience. No live provider key or quota validation is recorded here.
4. **Build representative held-out quality sets.** Add consented, de-identified Arabic reports across the 12 categories with human-reviewed labels and photos, and Egyptian Arabic voice clips with human transcripts. Keep development and held-out sets separate; publish category-level triage, emergency, and transcription metrics with sample counts. Existing synthetic text scores must not be presented as production accuracy.
5. **Finish production backend and media integration.** The checked-in app is a local SQLite/demo assembly. Production PostgreSQL migrations, persistent citizen repositories, private Supabase media provisioning/policies, real OTP, production secrets/CORS, and deployed API integration remain separate backend tasks. Verify that both clients can use the full deployed API, not only the AI routes.
6. **Run end-to-end online deployment checks.** Deploy only on eligible free tiers, with paid billing disabled; check authentication, private uploads, photo consent/redaction, triage fallback, voice transcription, budget authorization, sleep/cold-start behavior, and recovery from provider quota exhaustion. Record the actual service URLs and measured free-tier limits.
7. **Close remaining evaluation and demo documentation.** Record measured warm/cold latency, memory, fallback rates, model versions, consent/source of evaluation data, known failure cases, and reproducible demo steps in the evaluation README and progress log.

## Free-hosting constraint

A $0 hosted demo is possible only while each provider stays within its free quotas and terms. It cannot promise unlimited inference, always-on availability, or consistent cold-start latency. Do not send confidential citizen content to a free provider unless its current data-use terms and the project's consent policy permit it. See the implementation plan's hosting table for the proposed services; verify their terms and limits at deployment time.

## Out of scope

OCR is not implemented and is intentionally excluded: the user previously declined adding it. Optional OCR, semantic similarity ranking, and automatic production privacy processing should not be treated as completed work.

## Verification recorded for this branch

The latest AI validation run recorded **53 passed, 1 skipped** for `python -m pytest ai_tests -q`; Ruff, Python compile checks, and `git diff --check` also passed. The skipped test requires the bundled OpenCV integration dependency. These are backend AI checks, not proof of live provider quality, representative photo privacy, deployment, or full client-to-hosted-API behavior.

Run the AI suite from `backend/` with:

```bash
python -m pytest ai_tests -q
```
