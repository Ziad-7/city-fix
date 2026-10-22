# CityBrain triage evaluation

From `backend/`, run the deterministic keyword baseline with:

```bash
python -m ai_eval.run_eval
```

The checked-in 33-case corpus contains **synthetic Egyptian Arabic text only**. It is a smoke set for category ranking and severity behavior, not a representative accuracy benchmark. It has no photos, real citizen reports, or independent human review. Do not use its score to claim production accuracy or to enable photo analysis.

At the time this corpus was added, the keyword baseline scored:

| Metric | Result |
| --- | ---: |
| Top-1 category | 90.9% |
| Top-3 category | 100% |
| Severity agreement | 87.9% |
| Fallback responses | 100% |

Latency values measure the local deterministic classifier and do not predict hosted-model latency. To compare the configured Gemini model on these same text-only fixtures, set `GEMINI_API_KEY` and run:

```bash
python -m ai_eval.run_eval --model
```

That sends the synthetic descriptions to Google and consumes the project's Gemini quota. The free tier has quotas and may use submitted content to improve Google products. Before using evaluation results for a release decision, add a consented, de-identified, human-labeled set with representative Egyptian Arabic and photos, then report its source and limitations here.
