"""Database seeding with realistic demo data."""
from datetime import datetime, timedelta
import json
from sqlalchemy.orm import Session
from app.models import (
    Profile,
    Department,
    Category,
    Incident,
    Report,
    ServiceRequest,
    WorkOrder,
    ActivityLog,
    StaffAccount,
    IncidentStatusEnum,
    SeverityEnum,
    WorkOrderStatusEnum,
)
from app.logic.priority import compute_priority
from app.logic.timeline import incident_timeline_entry, service_timeline_entry
from app.auth import hash_password


def seed_db(db: Session) -> None:
    """Seed database with demo data."""
    now = datetime.utcnow()
    report_counter = [1043]  # Use list to allow modification in loop

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
    # Citizen profile (demo user)
    # ========================================================================
    demo_citizen = Profile(id="citizen-001", phone="+201012345678", name="أحمد محمد", role="citizen")
    db.add(demo_citizen)

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
    admin_account = StaffAccount(
        profile_id="admin-001",
        email="admin@fixthecity.demo",
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
    staff_account = StaffAccount(
        profile_id="staff-001",
        email="roads@fixthecity.demo",
        password_hash=hash_password("FixCity2026!"),
        department_id="roads",
    )
    db.add(staff_account)

    db.flush()

    # ========================================================================
    # Incidents (10 from mobile seed + more for completeness)
    # ========================================================================
    incidents_data = [
        # From mobile seed
        (501, "pothole", "حفرة في شارع عباس العقاد", "شارع عباس العقاد، مدينة نصر", 30.0562, 31.3305, "in_progress", "high", 2, 7, 7, "مدرسة النصر الإعدادية", "WO-318"),
        (502, "open_manhole", "بالوعة مفتوحة في شارع حسن المأمون", "شارع حسن المأمون، مدينة نصر", 30.0575, 31.329, "assigned", "critical", 30, 12, 12, None, "WO-321"),
        (503, "streetlight_out", "عمود نور مطفي في شارع مكرم عبيد", "شارع مكرم عبيد، مدينة نصر", 30.054, 31.3335, "resolved", "low", 54, 2, 2, None, None),
        (504, "garbage", "زبالة متراكمة في شارع الطيران", "شارع الطيران، مدينة نصر", 30.059, 31.335, "received", "medium", 5, 3, 3, None, None),
        (505, "sewage_overflow", "طفح مجاري قدام عمارة ١٢", "شارع الحجاز، مدينة نصر", 30.052, 31.327, "assigned", "high", 40, 5, 4, None, "WO-324"),
        (506, "water_pipe_burst", "كسر ماسورة مياه في شارع الثورة", "شارع الثورة، مدينة نصر", 30.061, 31.331, "in_progress", "high", 20, 9, 6, None, "WO-326"),
        (507, "exposed_wire", "سلك كهربا مكشوف جنب الحديقة", "شارع يوسف عباس، مدينة نصر", 30.055, 31.338, "received", "critical", 1, 1, 1, "حديقة الأطفال", None),
        (508, "fallen_tree", "شجرة مايلة على الرصيف", "شارع مصطفى النحاس، مدينة نصر", 30.05, 31.333, "resolved", "medium", 100, 4, 3, None, None),
        (509, "broken_sidewalk", "رصيف مكسور قدام المستشفى", "شارع أحمد فخري، مدينة نصر", 30.058, 31.326, "assigned", "medium", 72, 6, 5, "مستشفى المبرة", None),
        (510, "stray_dogs", "كلاب ضالة جنب المدرسة", "شارع عمر بن الخطاب، مدينة نصر", 30.053, 31.33, "triaged", "medium", 12, 3, 2, "مدرسة الشهيد محمود", None),
        # Additional incidents for completeness (INC-511+)
        (511, "garbage", "زبالة في شارع النيل", "شارع النيل، مدينة نصر", 30.0501, 31.3201, "received", "low", 6, 2, 1, None, None),
        (512, "pothole", "حفر في طريق مكرم عبيد", "طريق مكرم عبيد، مدينة نصر", 30.0571, 31.3381, "received", "medium", 3, 1, 1, None, None),
        (513, "streetlight_out", "إنارة مطفأة في شارع البطل أحمد", "شارع البطل أحمد، مدينة نصر", 30.0521, 31.3251, "triaged", "low", 18, 2, 2, None, None),
        (514, "water_pipe_burst", "تسريب مياه في شارع الرحاب", "شارع الرحاب، مدينة نصر", 30.0631, 31.3351, "assigned", "high", 8, 4, 3, None, None),
        (515, "open_manhole", "بالوعة بدون غطاء", "ميدان رابعة العدوية، مدينة نصر", 30.0481, 31.3321, "in_progress", "critical", 2, 8, 8, None, "WO-327"),
    ]

    for row in incidents_data:
        n, cat_id, title, address, lat, lng, status, severity, age_h, followers, reporters, sensitive, wo_id = row
        created_ms = (now - timedelta(hours=age_h)).timestamp() * 1000
        created = datetime.fromtimestamp(created_ms / 1000)
        days_open = max(0, int(age_h / 24))

        cat = db.query(Category).filter_by(id=cat_id).first()
        dept = db.query(Department).filter_by(id=cat.department_id).first()

        priority = compute_priority({
            "severity": severity,
            "near_sensitive_place": bool(sensitive),
            "reporters": reporters,
            "days_open": days_open,
            "target_days": cat.target_days,
            "area_underserved": False,
        })

        # Build timeline
        timeline = []
        status_order = ["received", "triaged", "assigned", "in_progress", "resolved", "closed"]
        up_to = status_order.index(status) if status in status_order else 0
        for i, st in enumerate(status_order[:up_to + 1]):
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

        # Add linked reports
        for i in range(reporters):
            if n == 501 and i == 0:
                report_seq = 1042  # Demo report
            else:
                report_seq = report_counter[0]
                report_counter[0] += 1
            report = Report(
                id=f"FTC-{report_seq:04d}",
                reporter_id=demo_citizen.id if n == 501 and i == 0 else f"citizen-{n}-{i}",
                incident_id=incident.id,
                category_id=cat_id,
                description="البلاغ عن هذه المشكلة",
                photo_paths=[],
                lat=lat,
                lng=lng,
                address=address,
                anonymous=False,
                blur_faces=False,
                created_at=created,
            )
            db.add(report)

    db.flush()

    # ========================================================================
    # Work Orders
    # ========================================================================
    work_orders_data = [
        ("WO-318", "INC-501", "صيانة الطرق", "فريق الطرق 1", 3, "أحمد على", "in_progress", now - timedelta(days=1), 4500),
        ("WO-321", "INC-502", "الصرف الصحي", "فريق الصرف 1", 2, "محمد سالم", "assigned", now + timedelta(days=1), 1800),
        ("WO-324", "INC-505", "الصرف الصحي", "فريق الصرف 2", 3, "خالد حسن", "in_progress", now, 6000),
        ("WO-326", "INC-506", "شركة مياه الشرب", "فريق المياه 1", 4, "علي محمود", "in_progress", now - timedelta(hours=12), 7500),
        ("WO-327", "INC-515", "الصرف الصحي", "فريق الصرف 1", 2, "محمد سالم", "in_progress", now - timedelta(hours=6), 1800),
    ]

    for wo_id, incident_id, dept_name, team, team_size, supervisor, status, due_at, cost in work_orders_data:
        dept = db.query(Department).filter_by(name_ar=dept_name).first()
        tasks = [
            {"label": "المعاينة", "done": True},
            {"label": "جلب المواد", "done": True if status != "open" else False},
            {"label": "التنفيذ", "done": status == "done"},
            {"label": "التسليم", "done": status == "done"},
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

        # Add updates
        update_statuses = ["open", "assigned"] if status in ["open", "assigned"] else ["open", "assigned", "in_progress"]
        if status == "done":
            update_statuses.append("done")

        for i, st in enumerate(update_statuses):
            at = now - timedelta(days=2) + timedelta(hours=i * 8)
            activity = ActivityLog(
                entity_type="work_order",
                entity_id=wo_id,
                status=st,
                note=f"تحديث الحالة إلى {st}",
                actor=supervisor or "النظام",
                kind="status_change",
                at=at,
            )
            db.add(activity)

    db.flush()

    # ========================================================================
    # Service Requests
    # ========================================================================
    next_day = (now + timedelta(days=1)).date().isoformat()
    service_requests_data = [
        ("SRV-2001", "citizen-001", "bulky_waste", {"items": ["كنبة", "تلاجة قديمة"], "day": next_day, "slot": "morning", "payment": "cash"}, "assigned", now - timedelta(hours=5)),
        ("SRV-2002", "citizen-002", "tree_maintenance", {"items": ["قص فروع"], "day": next_day, "slot": "afternoon", "payment": "fawry"}, "received", now - timedelta(hours=3)),
        ("SRV-2003", "citizen-003", "bulky_waste", {"items": ["خزانة", "مرتبة"], "day": next_day, "slot": "morning", "payment": "instapay"}, "triaged", now - timedelta(hours=2)),
    ]

    for srv_id, citizen_id, srv_type, details, status, created in service_requests_data:
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

    db.commit()
