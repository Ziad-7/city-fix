"""Database seeding with realistic demo data."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.auth import hash_password
from app.helpers import now_utc
from app.logic.priority import compute_priority
from app.logic.timeline import incident_timeline_entry, service_timeline_entry
from app.models import (
    ActivityLog,
    AISuggestion,
    Category,
    Department,
    Incident,
    Profile,
    Report,
    ServiceRequest,
    StaffAccount,
    WorkOrder,
)

# ========================================================================
# Teams constant (exported for GET /admin/teams)
# ========================================================================
TEAMS = [
    {"name": "فريق الطرق 1", "department": "صيانة الطرق", "size": 4},
    {"name": "فريق الطرق 2", "department": "صيانة الطرق", "size": 4},
    {"name": "فريق الطرق 3", "department": "صيانة الطرق", "size": 6},
    {"name": "فريق النظافة 1", "department": "هيئة النظافة والتجميل", "size": 5},
    {"name": "فريق النظافة 2", "department": "هيئة النظافة والتجميل", "size": 5},
    {"name": "فريق النظافة 3", "department": "هيئة النظافة والتجميل", "size": 5},
    {"name": "فريق النظافة 4", "department": "هيئة النظافة والتجميل", "size": 5},
    {"name": "فريق الإنارة 1", "department": "إنارة الحي", "size": 3},
    {"name": "فريق الإنارة 2", "department": "إنارة الحي", "size": 3},
    {"name": "فريق الحدائق 1", "department": "حدائق الحي", "size": 4},
    {"name": "فريق الصرف 1", "department": "الصرف الصحي", "size": 5},
    {"name": "فريق الصرف 2", "department": "الصرف الصحي", "size": 5},
]


def seed_db(db: Session) -> None:
    """Seed database with demo data."""
    now = now_utc()
    # Report IDs: FTC-1042 for INC-501 i=0 (demo), then start from FTC-1043 onwards
    report_id_counter = [1043]

    # ========================================================================
    # Departments
    # ========================================================================
    departments = [
        Department(id="roads", name_ar="صيانة الطرق", district="القاهرة · حي مدينة نصر أول"),
        Department(id="sanitation", name_ar="هيئة النظافة والتجميل", district="القاهرة · حي مدينة نصر أول"),
        Department(id="lighting", name_ar="إنارة الحي", district="القاهرة · حي مدينة نصر أول"),
        Department(id="sewage", name_ar="الصرف الصحي", district="القاهرة · حي مدينة نصر أول", external_hotline="175"),
        Department(id="water", name_ar="شركة مياه الشرب", district="القاهرة", external_hotline="125"),
        Department(id="electricity", name_ar="شركة الكهرباء", district="القاهرة", external_hotline="121"),
        Department(id="veterinary", name_ar="الطب البيطري", district="القاهرة · حي مدينة نصر أول"),
        Department(id="parks", name_ar="حدائق الحي", district="القاهرة · حي مدينة نصر أول"),
        Department(id="utilities", name_ar="مرافق الحي", district="القاهرة · حي مدينة نصر أول"),
    ]
    for d in departments:
        db.add(d)
    # PostgreSQL enforces foreign keys per statement: parents must be flushed first.
    db.flush()

    # ========================================================================
    # Categories
    # ========================================================================
    categories_data = [
        ("pothole", "حفرة أو مطب عشوائي", False, "medium", "roads", 5, 4500),
        ("open_manhole", "بالوعة مفتوحة", True, "high", "sewage", 1, 1800),
        ("sewage_overflow", "طفح مجاري", False, "high", "sewage", 2, 6000),
        ("water_pipe_burst", "كسر ماسورة مياه", False, "high", "water", 2, 7500),
        ("garbage", "زبالة متراكمة", False, "medium", "sanitation", 2, 1200),
        ("streetlight_out", "عمود نور مطفي", False, "low", "lighting", 4, 900),
        ("exposed_wire", "سلك كهربا مكشوف", True, "high", "electricity", 1, 2500),
        ("road_obstruction", "إشغالات طريق", False, "low", "utilities", 5, 600),
        ("stray_dogs", "كلاب ضالة", False, "medium", "veterinary", 5, 800),
        ("fallen_tree", "شجرة واقعة أو مايلة", False, "medium", "parks", 3, 2200),
        ("broken_sidewalk", "رصيف مكسور", False, "low", "roads", 7, 3500),
        ("other", "حاجة تانية", False, "low", "utilities", 7, 1000),
    ]
    for cat_id, label, danger, default_sev, dept_id, target_days, cost in categories_data:
        cat = Category(
            id=cat_id,
            label_ar=label,
            danger=danger,
            default_severity=default_sev,
            department_id=dept_id,
            target_days=target_days,
            estimated_cost_egp=cost,
        )
        db.add(cat)

    db.flush()

    # ========================================================================
    # Citizen profiles (demo user + anonymous)
    # ========================================================================
    demo_citizen = Profile(id="citizen-001", phone="+201012345678", name="أحمد محمد", role="citizen")
    db.add(demo_citizen)

    # Anonymous reporter profile for anonymous reports
    anonymous_citizen = Profile(id="citizen-anonymous", phone=None, name="بلاغ بدون اسم", role="citizen")
    db.add(anonymous_citizen)
    db.flush()

    # ========================================================================
    # Staff accounts
    # ========================================================================
    admin_profile = Profile(
        id="admin-001",
        name="سارة محمود",
        role="admin",
        district="القاهرة · حي مدينة نصر أول",
    )
    db.add(admin_profile)
    db.flush()
    admin_account = StaffAccount(
        profile_id="admin-001",
        email="admin@cityfix.demo",
        password_hash=hash_password("FixCity2026!"),
    )
    db.add(admin_account)

    staff_profile = Profile(
        id="staff-001",
        name="م. هشام عادل",
        role="staff",
        district="القاهرة · حي مدينة نصر أول",
    )
    db.add(staff_profile)
    db.flush()
    staff_account = StaffAccount(
        profile_id="staff-001",
        email="roads@cityfix.demo",
        password_hash=hash_password("FixCity2026!"),
        department_id="roads",
    )
    db.add(staff_account)

    # Additional staff accounts per department
    dept_staff = [
        ("sanitation", "staff-sanitation", "نادية علي", "sanitation@cityfix.demo", "القاهرة · حي مدينة نصر أول"),
        ("lighting", "staff-lighting", "محمود أحمد", "lighting@cityfix.demo", "القاهرة · حي مدينة نصر أول"),
        ("sewage", "staff-sewage", "سلام محمد", "sewage@cityfix.demo", "القاهرة · حي مدينة نصر أول"),
        ("water", "staff-water", "حسان علي", "water@cityfix.demo", "القاهرة"),
        ("electricity", "staff-electricity", "صادق محمود", "electricity@cityfix.demo", "القاهرة"),
        ("parks", "staff-parks", "فاطمة الزهراء", "parks@cityfix.demo", "القاهرة · حي مدينة نصر أول"),
        ("utilities", "staff-utilities", "عمر كمال", "utilities@cityfix.demo", "القاهرة · حي مدينة نصر أول"),
        ("veterinary", "staff-vet", "دينا ياسر", "veterinary@cityfix.demo", "القاهرة · حي مدينة نصر أول"),
    ]

    for dept_id, profile_id, name, email, district in dept_staff:
        staff_prof = Profile(
            id=profile_id,
            name=name,
            role="staff",
            district=district,
        )
        db.add(staff_prof)
        db.flush()
        staff_acct = StaffAccount(
            profile_id=profile_id,
            email=email,
            password_hash=hash_password("FixCity2026!"),
            department_id=dept_id,
        )
        db.add(staff_acct)

    db.flush()

    # ========================================================================
    # Incidents (10 from mobile seed + 22 new for coverage)
    # ========================================================================
    incidents_data = [
        # From mobile seed (INC-501..510)
        (
            501,
            "pothole",
            "حفرة في شارع عباس العقاد",
            "شارع عباس العقاد، مدينة نصر",
            30.0562,
            31.3305,
            "in_progress",
            "high",
            2,
            7,
            7,
            "مدرسة النصر الإعدادية",
            "WO-318",
        ),
        (
            502,
            "open_manhole",
            "بالوعة مفتوحة في شارع حسن المأمون",
            "شارع حسن المأمون، مدينة نصر",
            30.0575,
            31.329,
            "assigned",
            "critical",
            30,
            12,
            12,
            None,
            "WO-321",
        ),
        (
            503,
            "streetlight_out",
            "عمود نور مطفي في شارع مكرم عبيد",
            "شارع مكرم عبيد، مدينة نصر",
            30.054,
            31.3335,
            "resolved",
            "low",
            54,
            2,
            2,
            None,
            None,
        ),
        (
            504,
            "garbage",
            "زبالة متراكمة في شارع الطيران",
            "شارع الطيران، مدينة نصر",
            30.059,
            31.335,
            "received",
            "medium",
            5,
            3,
            3,
            None,
            None,
        ),
        (
            505,
            "sewage_overflow",
            "طفح مجاري قدام عمارة ١٢",
            "شارع الحجاز، مدينة نصر",
            30.052,
            31.327,
            "assigned",
            "high",
            40,
            5,
            4,
            None,
            "WO-324",
        ),
        (
            506,
            "water_pipe_burst",
            "كسر ماسورة مياه في شارع الثورة",
            "شارع الثورة، مدينة نصر",
            30.061,
            31.331,
            "in_progress",
            "high",
            20,
            9,
            6,
            None,
            "WO-326",
        ),
        (
            507,
            "exposed_wire",
            "سلك كهربا مكشوف جنب الحديقة",
            "شارع يوسف عباس، مدينة نصر",
            30.055,
            31.338,
            "received",
            "critical",
            1,
            1,
            1,
            "حديقة الأطفال",
            None,
        ),
        (
            508,
            "fallen_tree",
            "شجرة مايلة على الرصيف",
            "شارع مصطفى النحاس، مدينة نصر",
            30.05,
            31.333,
            "resolved",
            "medium",
            100,
            4,
            3,
            None,
            None,
        ),
        (
            509,
            "broken_sidewalk",
            "رصيف مكسور قدام المستشفى",
            "شارع أحمد فخري، مدينة نصر",
            30.058,
            31.326,
            "assigned",
            "medium",
            72,
            6,
            5,
            "مستشفى المبرة",
            None,
        ),
        (
            510,
            "stray_dogs",
            "كلاب ضالة جنب المدرسة",
            "شارع عمر بن الخطاب، مدينة نصر",
            30.053,
            31.33,
            "triaged",
            "medium",
            12,
            3,
            2,
            "مدرسة الشهيد محمود",
            None,
        ),
        # Additional incidents for completeness (INC-511..532: 22 more)
        (
            511,
            "garbage",
            "زبالة في شارع النيل",
            "شارع النيل، مدينة نصر",
            30.0501,
            31.3201,
            "triaged",
            "low",
            60,
            2,
            1,
            None,
            None,
        ),  # 2.5d overdue (target 2d)
        (
            512,
            "pothole",
            "حفر في طريق مكرم عبيد",
            "طريق مكرم عبيد، مدينة نصر",
            30.0571,
            31.3381,
            "triaged",
            "medium",
            150,
            1,
            1,
            None,
            None,
        ),  # 6.25d overdue (target 5d)
        (
            513,
            "streetlight_out",
            "إنارة مطفأة في شارع البطل أحمد",
            "شارع البطل أحمد، مدينة نصر",
            30.0521,
            31.3251,
            "triaged",
            "low",
            18,
            2,
            2,
            None,
            None,
        ),
        (
            514,
            "water_pipe_burst",
            "تسريب مياه في شارع الرحاب",
            "شارع الرحاب، مدينة نصر",
            30.0631,
            31.3351,
            "assigned",
            "high",
            8,
            4,
            3,
            None,
            None,
        ),
        (
            515,
            "open_manhole",
            "بالوعة بدون غطاء",
            "ميدان رابعة العدوية، مدينة نصر",
            30.0481,
            31.3321,
            "in_progress",
            "critical",
            2,
            8,
            8,
            None,
            "WO-327",
        ),
        (
            516,
            "exposed_wire",
            "سلك كهرباء مكشوف في الشارع",
            "شارع ذاكر حسين، مدينة نصر",
            30.063,
            31.325,
            "received",
            "high",
            4,
            2,
            1,
            None,
            None,
        ),
        (
            517,
            "road_obstruction",
            "إشغالات في شارع البناء",
            "شارع البناء، مدينة نصر",
            30.051,
            31.328,
            "closed",
            "low",
            216,
            1,
            1,
            None,
            None,
        ),  # 9d, closed
        (
            518,
            "sewage_overflow",
            "طفح مجاري في شارع الحي",
            "شارع الحي السابع، مدينة نصر",
            30.048,
            31.340,
            "in_progress",
            "high",
            48,
            3,
            2,
            None,
            "WO-328",
        ),  # 2d overdue
        (
            519,
            "garbage",
            "تجمع القمامة في الزاوية",
            "شارع الحي العاشر، مدينة نصر",
            30.062,
            31.320,
            "received",
            "medium",
            1,
            1,
            1,
            None,
            None,
        ),
        (
            520,
            "broken_sidewalk",
            "رصيف محطوم بالقرب من السوق",
            "سوق مدينة نصر، مدينة نصر",
            30.0545,
            31.3340,
            "triaged",
            "low",
            10,
            2,
            2,
            None,
            None,
        ),
        (
            521,
            "pothole",
            "حفرة عميقة في الشارع الرئيسي",
            "الشارع الرئيسي، مدينة نصر",
            30.0588,
            31.3298,
            "assigned",
            "medium",
            60,
            4,
            3,
            None,
            "WO-329",
        ),  # ~2.5d overdue
        (
            522,
            "stray_dogs",
            "كلاب شرسة في المنطقة",
            "حديقة مدينة نصر، مدينة نصر",
            30.0523,
            31.3310,
            "received",
            "medium",
            2,
            1,
            1,
            None,
            None,
        ),
        (
            523,
            "fallen_tree",
            "شجرة سقطت على السور",
            "شارع الشجرة، مدينة نصر",
            30.0598,
            31.3365,
            "resolved",
            "low",
            260,
            2,
            1,
            None,
            None,
        ),  # 7-14d ago
        (
            524,
            "streetlight_out",
            "عدة أعمدة نور مطفأة",
            "شارع الإنارة، مدينة نصر",
            30.0509,
            31.3245,
            "in_progress",
            "low",
            36,
            3,
            2,
            None,
            "WO-330",
        ),
        (
            525,
            "water_pipe_burst",
            "تسرب كبير من الماسورة",
            "شارع الماء، مدينة نصر",
            30.0629,
            31.3275,
            "assigned",
            "critical",
            6,
            5,
            4,
            None,
            "WO-331",
        ),  # critical
        (
            526,
            "open_manhole",
            "بالوعة قديمة بدون تغطية",
            "شارع القديم، مدينة نصر",
            30.0480,
            31.3355,
            "received",
            "high",
            9,
            3,
            2,
            None,
            None,
        ),
        (
            527,
            "garbage",
            "نفايات متراكمة في الزقاق",
            "الزقاق القديم، مدينة نصر",
            30.0535,
            31.3218,
            "triaged",
            "medium",
            12,
            2,
            2,
            None,
            None,
        ),
        (
            528,
            "pothole",
            "حفرة جديدة ظهرت",
            "شارع جديد، مدينة نصر",
            30.0610,
            31.3340,
            "resolved",
            "medium",
            192,
            3,
            2,
            None,
            None,
        ),  # 8d ago (outside 7d window)
        (
            529,
            "exposed_wire",
            "سلك مكشوف خطير جداً",
            "شارع الخطر، مدينة نصر",
            30.0515,
            31.3290,
            "assigned",
            "critical",
            3,
            6,
            5,
            None,
            "WO-332",
        ),  # critical
        (
            530,
            "sewage_overflow",
            "مياه ملوثة في الشارع",
            "شارع الصرف، مدينة نصر",
            30.0578,
            31.3218,
            "in_progress",
            "high",
            24,
            4,
            3,
            None,
            "WO-333",
        ),
        (
            531,
            "road_obstruction",
            "مواد بناء تسد الطريق",
            "شارع البناء الجديد، مدينة نصر",
            30.0492,
            31.3338,
            "received",
            "medium",
            7,
            2,
            1,
            None,
            None,
        ),
        (
            532,
            "other",
            "حاجة تانية في الشارع",
            "شارع متنوع، مدينة نصر",
            30.0635,
            31.3255,
            "closed",
            "low",
            240,
            2,
            1,
            None,
            None,
        ),
        (
            533,
            "garbage",
            "نفايات في الزقاق الجديد",
            "زقاق البستان، مدينة نصر",
            30.0515,
            31.3295,
            "resolved",
            "low",
            72,
            5,
            3,
            None,
            None,
        ),  # 3d ago (within 7d)
        (
            534,
            "streetlight_out",
            "عمود نور مطفي آخر",
            "شارع النيل الجديد، مدينة نصر",
            30.0555,
            31.3215,
            "resolved",
            "low",
            120,
            8,
            4,
            None,
            None,
        ),  # 5d ago (within 7d)
    ]

    for row in incidents_data:
        n, cat_id, title, address, lat, lng, status, severity, age_h, followers, reporters, sensitive, wo_id = row
        created = now - timedelta(hours=age_h)
        days_open = max(0, int(age_h / 24))

        cat = db.query(Category).filter_by(id=cat_id).first()
        dept = db.query(Department).filter_by(id=cat.department_id).first()

        priority = compute_priority(
            {
                "severity": severity,
                "near_sensitive_place": bool(sensitive),
                "reporters": reporters,
                "days_open": days_open,
                "target_days": cat.target_days,
                "area_underserved": False,
            }
        )

        # Build timeline
        timeline = []
        status_order = ["received", "triaged", "assigned", "in_progress", "resolved", "closed"]
        up_to = status_order.index(status) if status in status_order else 0
        for i, st in enumerate(status_order[: up_to + 1]):
            # For resolved incidents, use specific resolution times instead of proportional
            if st == "resolved" and n in [503, 508, 523, 528, 533, 534]:
                # INC-503: 6h ago, INC-508: 1d ago, INC-523: 10d ago, INC-528: 8d ago, INC-533: 3d ago, INC-534: 5d ago
                if n == 503:
                    at = now - timedelta(hours=6)
                elif n == 508:
                    at = now - timedelta(days=1)
                elif n == 523:
                    at = now - timedelta(days=10)
                elif n == 528:
                    at = now - timedelta(days=8)
                elif n == 533:
                    at = now - timedelta(days=3)
                elif n == 534:
                    at = now - timedelta(days=5)
            else:
                at = created + timedelta(seconds=(now - created).total_seconds() * i / max(1, up_to))
            entry = incident_timeline_entry(st, cat.label_ar, severity, dept.name_ar, at)
            timeline.append(entry)

        incident = Incident(
            id=f"INC-{n}",
            category_id=cat_id,
            title=title,
            severity=severity,
            status=status,
            department_id=dept.id,
            estimated_cost_egp=cat.estimated_cost_egp,
            priority_score=priority["score"],
            priority_factors=priority["factors"],
            followers_count=followers,
            lat=lat,
            lng=lng,
            address=address,
            sensitive_place=sensitive,
            area_underserved=False,
            work_order_id=wo_id,
            created_at=created,
            updated_at=created,
        )
        db.add(incident)
        db.flush()

        # Add activity log entries for timeline
        for entry in timeline:
            activity = ActivityLog(
                entity_type="incident",
                entity_id=incident.id,
                status=entry["status"],
                note=entry["note"],
                actor=entry["actor"],
                kind="status_change",
                at=datetime.fromisoformat(entry["at"].replace("Z", "+00:00")),
            )
            db.add(activity)

        # Add linked reports (with some anonymous)
        for i in range(reporters):
            if n == 501 and i == 0:
                report_seq = 1042  # Demo report FTC-1042 → citizen-001
                is_anonymous = False
            else:
                report_seq = report_id_counter[0]
                report_id_counter[0] += 1
                # Make some reports anonymous (about 1 in 4)
                is_anonymous = report_seq % 4 == 0

            # Use anonymous profile for anonymous reports
            if is_anonymous:
                reporter_id = anonymous_citizen.id
            elif n == 501 and i == 0:
                reporter_id = demo_citizen.id  # FTC-1042 is by demo citizen
            else:
                # Create/reuse citizen profiles (pool of ~15)
                reporter_id = f"citizen-{((n - 501) * reporters + i) % 15}"
                citizen = db.query(Profile).filter_by(id=reporter_id).first()
                if not citizen:
                    citizen = Profile(id=reporter_id, role="citizen")
                    db.add(citizen)
                    db.flush()  # Ensure profile is saved before report references it

            report = Report(
                id=f"FTC-{report_seq:04d}",
                reporter_id=reporter_id,
                incident_id=incident.id,
                category_id=cat_id,
                description="البلاغ عن هذه المشكلة" if not is_anonymous else "بلاغ بدون اسم",
                photo_paths=[],
                lat=lat,
                lng=lng,
                address=address,
                anonymous=is_anonymous,
                blur_faces=False,
                created_at=created,
            )
            db.add(report)

    db.flush()

    # ========================================================================
    # Work Orders (15 with all 4 statuses, every done WO linked to resolved incident)
    # ========================================================================
    # Format: (wo_id, incident_id, dept_name, team, team_size, supervisor, status, due_at, cost)
    work_orders_data = [
        # Status: in_progress (5)
        (
            "WO-318",
            "INC-501",
            "صيانة الطرق",
            "فريق الطرق 3",
            6,
            "م. هشام عادل",
            "in_progress",
            now - timedelta(days=1),
            4500,
        ),
        (
            "WO-326",
            "INC-506",
            "شركة مياه الشرب",
            None,
            None,
            "بلّغنا الشركة · الخط الساخن 125",
            "in_progress",
            now - timedelta(hours=12),
            7500,
        ),
        (
            "WO-327",
            "INC-515",
            "الصرف الصحي",
            "فريق الصرف 1",
            5,
            "محمد سالم",
            "in_progress",
            now - timedelta(hours=6),
            1800,
        ),
        (
            "WO-330",
            "INC-524",
            "إنارة الحي",
            "فريق الإنارة 2",
            3,
            "سامي علي",
            "in_progress",
            now - timedelta(hours=8),
            900,
        ),
        (
            "WO-333",
            "INC-530",
            "الصرف الصحي",
            "فريق الصرف 2",
            5,
            "خالد حسن",
            "in_progress",
            now - timedelta(hours=4),
            6000,
        ),
        # Status: assigned (5)
        ("WO-321", "INC-502", "الصرف الصحي", "فريق الصرف 1", 5, "محمد سالم", "assigned", now + timedelta(days=1), 1800),
        ("WO-324", "INC-505", "الصرف الصحي", "فريق الصرف 2", 5, "خالد حسن", "assigned", now, 6000),
        ("WO-328", "INC-518", "الصرف الصحي", "فريق الصرف 2", 5, "خالد حسن", "assigned", now + timedelta(days=2), 6000),
        (
            "WO-329",
            "INC-521",
            "صيانة الطرق",
            "فريق الطرق 2",
            4,
            "علي حسين",
            "assigned",
            now - timedelta(hours=10),
            4500,
        ),
        (
            "WO-331",
            "INC-525",
            "شركة مياه الشرب",
            None,
            None,
            "الخط الساخن 125",
            "assigned",
            now + timedelta(hours=6),
            7500,
        ),
        # Status: open (2 with incidents assigned)
        ("WO-335", "INC-531", "صيانة الطرق", "فريق الطرق 3", 6, "فاطمة محمود", "open", now + timedelta(days=3), 3500),
        (
            "WO-336",
            "INC-527",
            "هيئة النظافة والتجميل",
            "فريق النظافة 2",
            5,
            "نور أحمد",
            "open",
            now + timedelta(days=2),
            2000,
        ),
        # Status: done (3 linked to resolved incidents)
        ("WO-310", "INC-503", "إنارة الحي", "فريق الإنارة 1", 3, "صالح محمد", "done", now - timedelta(days=3), 900),
        ("WO-311", "INC-508", "حدائق الحي", "فريق الحدائق 1", 4, "أمينة علي", "done", now - timedelta(days=5), 2200),
        ("WO-312", "INC-528", "صيانة الطرق", "فريق الطرق 1", 4, "م. هشام عادل", "done", now - timedelta(days=6), 4500),
    ]

    for idx, wo_data in enumerate(work_orders_data):
        wo_id = wo_data[0]
        incident_id = wo_data[1] if wo_data[1] else None
        dept_name = wo_data[2]
        team = wo_data[3]
        team_size = wo_data[4]
        supervisor = wo_data[5]
        status = wo_data[6]
        due_at = wo_data[7]
        cost = wo_data[8]

        # Find department by name
        dept = db.query(Department).filter_by(name_ar=dept_name).first()

        # Determine if external

        tasks = []
        if "طرق" in dept_name or "صيانة" in dept_name:
            tasks = [
                {"label": "تأمين الموقع وتحويل المرور", "done": status in ["in_progress", "done"]},
                {"label": "تكسير الحفرة وتنضيفها", "done": status == "done"},
                {"label": "ردم وسفلتة", "done": status == "done"},
                {"label": "رفع صور بعد الإصلاح", "done": status == "done"},
            ]
        elif "نظافة" in dept_name:
            tasks = [
                {"label": "تجميع النفايات", "done": status in ["in_progress", "done"]},
                {"label": "تنظيف المنطقة", "done": status in ["in_progress", "done"]},
                {"label": "المعاينة النهائية", "done": status == "done"},
            ]
        elif "حدائق" in dept_name:
            tasks = [
                {"label": "قص الأشجار", "done": status in ["in_progress", "done"]},
                {"label": "تنظيف الحديقة", "done": status == "done"},
            ]
        else:
            tasks = [
                {"label": "المعاينة", "done": True},
                {"label": "الإصلاح", "done": status in ["in_progress", "done"]},
                {"label": "الاختبار", "done": status == "done"},
            ]

        wo = WorkOrder(
            id=wo_id,
            incident_id=incident_id,
            department_id=dept.id,
            team=team,
            team_size=team_size,
            supervisor=supervisor,
            status=status,
            due_at=due_at,
            estimated_cost_egp=cost,
            tasks=tasks,
            created_at=now - timedelta(days=2),
            updated_at=now,
            resolved_at=now if status == "done" else None,
        )
        db.add(wo)
        db.flush()

        # Add activity log entries for status progression
        update_statuses = ["open"]
        if status in ["assigned", "in_progress", "done"]:
            update_statuses.append("assigned")
        if status in ["in_progress", "done"]:
            update_statuses.append("in_progress")
        if status == "done":
            update_statuses.append("done")

        for i, st in enumerate(update_statuses):
            at = now - timedelta(days=2) + timedelta(hours=i * 12)
            notes_map = {
                "open": f"اتسلّم أمر الشغل · {supervisor}",
                "assigned": f"اتوزّع على {team} · {supervisor}",
                "in_progress": f"الفريق بدأ الشغل · {supervisor}",
                "done": f"اتحلّت والصور اترفعت · {supervisor}",
            }
            activity = ActivityLog(
                entity_type="work_order",
                entity_id=wo_id,
                status=st,
                note=notes_map.get(st, f"تحديث إلى {st}"),
                actor=supervisor or "النظام",
                kind="status_change",
                at=at,
            )
            db.add(activity)

    db.flush()

    # ========================================================================
    # Service Requests (9 total)
    # ========================================================================
    days = [now.date() + timedelta(days=i) for i in range(1, 7)]
    service_requests_data = [
        (
            "SRV-1998",
            "citizen-004",
            "bulky_waste",
            {"items": ["كنبة قديمة"], "day": days[0].isoformat(), "slot": "morning", "payment": "cash"},
            "resolved",
            now - timedelta(days=1),
            True,
        ),
        (
            "SRV-2001",
            "citizen-001",
            "bulky_waste",
            {"items": ["كنبة", "تلاجة قديمة"], "day": days[0].isoformat(), "slot": "morning", "payment": "cash"},
            "assigned",
            now - timedelta(hours=5),
            False,
        ),
        (
            "SRV-2002",
            "citizen-002",
            "tree_maintenance",
            {"items": ["قص فروع الشجرة"], "day": days[1].isoformat(), "slot": "afternoon", "payment": "fawry"},
            "received",
            now - timedelta(hours=3),
            True,
        ),
        (
            "SRV-2003",
            "citizen-003",
            "bulky_waste",
            {"items": ["خزانة", "مرتبة قديمة"], "day": days[1].isoformat(), "slot": "morning", "payment": "instapay"},
            "in_progress",
            now - timedelta(hours=2),
            True,
        ),
        (
            "SRV-2004",
            "citizen-005",
            "tree_maintenance",
            {"items": ["قص وتشذيب"], "day": days[2].isoformat(), "slot": "morning", "payment": "wallet"},
            "assigned",
            now - timedelta(hours=1),
            False,
        ),
        (
            "SRV-2005",
            "citizen-006",
            "bulky_waste",
            {"items": ["ثلاجة", "غسالة"], "day": days[3].isoformat(), "slot": "afternoon", "payment": "cash"},
            "received",
            now - timedelta(hours=8),
            False,
        ),
        (
            "SRV-2006",
            "citizen-007",
            "tree_maintenance",
            {"items": ["إزالة شجرة"], "day": days[4].isoformat(), "slot": "morning", "payment": "fawry"},
            "in_progress",
            now - timedelta(hours=6),
            True,
        ),
        (
            "SRV-2007",
            "citizen-008",
            "bulky_waste",
            {"items": ["خشب", "معادن"], "day": days[5].isoformat(), "slot": "afternoon", "payment": "instapay"},
            "assigned",
            now - timedelta(hours=4),
            True,
        ),
        (
            "SRV-2008",
            "citizen-009",
            "tree_maintenance",
            {"items": ["صيانة الحديقة"], "day": days[0].isoformat(), "slot": "morning", "payment": "cash"},
            "received",
            now - timedelta(hours=2),
            False,
        ),
    ]

    for srv_id, citizen_id, srv_type, details, status, created, paid in service_requests_data:
        citizen = db.query(Profile).filter_by(id=citizen_id).first()
        if not citizen:
            citizen = Profile(id=citizen_id, role="citizen")
            db.add(citizen)
            db.flush()

        sr = ServiceRequest(
            id=srv_id,
            citizen_id=citizen_id,
            service_type=srv_type,
            details=details,
            lat=30.056,
            lng=31.33,
            address="شارع عباس العقاد، مدينة نصر",
            status=status,
            paid=paid,
            created_at=created,
        )
        db.add(sr)
        db.flush()

        # Add timeline entry
        entry = service_timeline_entry(status, created)
        activity = ActivityLog(
            entity_type="service_request",
            entity_id=srv_id,
            status=status,
            note=entry["note"],
            actor=entry["actor"],
            kind="status_change",
            at=created,
        )
        db.add(activity)

    db.flush()

    # ========================================================================
    # AI Suggestions (triage for received + first 2 triaged incidents)
    # ========================================================================
    ai_suggestion_counter = [1]

    # Get received and triaged incidents
    received_incidents = db.query(Incident).filter_by(status="received").all()
    triaged_incidents = db.query(Incident).filter_by(status="triaged").all()

    # All received get confirmed=False; first 2 triaged get confirmed=True
    triaged_to_confirm = triaged_incidents[:2]

    for incident in received_incidents:
        # Get first linked report for this incident
        first_report = db.query(Report).filter_by(incident_id=incident.id).order_by(Report.created_at).first()

        actual_cat = incident.category_id
        category = db.query(Category).filter_by(id=actual_cat).first()

        # Build options: actual category + 2 plausible alternatives
        options = [{"categoryId": actual_cat, "confidence": 0.82}]
        other_cats = db.query(Category).filter(Category.id != actual_cat).limit(2).all()
        confidences = [0.11, 0.05]
        for alt_cat, conf in zip(other_cats, confidences):
            options.append({"categoryId": alt_cat.id, "confidence": conf})

        ai_suggestion = AISuggestion(
            id=f"AS-{ai_suggestion_counter[0]:04d}",
            report_id=first_report.id if first_report else None,
            kind="triage",
            payload={
                "options": options,
                "severity": incident.severity,
                "summary": f"تصنيف آلي: {category.label_ar}",
                "source": "fallback",
                "confirmed": False,
            },
            model="fallback",
            created_at=incident.created_at + timedelta(minutes=5),
        )
        db.add(ai_suggestion)
        ai_suggestion_counter[0] += 1

    for incident in triaged_to_confirm:
        first_report = db.query(Report).filter_by(incident_id=incident.id).order_by(Report.created_at).first()

        actual_cat = incident.category_id
        category = db.query(Category).filter_by(id=actual_cat).first()

        options = [{"categoryId": actual_cat, "confidence": 0.85}]
        other_cats = db.query(Category).filter(Category.id != actual_cat).limit(2).all()
        confidences = [0.10, 0.05]
        for alt_cat, conf in zip(other_cats, confidences):
            options.append({"categoryId": alt_cat.id, "confidence": conf})

        ai_suggestion = AISuggestion(
            id=f"AS-{ai_suggestion_counter[0]:04d}",
            report_id=first_report.id if first_report else None,
            kind="triage",
            payload={
                "options": options,
                "severity": incident.severity,
                "summary": f"تصنيف آلي مؤكد: {category.label_ar}",
                "source": "fallback",
                "confirmed": True,
            },
            model="fallback",
            created_at=incident.created_at + timedelta(minutes=10),
        )
        db.add(ai_suggestion)
        ai_suggestion_counter[0] += 1

    db.commit()
