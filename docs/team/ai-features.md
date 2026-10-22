# Role brief — AI & smart features / CityBrain (Member 5)

**Owner:** _[member name]_ · **Branch prefix:** `feat/ai-…` (e.g. `feat/ai-triage`) · **Folders:** `backend/app/ai/`, `backend/app/optimizer/`, `backend/app/routers/{triage,ai,budget}.py`, `backend/ai-eval/` · **Starts:** now, in isolation; plugs into the backend when Member 4's seams land.

## Your mission

Make CityFix smart without making it unsafe. Every AI result is a **suggestion a person confirms**. The citizen or the staff member always has the last word, and the product keeps working when the model is slow, wrong or down.

**Done means:** a citizen's photo + Egyptian Arabic text (or voice note) comes back in under ~5 seconds with a category, severity, a one-line Arabic summary and nearby duplicates; staff get a budget plan and a weekly hotspot summary; and you can show the accuracy numbers on a test set.

You don't build the database or the main API (Member 4 does) and you don't build screens (Members 1–3 do). You own the functions, the endpoints listed below, and the evaluation.

## The features (in priority order)

| # | Feature | Endpoint (see [`api-contract.md`](../api-contract.md)) | Used by | Must / stretch |
| --- | --- | --- | --- | --- |
| 1 | **Report triage**: photo + text → top-3 categories with confidence, severity, one Arabic summary line, duplicates | `POST /triage` | Mobile + citizen web report form; admin incident detail ("اقتراح الذكاء الاصطناعي") | **Must** |
| 2 | **Keyword fallback**: the deterministic classifier, ported from `apps/mobile/src/logic/triage-mock.ts`, used on timeout or model error | inside `/triage` | Everyone, when the model fails | **Must** (do this first, Day 1) |
| 3 | **Budget optimizer**: 0/1 knapsack with Google OR-Tools: maximise total priority under a budget in EGP, with a one-line reason per selected/skipped incident | `POST /admin/budget/optimize` | Admin Budget page | **Must** |
| 4 | **Voice note → text**: Egyptian Arabic speech to text, then run triage on the text; the citizen can edit the text | `POST /ai/transcribe` | Mobile "سجّل بصوتك", citizen web mic button | Should |
| 5 | **Privacy blur**: blur faces and car plates in report photos before anyone but the reporter and staff sees them | runs on upload (called by Member 4's upload flow) | All public photo views | Should |
| 6 | **Duplicate help**: on top of the geo rule (same category, open, within 250 m, which Member 4 owns), rank candidates by text/photo similarity and suggest a merge to staff | inside `/triage`; `GET /admin/incidents/{id}/similar` | Admin incident detail (merge needs a human click) | Stretch |
| 7 | **Weekly insights**: hotspots, rising categories, overdue departments, in one short Arabic paragraph + numbers | `GET /admin/insights` | Admin Overview | Stretch |

**Not AI, never AI:** the priority score. It stays the deterministic formula in `apps/mobile/src/logic/priority.ts` so it is explainable. You may *suggest* a severity; the score is computed from the confirmed one.

## Stack

- Python 3.12, inside the same FastAPI app as Member 4 (your routers are registered in `main.py`).
- A hosted multimodal LLM (for example Claude through the Anthropic API) with **strict JSON output** validated by Pydantic. Keep the provider behind one module (`ai/llm.py`) so it can be swapped.
- Speech to text: a hosted model that handles Egyptian Arabic (test 2–3 options on 10 real voice notes and pick by accuracy).
- Blur: OpenCV face detection + a plate detector (or the LLM returning boxes) → Gaussian blur; keep the original private.
- Optimizer: `ortools` (CP-SAT or the knapsack solver).
- Secrets only in env vars: `LLM_API_KEY`, `STT_API_KEY`. Never in the repo, never in an app.

## Folder layout

```
backend/app/ai/
  llm.py            client wrapper, timeouts, retries=0, JSON schema
  triage.py         analyze_report(description, photo_url, category_hint, location, user_id) -> TriageSuggestion
  keywords.py       deterministic fallback (port of triage-mock.ts, same keywords and tests)
  prompts/          triage.md, insights.md (Egyptian Arabic examples, the 12 categories with descriptions)
  transcribe.py     transcribe(audio_url) -> { text, language, confidence }
  blur.py           blur_image(path) -> path_of_blurred_copy
  insights.py       weekly_insights(district) -> { summary, hotspots[], risingCategories[], overdueDepartments[] }
backend/app/optimizer/
  knapsack.py       optimize(budget_egp, incidents) -> { selected, skipped, totalCost, remaining, coveredPriority }
backend/app/routers/triage.py, ai.py, budget.py
backend/ai-eval/
  dataset/          30+ example reports: photo, Egyptian Arabic text, expected category + severity
  run_eval.py       prints accuracy, top-3 accuracy, severity agreement, p50/p95 latency, fallback rate
```

## How you plug into the backend

Member 4 gives you these functions in `backend/app/logic/queries.py`. Call them; don't write SQL against their tables yourself:

- `find_nearby_incidents(category_id, lat, lng, radius_m, user_id)` → `{ duplicates, alreadyReported }` (the 250 m rule)
- `get_category(category_id)` and `get_responsible_department(category_id)`
- `list_open_incidents_for_budget(district)` → id, title, category, priority score, estimated cost
- `save_ai_suggestion(report_id, kind, payload, model, latency_ms)`: log every AI output in `ai_suggestions` so accuracy can be measured

Until they exist, use a fake `queries.py` with the seed data (10 incidents around Nasr City; see `apps/mobile/src/services/mock/seed.ts`).

## Guardrails (non-negotiable)

- **Suggestions only.** Never auto-change a category the citizen picked, never auto-merge duplicates, never close or reprioritise an incident. Label every output "اقتراح الذكاء الاصطناعي".
- **Always answer.** `/triage` returns within ~5 s; on timeout or error return the keyword result with `"source": "fallback"`, never an error to the citizen.
- **Emergencies are not triage.** If the text mentions gas, fire, injury or a collapse, the suggestion must tell the client to show the emergency numbers (١٢٢، ١٢٣، ١٨٠، ١٢٩); add `emergency: true` to the response (contract PR needed).
- **Privacy.** Don't send phone numbers or names to the model. Blurred copies are what citizens see. Don't keep raw audio longer than needed.
- **Neutral, civic Arabic.** No religious phrases; short Egyptian Arabic; gender-neutral.
- **Cost and abuse:** cap image size (≤ 1600 px), one model call per triage, rate-limit per user.

## Work plan

| # | Step | Done when |
| --- | --- | --- |
| 1 | `keywords.py` ported from `triage-mock.ts` with its tests; `/triage` answering from it | Clients can call the real endpoint with the fallback |
| 2 | Eval dataset (30+ reports, Egyptian Arabic, with photos) + `run_eval.py` | Baseline numbers for the keyword classifier |
| 3 | LLM triage with strict JSON + timeout + fallback; prompt with the 12 categories and Egyptian examples | Beats the baseline on top-1 and top-3; p95 < 5 s |
| 4 | Duplicates in the triage response through `find_nearby_incidents` | Matches the contract's `duplicates` / `alreadyReported` |
| 5 | Budget optimizer + `POST /admin/budget/optimize` + tests (never over budget, only valid ids, deterministic) | Admin Budget page works on real data |
| 6 | Voice transcription `POST /ai/transcribe` | 10 real Egyptian voice notes transcribed; error rate noted in the README |
| 7 | Photo blur on upload (with Member 4's upload flow) | Faces and plates blurred in public views |
| 8 | Stretch: similar-incident ranking, weekly insights | Admin Overview shows the insight card |
| 9 | `backend/ai-eval/README.md` with the final numbers for the demo | Accuracy slide ready |

## Contract changes you need

These are listed as **proposed** in [`api-contract.md`](../api-contract.md). Agree them with Member 4 and the client owners by PR before relying on them: `GET /admin/insights` and `GET /admin/incidents/{id}/similar`.

## Hand-offs

- **To Members 1 and 2 (mobile, citizen web):** `/triage` and `/ai/transcribe` live, with the response times and the fallback behaviour written down.
- **To Member 3 (admin web):** `/admin/budget/optimize`, the triage payload for incident detail, and insights when ready.
- **To Member 4 (API & DB):** your routers, your env vars, and a list of the queries you need.
- **To the team:** the eval numbers and 3 good demo examples (a pothole photo, an open manhole voice note, a duplicate).
