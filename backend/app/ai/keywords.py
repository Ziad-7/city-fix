import re

from app.ai.schemas import CategoryId, Severity, TriageOption, TriageSuggestion


def normalize_ar(value: str) -> str:
    return (
        value.lower()
        .translate(str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ة": "ه"}))
        .replace("ـ", "")
        .translate({ord(char): None for char in "ًٌٍَُِّْٰٓٔ"})
    )


ARABIC_KEYWORDS: dict[CategoryId, tuple[str, ...]] = {
    CategoryId.pothole: (
        "حفره",
        "حفر",
        "مطب",
        "اسفلت",
        "الاسفلت",
        "نتوء",
        "العربيات بتقع",
        "هبوط",
    ),
    CategoryId.open_manhole: (
        "بلوعه",
        "بالوعه",
        "غطا",
        "غطاء",
        "مطبق",
        "منهول",
        "مفتوحه",
    ),
    CategoryId.sewage_overflow: (
        "طفح",
        "مجاري",
        "صرف",
        "ريحه مجاري",
        "مياه سوده",
        "غرقان",
        "بيطفح",
    ),
    CategoryId.water_pipe_burst: (
        "ماسوره",
        "مواسير",
        "كسر",
        "مياه بتطلع",
        "مايه",
        "ميه",
        "تسريب",
        "بتنزل مياه",
        "غرق",
    ),
    CategoryId.garbage: ("زبال", "قمام", "مخلفات", "القمامه", "نفايات", "تلال", "كوم"),
    CategoryId.streetlight_out: (
        "عمود نور",
        "نور",
        "انار",
        "مطفي",
        "ضلمه",
        "مضلم",
        "لمبه",
        "كشاف",
    ),
    CategoryId.exposed_wire: (
        "سلك",
        "اسلاك",
        "كهربا",
        "كهرباء",
        "شرر",
        "صعق",
        "كابل",
        "عريان",
        "مكشوف",
    ),
    CategoryId.road_obstruction: (
        "اشغال",
        "اشغالات",
        "تعدي",
        "كراسي",
        "بياعين",
        "سد الطريق",
        "مقفول",
        "عربيه واقفه",
        "صف تاني",
    ),
    CategoryId.stray_dogs: ("كلب", "كلاب", "ضاله", "بتعض", "نباح"),
    CategoryId.fallen_tree: ("شجره", "شجر", "فرع", "مايله", "واقعه", "وقعت"),
    CategoryId.broken_sidewalk: ("رصيف", "بلاط", "مكسور", "الرصيف", "بلاطه"),
    CategoryId.other: (),
}

ENGLISH_KEYWORDS: dict[CategoryId, tuple[str, ...]] = {
    CategoryId.pothole: ("pothole", "speed bump", "asphalt", "hole in the road"),
    CategoryId.open_manhole: ("manhole", "drain cover", "missing cover", "open drain"),
    CategoryId.sewage_overflow: ("sewage", "sewer", "overflow", "drain smell"),
    CategoryId.water_pipe_burst: (
        "pipe",
        "burst",
        "water leak",
        "leaking water",
        "water main",
        "flood",
    ),
    CategoryId.garbage: ("garbage", "trash", "rubbish", "litter", "waste"),
    CategoryId.streetlight_out: (
        "streetlight",
        "street light",
        "lamp",
        "light is out",
        "lights are out",
        "dark",
    ),
    CategoryId.exposed_wire: ("wire", "cable", "spark", "electric", "live wire"),
    CategoryId.road_obstruction: (
        "blocked",
        "blocking",
        "obstruct",
        "double parked",
        "encroach",
    ),
    CategoryId.stray_dogs: ("dog", "stray", "bite", "bark"),
    CategoryId.fallen_tree: ("tree", "branch", "fallen", "leaning"),
    CategoryId.broken_sidewalk: ("sidewalk", "pavement", "tile", "curb"),
    CategoryId.other: (),
}

DEFAULT_SEVERITY = {
    CategoryId.pothole: Severity.medium,
    CategoryId.open_manhole: Severity.high,
    CategoryId.sewage_overflow: Severity.high,
    CategoryId.water_pipe_burst: Severity.high,
    CategoryId.garbage: Severity.medium,
    CategoryId.streetlight_out: Severity.low,
    CategoryId.exposed_wire: Severity.high,
    CategoryId.road_obstruction: Severity.low,
    CategoryId.stray_dogs: Severity.medium,
    CategoryId.fallen_tree: Severity.medium,
    CategoryId.broken_sidewalk: Severity.low,
    CategoryId.other: Severity.low,
}

CATEGORY_LABELS = {
    CategoryId.pothole: "حفرة أو مطب عشوائي",
    CategoryId.open_manhole: "بالوعة مفتوحة",
    CategoryId.sewage_overflow: "طفح مجاري",
    CategoryId.water_pipe_burst: "كسر ماسورة مياه",
    CategoryId.garbage: "زبالة متراكمة",
    CategoryId.streetlight_out: "عمود نور مطفي",
    CategoryId.exposed_wire: "سلك كهربا مكشوف",
    CategoryId.road_obstruction: "إشغالات طريق",
    CategoryId.stray_dogs: "كلاب ضالة",
    CategoryId.fallen_tree: "شجرة واقعة أو مايلة",
    CategoryId.broken_sidewalk: "رصيف مكسور",
    CategoryId.other: "حاجة تانية",
}

DEPARTMENTS = {
    CategoryId.pothole: "صيانة الطرق",
    CategoryId.open_manhole: "الصرف الصحي",
    CategoryId.sewage_overflow: "الصرف الصحي",
    CategoryId.water_pipe_burst: "شركة مياه الشرب",
    CategoryId.garbage: "هيئة النظافة والتجميل",
    CategoryId.streetlight_out: "إنارة الحي",
    CategoryId.exposed_wire: "شركة الكهرباء",
    CategoryId.road_obstruction: "مرافق الحي",
    CategoryId.stray_dogs: "الطب البيطري",
    CategoryId.fallen_tree: "حدائق الحي",
    CategoryId.broken_sidewalk: "صيانة الطرق",
    CategoryId.other: "مرافق الحي",
}

EMERGENCY_WORDS = {
    "غاز",
    "حريقه",
    "حريق",
    "نار",
    "دخان",
    "اتعور",
    "اتصاب",
    "مصاب",
    "مصابين",
    "اصابه",
    "دم",
    "نزيف",
    "وقع",
    "انهيار",
    "انهار",
    "انفجار",
    "اتفجر",
    "مولع",
    "بيولع",
}
EMERGENCY_WORDS_EN = {
    "gas",
    "fire",
    "smoke",
    "burning",
    "flames",
    "injured",
    "injury",
    "hurt",
    "bleeding",
    "blood",
    "collapse",
    "collapsed",
    "collapsing",
    "explosion",
    "exploded",
    "electrocuted",
    "unconscious",
}
EMERGENCY_PHRASES = (
    "حد اتعور",
    "بيت واقع",
    "عماره بتقع",
    "بيت بيقع",
    "عماره واقعه",
    "سقف وقع",
    "ريحه غاز",
    "تسريب غاز",
)
ARABIC_PREFIXES = ("", "و", "ب", "ل", "ال", "وال", "بال", "ف")
ESCALATE_AR = (
    "مدرسه",
    "اطفال",
    "عيال",
    "طلاب",
    "مستشفي",
    "ناس بتقع",
    "حادث",
    "خطر",
    "شرر",
    "مات",
    "وقع حد",
    "بتقع كل يوم",
    "عاجل",
)
ESCALATE_EN = (
    "school",
    "children",
    "kids",
    "students",
    "hospital",
    "accident",
    "danger",
    "urgent",
    "every day",
    "people fall",
    "cars fall",
)
DE_ESCALATE_AR = ("بسيطه", "صغيره", "خفيفه")
DE_ESCALATE_EN = ("small", "minor", "slight")
SEVERITY_ORDER = (Severity.low, Severity.medium, Severity.high, Severity.critical)


def _whole_word_match(text: str, phrase: str) -> bool:
    return re.search(rf"(?<![a-z]){re.escape(phrase)}", text) is not None


def detect_emergency(description: str) -> bool:
    text = normalize_ar(description)
    text = re.sub(r"[^ء-يa-z0-9]+", " ", text)
    padded = f" {text} "
    if any(f" {normalize_ar(phrase)} " in padded for phrase in EMERGENCY_PHRASES):
        return True
    tokens = text.split()
    if any(token in EMERGENCY_WORDS_EN for token in tokens):
        return True
    return any(token == prefix + word for token in tokens for prefix in ARABIC_PREFIXES for word in EMERGENCY_WORDS)


def _hits(description: str, category: CategoryId) -> int:
    arabic = normalize_ar(description)
    english = arabic
    arabic_hits = len({normalize_ar(word) for word in ARABIC_KEYWORDS[category] if normalize_ar(word) in arabic})
    english_hits = sum(_whole_word_match(english, word) for word in ENGLISH_KEYWORDS[category])
    return arabic_hits + english_hits


def _shift(severity: Severity, amount: int) -> Severity:
    return SEVERITY_ORDER[max(0, min(len(SEVERITY_ORDER) - 1, SEVERITY_ORDER.index(severity) + amount))]


def classify_keywords(description: str, category_hint: CategoryId | None = None) -> "TriageSuggestion":
    from app.ai.schemas import TriageSuggestion

    scores = []
    for category in CategoryId:
        hits = _hits(description, category)
        score = 0.2 + hits * 3 + (4 if category_hint == category else 0)
        scores.append((category, score))
    total = sum(score for _, score in scores)
    ranked = sorted(scores, key=lambda item: (-item[1], item[0].value))[:3]
    options = [
        TriageOption(category_id=category, confidence=int(score / total * 100) / 100) for category, score in ranked
    ]

    top = ranked[0][0]
    text = normalize_ar(description)
    severity = DEFAULT_SEVERITY[top]
    if any(word in text for word in ESCALATE_AR) or any(_whole_word_match(text, word) for word in ESCALATE_EN):
        severity = _shift(severity, 1)
    elif any(word in text for word in DE_ESCALATE_AR) or any(_whole_word_match(text, word) for word in DE_ESCALATE_EN):
        severity = _shift(severity, -1)
    if top in {
        CategoryId.open_manhole,
        CategoryId.exposed_wire,
    } and SEVERITY_ORDER.index(severity) < SEVERITY_ORDER.index(Severity.high):
        severity = Severity.high

    emergency = detect_emergency(description)
    if emergency:
        severity = Severity.critical
    if not description.strip() and category_hint is None:
        summary = "مش قادر أحدد نوع المشكلة من الصورة دلوقتي؛ محتاج وصف بسيط للمشكلة."
    else:
        summary = f'الغالب إنها "{CATEGORY_LABELS[top]}" — {severity.value}، وهتروح لـ{DEPARTMENTS[top]}.'
    return TriageSuggestion(
        options=options,
        severity=severity,
        summary=summary,
        duplicates=[],
        source="fallback",
        emergency=emergency,
    )
