"""Static Arabic lists for the large synthetic demo dataset (see ``seed_large.py``).

Everything here is invented: names, streets and landmarks are plausible but fake, gender-balanced and free of
religious references. Districts, governorates and centroids mirror ``apps/mobile/src/domain/locations.ts``.
"""

FIRST_NAMES = [
    "منى", "سارة", "ياسمين", "هبة", "نورهان", "دينا", "ريم", "سلمى", "مي", "نهى",
    "إيمان", "رنا", "شيماء", "أميرة", "ندى", "لمياء", "هالة", "داليا", "رحاب", "جيهان",
    "أحمد", "محمود", "كريم", "عمرو", "تامر", "هشام", "شريف", "وليد", "مصطفى", "حسام",
    "طارق", "ياسر", "إسلام", "عادل", "سامح", "رامي", "أيمن", "باسم", "خالد", "مينا",
]  # fmt: skip
FAMILY_NAMES = [
    "السيد", "عبد الحميد", "فؤاد", "حسن", "سليمان", "شاكر", "النجار", "الشريف", "منصور", "عثمان",
    "رشاد", "فهمي", "زكي", "صبري", "توفيق", "البنا", "الجمال", "عزت", "لطفي", "مراد",
    "نصار", "حلمي", "رزق", "جاد", "بدوي", "شلبي", "سالم", "المصري", "الحسيني", "يوسف",
]  # fmt: skip
# First + family combinations that are the names of well-known public figures: never generated.
PUBLIC_FIGURE_NAMES = {
    "منى زكي", "أحمد زكي", "خالد زكي", "أحمد حلمي", "عمرو يوسف", "باسم يوسف", "خالد يوسف", "مصطفى فهمي",
    "كريم فهمي", "أحمد فهمي", "وليد توفيق", "دينا فؤاد", "هالة فؤاد", "أحمد فؤاد", "طارق لطفي", "أحمد رزق",
    "ياسمين صبري", "هشام عباس", "أحمد السيد", "محمود حلمي", "أحمد سليمان",
}  # fmt: skip

# id, name, governorate, lat, lng, underserved, weight
DISTRICTS = [
    ("nasr-1", "مدينة نصر أول", "القاهرة", 30.056, 31.33, False, 0.40),
    ("nasr-2", "مدينة نصر ثان", "القاهرة", 30.075, 31.345, False, 0.10),
    ("heliopolis", "مصر الجديدة", "القاهرة", 30.09, 31.32, False, 0.08),
    ("maadi", "المعادي", "القاهرة", 29.96, 31.26, False, 0.05),
    ("ain-shams", "عين شمس", "القاهرة", 30.131, 31.332, True, 0.05),
    ("shubra", "شبرا", "القاهرة", 30.11, 31.245, True, 0.05),
    ("dokki", "الدقي", "الجيزة", 30.038, 31.211, False, 0.04),
    ("mohandessin", "المهندسين", "الجيزة", 30.056, 31.2, False, 0.04),
    ("haram", "الهرم", "الجيزة", 29.988, 31.17, False, 0.04),
    ("faisal", "فيصل", "الجيزة", 29.99, 31.15, True, 0.04),
    ("imbaba", "إمبابة", "الجيزة", 30.077, 31.208, True, 0.04),
    ("sidi-gaber", "سيدي جابر", "الإسكندرية", 31.22, 29.94, False, 0.03),
    ("montaza", "المنتزه", "الإسكندرية", 31.28, 30.02, False, 0.03),
    ("agamy", "العجمي", "الإسكندرية", 31.1, 29.77, True, 0.03),
]

_NASR_STREETS = [
    "شارع عباس العقاد",
    "شارع مكرم عبيد",
    "شارع الطيران",
    "شارع الحجاز",
    "شارع يوسف عباس",
    "شارع مصطفى النحاس",
    "شارع أحمد فخري",
    "شارع حسن المأمون",
]
_GENERIC_STREETS = [
    "شارع المدارس",
    "شارع السوق",
    "شارع الجمهورية",
    "شارع النصر",
    "شارع التحرير",
    "شارع ٩",
    "شارع الترعة",
    "شارع الجيش",
]
STREETS = {
    d[1]: (
        _NASR_STREETS
        if d[0] == "nasr-1"
        else ([*_GENERIC_STREETS[:7], "شارع البحر"] if d[2] == "الإسكندرية" else _GENERIC_STREETS)
    )
    for d in DISTRICTS
}
STREETS["مدينة نصر ثان"] = [*_GENERIC_STREETS[:6], "شارع الثورة", "شارع الطيران"]

# Never a school, hospital or park: those belong in SENSITIVE_PLACES (budget.SENSITIVE_KINDS prefix rule).
LANDMARKS = [
    "جنب صيدلية السلام",
    "قدام محطة المترو",
    "ناصية سوبر ماركت الخير",
    "جنب المخبز",
    "قدام عمارة البنك",
    "جنب محطة البنزين",
    "قدام الكافيه",
    "ناصية ورشة السيارات",
    "جنب محل الخضار",
    "قدام مكتب البريد",
]
SENSITIVE_PLACES = [
    "مدرسة النصر الإعدادية",
    "مدرسة الأمل الابتدائية",
    "مدرسة المستقبل الثانوية",
    "مستشفى الحي العام",
    "مستشفى الشفاء التخصصي",
    "حديقة الأطفال",
    "حديقة الحي",
]

TITLE_TEMPLATES = ["{label} · {street}", "{label} قدام عمارة {n}", "{label} عند {street}"]

