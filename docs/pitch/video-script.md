# Demo video script (3:00)

Arabic voice-over (Egyptian Arabic), English subtitles. Label every seed value on screen as DEMO. Criterion column: 1 local context and impact, 2 technical rigor, 3 innovation, 4 field feasibility, 5 communication.

| # | Time | Shot | Voice-over (Arabic, English subtitle) | Criterion |
| --- | --- | --- | --- | --- |
| 1 | 0:00-0:15 | Title card, then the Track 4 question on screen | "إزاي نحوّل الزبالة لقيمة اقتصادية ونرفع شأن اللي بيشتغلوا فيها؟" / "How do we turn waste into economic value and lift the people who work in it?" Theme facts, spoken as theme facts (see [vision.md](../vision.md)): about 20 million tonnes of municipal solid waste a year (EEAA); the Zabbaleen recover up to 80% of what they gather | 1 |
| 2 | 0:15-0:30 | The problem for the Zabbal: no verified weight and no record of earnings. Use the picture guide or a plain graphic, not invented footage | "الزبّال بيشتغل من غير وزن موثّق ولا سجل لدخله" / "A Zabbal works without a verified weight or a record of earnings" | 1 |
| 3 | 0:30-0:55 | Mobile app, services, recycling: pick materials with the picture guide, kg, free or paid, see the estimate. Caption: "DEMO prices" | "الأسرة بتختار الخامات وبتشوف التقدير من قايمة أسعار الحي" / "The household picks materials and sees an estimate from the district price list" | 1, 2 |
| 4 | 0:55-1:25 | Collector mode, login `01022223333` (code `123456`): jobs on a map, accept, weigh, complete | "الجامع بيقبل الطلب القريب، بيوزن كل خامة، وبيسجّل المبلغ" / "The collector accepts a nearby job, weighs each material and records what was paid" | 1, 2 |
| 5 | 1:25-1:40 | Household confirms the weight; impact screen. Caption: "demo seed data: 13.5 kg" | "الأسرة بتأكد الوزن والأثر بيظهر" / "The household confirms the weight and the impact shows" | 1 |
| 6 | 1:40-2:05 | Smart bin: PC simulator in real mode, or Wokwi serial raising the fill; Command Center bins page showing `BIN-012` full and `BIN-013` hot. Caption: "simulated device, not a field unit" | "الحاوية بتبعت مستوى الامتلاء، ولوحة التحكم بتحمّر عند الحد" / "The bin reports its fill level and the Command Center turns red at the threshold" | 2, 3 |
| 7 | 2:05-2:25 | Route plan: optimizer on pickups `RCY-3001` to `RCY-3004`, depot `HUB-001` (30.0558, 31.3295). Use the Command Center route planner (`/citycycle`, tab مسارات الجمع, admin login; needs the real API, not demo mode); Swagger at `/docs` is the backup | "الحي يخطط مسار تجميع بـ OR-Tools" / "The district plans a collection route with OR-Tools" | 2, 3 |
| 8 | 2:25-2:40 | Field feasibility: the BOM (`hardware/bom/bom.csv`) and the printable Field Deployment Brief (`docs/field-brief/field-deployment-brief.html`), only if they have merged by recording time; otherwise say what is to verify | "قايمة المكوّنات بالجنيه وظروف الحر والتراب" / "The bill of materials in EGP and the heat and dust conditions" | 4 |
| 9 | 2:40-3:00 | Honesty slide: verified in tests, simulated, to verify; repo URL; MIT licence | "ده اللي اتجرّب بالاختبارات، وده اللي لسه محاكاة، وده اللي هنتحقق منه" / "What tests cover, what is simulated, what we will verify" | 5 |

## Recording checklist

- [ ] Reset the demo data: `cd backend && uv run python scripts/reset_demo.py`, or `POST /admin/demo/reset` with `DEMO_RESET_ENABLED=true` (local only, destructive).
- [ ] Backend: `cd backend && LOCAL_SCHEMA_BOOTSTRAP=true SEED_ON_START=true uv run uvicorn app.main:app --reload --port 8000`.
- [ ] Command Center: `cd apps/admin-web && npm run dev` (port 3001); admin login is in the root README.
- [ ] Citizen web or mobile in API mode (`NEXT_PUBLIC_API_MODE=api` for the web) pointing at the local backend.
- [ ] Simulator real mode: as admin, rotate a bin key with `PATCH /admin/bins/{id}` and `{"rotateKey": true}`, then set `CITYFIX_SIM_MODE`, `CITYFIX_BIN_ID`, `CITYFIX_API_BASE_URL` and `CITYFIX_DEVICE_KEY` (see `hardware/simulator/README.md`). Never show the key on screen.
- [ ] Arabic UI on screen, English subtitles added afterwards; a DEMO caption on every price and weight.
- [ ] Show nothing that implies a physical bin or real payments.
