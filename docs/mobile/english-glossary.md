# CityFix English: tone and glossary

The app is Arabic-first. English is a full second language that people switch to in **Profile → Language** (or "English" on sign-in). Everything flips to left-to-right.

## Tone
- Plain, friendly, short English. Translate the meaning, not word by word. Speak to the person directly ("your report"); it's naturally gender-neutral.
- Say what happens next, like the Arabic does: "We got your report. We'll review it within 24 hours."
- Never blame: "We're still on it", not "Pending".
- Keep short units on one line with a no-break space: "9\u00a0AM", "Me\u00a0too" (the button's name).
- Lists are joined with commas, not " + " ("near a school or hospital, 7 reports, high risk").
- Western digits (0–9) everywhere in English. Money: "1,800 EGP". Dates: "22 Oct". Times: "10:12 AM". Phone: "010 1234 5678", prefix "+20".
- Egyptian names stay as names: Fawry, InstaPay, Nasr City, district names (see `src/i18n/labels.ts`).
- Slogans: Aref Ruqaa is for Arabic only. In English, slogans use the display font (Readex Pro bold).
- No religious content in either language.

## Glossary (use exactly)

| Arabic | English |
| --- | --- |
| سيتي فيكس | CityFix |
| بلّغ.. وإحنا نتابع لحد ما تتصلّح | Report it, and we'll follow it until it's fixed |
| مدينتك أحلى لما نصلّحها سوا | Your city is better when we fix it together |
| صباح الفل / مساء الفل | Good morning / Good evening |
| بلّغ (tab button) | Report |
| بلّغ عن مشكلة | Report a problem |
| الرئيسية · الخريطة · طلباتي · حسابي | Home · Map · My requests · Account |
| تسلم إيدك! | Thank you! |
| أنا كمان | Me too |
| نفس المشكلة، تابعها | Same problem — follow it |
| البلاغ ده متسجّل باسمك بالفعل | You've already reported this |
| اقتراح الذكاء الاصطناعي | AI suggestion |
| خطر | Danger |
| ده ممكن يكون طوارئ — اتصل فورًا | This may be an emergency — call now |
| مستني النت | Waiting for internet |
| ابعت دلوقتي | Send now |
| قريبًا | Coming soon |
| خط أكبر | Larger text |
| إشعارات التطبيق | App notifications |
| تحديثات واتساب | WhatsApp updates |
| توفير البيانات / توفير باقة النت | Data saver |
| بلّغ من غير اسم | Report without my name |
| اخفي الوشوش ونمر العربيات | Blur faces and car plates |
| علامة مميزة | Landmark |
| استخدم موقعي | Use my location |
| سجّل بصوتك / فويس نوت | Record a voice note |
| بنكتب كلامك... | Turning your voice into text... |
| لسه المشكلة موجودة؟ | Still a problem? |
| افتح البلاغ تاني | Reopen the report |
| جدع الشارع / جدع الحي | Street Hero / Neighbourhood Hero |
| الخدمات (CityServe) | City services |
| رفع مخلفات كبيرة | Bulky waste pickup |
| تقليم أو إزالة شجرة | Tree trimming or removal |
| مواعيد جمع القمامة | Garbage collection times |
| حسب لائحة الحي | as per the district's rates |
| خروج | Sign out |
| مش لاقيين | We couldn't find it |
| متابعة البلاغ / الطلب | Track your report / Track your request |
| الجهة المسؤولة | Handled by |
| الجاية (garbage) | Next pickup |
| العربية بتعدّي … | Pickup time: … |
| سيتي سايكل (إعادة التدوير) | CityCycle (recycling) |
| طلب فرز / استلام خامات | Recycling pickup |
| الخامات | Materials |
| بلاستيك (إزايز) | Plastic bottles (PET) |
| ورق وكرتون | Paper & cardboard |
| معادن وعلب | Metal & cans |
| إزاز | Glass |
| إلكترونيات قديمة | Old electronics |
| زيت طبيخ مستعمل | Used cooking oil |
| فضلات أكل | Food scraps |
| الجامع (الزبّال) | Collector |
| وضع الجامع / وضع المواطن | Collector mode / Citizen mode |
| مستني حد يقبله | Waiting for a collector |
| اتقبل وفي الطريق | Accepted, on the way |
| اتوزن | Weighed |
| خلص | Done |
| مجانًا / بمقابل فلوس | Give for free / Get paid |
| أسعار تجريبية | Demo prices |
| السعر هيتحدد | Price to be set |
| اتاخد خلاص | Already taken |
| سعر الكيلو | Price per kg |
| القيمة التقديرية | Estimated value |
| الوزن الفعلي | Weighed amount |
| صندوق شارع / مركز تجميع | Street bin / Collection hub |
| تمام / بيمتلي / ممتلي | OK / Filling up / Full |
| حرارة عالية | Heat alert |
| البطارية ضعيفة | Low battery |
| مش بيبعت | Offline |
| بلّغ إن الصندوق ممتلي | Report a full bin |
| الأثر (كجم اتحوّلت لإعادة تدوير) | Impact (kg recycled) |
| أرباحي | My earnings |
| CO₂ اتفادى (تقديري) | CO₂ avoided (estimate) |

Statuses, severities, categories, departments, hotlines, places, services and medals: `apps/mobile/src/i18n/labels.ts`.