DESCRIPTIONS = {
    "pothole": ["حفرة كبيرة في نص الشارع والعربيات بتتهز", "الأسفلت اتكسر وبقت حفرة عميقة", "مطب عشوائي بيعطل المرور"],
    "open_manhole": [
        "البالوعة من غير غطا وخطر على الأطفال",
        "غطا البالوعة اتسرق ومفيش حاجة حواليها",
        "بالوعة مفتوحة جنب الرصيف",
    ],
    "sewage_overflow": [
        "المجاري طافحة في الشارع من إمبارح",
        "ريحة وطفح مجاري قدام العمارة",
        "ميه المجاري داخلة على المحلات",
    ],
    "water_pipe_burst": [
        "ماسورة مياه مكسورة والميه ماليه الشارع",
        "مياه الشرب بتتهدر من الصبح",
        "كسر في الخط وضغط المياه ضعيف",
    ],
    "garbage": [
        "زبالة متراكمة بقالها أيام ومحدش بيرفعها",
        "الحاوية ممتلئة والزبالة على الأرض",
        "كومة زبالة جنب الرصيف والريحة وحشة",
    ],
    "streetlight_out": [
        "عمود النور مطفي والشارع ضلمة بالليل",
        "الإنارة واقفة من أسبوع",
        "لمبة العمود بتفصل وبتشتغل",
    ],
    "exposed_wire": [
        "سلك كهربا مكشوف جنب الرصيف",
        "كابل متدلي من العمود وخطر",
        "صندوق كهربا مفتوح وأسلاكه باينة",
    ],
    "road_obstruction": [
        "عربيات واقفة صف تاني وقافلة الطريق",
        "إشغال محل على الرصيف والشارع",
        "مواد بناء مرمية في الطريق",
    ],
    "stray_dogs": ["كلاب ضالة كتير في الشارع بالليل", "مجموعة كلاب بتخوف الأطفال", "كلاب بتجري ورا العيال"],
    "fallen_tree": [
        "شجرة مايلة على الرصيف ومحتاجة قص",
        "فرع كبير وقع على الطريق",
        "شجرة وقعت وقفلت نص الشارع",
    ],
    "broken_sidewalk": [
        "الرصيف مكسور والمشي عليه صعب",
        "بلاط الرصيف مقلوع وفيه حفر",
        "رصيف واطي ومكسور عند الناصية",
    ],
    "other": [
        "مشكلة في الشارع محتاجة معاينة",
        "حاجة غريبة في المنطقة ومحتاجة حد يشوفها",
        "بلاغ عن مشكلة عامة في الحي",
    ],
}

# Fixed plausible alternatives for the AI triage card (deterministic; no DB ``limit(2)``).
AI_ALTERNATIVES = {
    "pothole": ["broken_sidewalk", "road_obstruction"],
    "open_manhole": ["sewage_overflow", "pothole"],
    "sewage_overflow": ["water_pipe_burst", "open_manhole"],
    "water_pipe_burst": ["sewage_overflow", "pothole"],
    "garbage": ["road_obstruction", "other"],
    "streetlight_out": ["exposed_wire", "other"],
    "exposed_wire": ["streetlight_out", "other"],
    "road_obstruction": ["garbage", "other"],
    "stray_dogs": ["other", "garbage"],
    "fallen_tree": ["road_obstruction", "other"],
    "broken_sidewalk": ["pothole", "road_obstruction"],
    "other": ["garbage", "road_obstruction"],
}

# Share of ordinary incidents per category (garbage is lower here because hotspot and bin incidents add more).
CATEGORY_MIX = [
    ("garbage", 0.16),
    ("pothole", 0.15),
    ("streetlight_out", 0.11),
    ("sewage_overflow", 0.09),
    ("broken_sidewalk", 0.09),
    ("water_pipe_burst", 0.08),
    ("road_obstruction", 0.08),
    ("stray_dogs", 0.07),
    ("fallen_tree", 0.06),
    ("open_manhole", 0.05),
    ("exposed_wire", 0.04),
    ("other", 0.04),
]

# Staff names per department, as in seed.py's staff accounts (names only: no accounts are created).
DEPT_STAFF = {
    "roads": "م. هشام عادل",
    "sanitation": "نادية علي",
    "lighting": "محمود أحمد",
    "sewage": "سلام محمد",
    "water": "حسان علي",
    "electricity": "صادق محمود",
    "parks": "فاطمة الزهراء",
    "utilities": "عمر كمال",
    "veterinary": "دينا ياسر",
}
SUPERVISORS = ["م. هشام عادل", "فاطمة محمود", "نور أحمد", "صالح محمد", "أمينة علي", "م. طارق سالم", "رحاب منصور"]

SR_ITEMS = {
    "bulky_waste": ["كنبة قديمة", "تلاجة", "مرتبة", "دولاب", "كراتين كتير", "غسالة", "سرير قديم"],
    "tree_maintenance": ["قص فروع", "تقليم", "شجرة مايلة", "إزالة فرع كبير"],
}
SR_NOTES = ["يفضل قبل الظهر", "الدور التالت من غير أسانسير", "التليفون مع الحارس", "الباب الخلفي للعمارة"]
PICKUP_NOTES = ["الأكياس عند باب الشقة", "بلاغ قبل الوصول بنص ساعة", "الخامات متفرزة في أكياس", "الدور الأرضي"]
VEHICLES = ["تروسيكل", "عربية نص نقل", "عربية كارو", "موتوسيكل بصندوق"]
