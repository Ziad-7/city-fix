from app.analytics_schemas import OptimizeRoutesInput
from app.logic.route_optimizer import optimize_pickups
from app.models import Profile, RecyclingPickup


def test_optimizer_partitions_pickups_without_persisting_dispatch(db):
    profile = Profile(id="optimizer-citizen", role="citizen")
    db.add(profile)
    picks = [
        RecyclingPickup(
            id=f"P{i}",
            citizen_id=profile.id,
            items=[{"estimatedKg": 1.25}],
            lat=30.0,
            lng=31.0 + i * 0.01,
            address="hidden",
            district="D",
            day="2026-10-23",
            slot="morning",
            mode="free",
            status="requested",
        )
        for i in range(2)
    ]
    db.add_all(picks)
    db.flush()
    request = OptimizeRoutesInput(
        pickupIds=[p.id for p in picks], depot={"lat": 30.0, "lng": 31.0}, vehicleCount=1, capacityKg=2.5
    )
    result = optimize_pickups(db, {"role": "admin"}, request)
    partition = [
        *result["unassignedPickupIds"],
        *(pickup_id for route in result["routes"] for pickup_id in route["pickupIds"]),
    ]
    assert sorted(partition) == ["P0", "P1"]
    assert all(p.status == "requested" and p.collector_id is None for p in picks)


def test_optimizer_rejects_staff_before_exposing_pickup_ids(db):
    import pytest
    from fastapi import HTTPException

    request = OptimizeRoutesInput(pickupIds=["missing"], depot={"lat": 0, "lng": 0}, vehicleCount=1, capacityKg=1)
    with pytest.raises(HTTPException) as error:
        optimize_pickups(db, {"role": "staff"}, request)
    assert error.value.status_code == 403


def test_optimizer_floors_capacity_and_rejects_partial_missing_weight(db):
    import pytest
    from fastapi import HTTPException

    profile = Profile(id="weight-citizen", role="citizen")
    db.add(profile)
    pickup = RecyclingPickup(
        id="WEIGHT",
        citizen_id=profile.id,
        items=[{"estimatedKg": 1.0005}],
        lat=30.0,
        lng=31.0,
        address="hidden",
        district="D",
        day="2026-10-23",
        slot="morning",
        mode="free",
        status="requested",
    )
    db.add(pickup)
    db.flush()
    request = OptimizeRoutesInput(
        pickupIds=[pickup.id], depot={"lat": 30, "lng": 31}, vehicleCount=1, capacityKg=1.0005
    )
    result = optimize_pickups(db, {"role": "admin"}, request)
    assert result["unassignedPickupIds"] == [pickup.id]
    pickup.items = [{"estimatedKg": 2}, {"materialId": "glass"}]
    db.flush()
    with pytest.raises(HTTPException) as error:
        optimize_pickups(db, {"role": "admin"}, request)
    assert error.value.status_code == 422


def test_route_distance_includes_rounded_legs_from_and_back_to_depot(db):
    from app.logic.duplicates import haversine_m

    profile = Profile(id="distance-citizen", role="citizen")
    pickup = RecyclingPickup(
        id="DISTANCE",
        citizen_id=profile.id,
        items=[{"estimatedKg": 1}],
        lat=30.01,
        lng=31.02,
        address="hidden",
        district="D",
        day="2026-10-23",
        slot="morning",
        mode="free",
        status="requested",
    )
    db.add_all([profile, pickup])
    db.flush()
    depot = {"lat": 30.0, "lng": 31.0}
    request = OptimizeRoutesInput(pickupIds=[pickup.id], depot=depot, vehicleCount=1, capacityKg=2)
    result = optimize_pickups(db, {"role": "admin"}, request)
    route = result["routes"][0]
    expected = round(haversine_m(depot["lat"], depot["lng"], pickup.lat, pickup.lng)) * 2
    assert route["distanceMeters"] == expected
    assert result["totalDistanceMeters"] == expected


def test_heavy_pickup_is_explicitly_unassigned_and_assignment_state_is_unchanged(db):
    profile = Profile(id="heavy-citizen", role="citizen")
    light = RecyclingPickup(
        id="LIGHT",
        citizen_id=profile.id,
        items=[{"estimatedKg": 1}],
        lat=30,
        lng=31,
        address="hidden",
        district="D",
        day="2026-10-23",
        slot="morning",
        mode="free",
        status="requested",
    )
    heavy = RecyclingPickup(
        id="HEAVY",
        citizen_id=profile.id,
        items=[{"estimatedKg": 3}],
        lat=30.01,
        lng=31.01,
        address="hidden",
        district="D",
        day="2026-10-23",
        slot="morning",
        mode="free",
        status="requested",
    )
    db.add_all([profile, light, heavy])
    db.flush()
    request = OptimizeRoutesInput(
        pickupIds=[light.id, heavy.id], depot={"lat": 30, "lng": 31}, vehicleCount=1, capacityKg=2
    )
    result = optimize_pickups(db, {"role": "admin"}, request)
    assert result["unassignedPickupIds"] == ["HEAVY"]
    assert [*result["unassignedPickupIds"], *(item for route in result["routes"] for item in route["pickupIds"])] == [
        "HEAVY",
        "LIGHT",
    ]
    assert light.status == heavy.status == "requested"
    assert light.collector_id is None and heavy.collector_id is None


def test_optimizer_missing_dependency_returns_503_before_data_lookup(db, monkeypatch):
    import builtins

    import pytest
    from fastapi import HTTPException

    original_import = builtins.__import__

    def unavailable(name, *args, **kwargs):
        if name.startswith("ortools"):
            raise ModuleNotFoundError("ortools missing")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", unavailable)
    request = OptimizeRoutesInput(pickupIds=["missing"], depot={"lat": 0, "lng": 0}, vehicleCount=1, capacityKg=1)
    with pytest.raises(HTTPException) as error:
        optimize_pickups(db, {"role": "admin"}, request)
    assert error.value.status_code == 503


def test_optimizer_changed_assignment_and_invalid_pickup_coordinates_have_contract_errors(db):
    import pytest
    from fastapi import HTTPException

    profile = Profile(id="invalid-citizen", role="citizen")
    assigned = RecyclingPickup(
        id="ASSIGNED",
        citizen_id=profile.id,
        items=[{"estimatedKg": 1}],
        lat=30,
        lng=31,
        address="hidden",
        district="D",
        day="2026-10-23",
        slot="morning",
        mode="free",
        status="accepted",
    )
    bad_coords = RecyclingPickup(
        id="BADCOORD",
        citizen_id=profile.id,
        items=[{"estimatedKg": 1}],
        lat=100,
        lng=31,
        address="hidden",
        district="D",
        day="2026-10-23",
        slot="morning",
        mode="free",
        status="requested",
    )
    db.add_all([profile, assigned, bad_coords])
    db.flush()
    for pickup_id, status in ((assigned.id, 409), (bad_coords.id, 422)):
        request = OptimizeRoutesInput(pickupIds=[pickup_id], depot={"lat": 30, "lng": 31}, vehicleCount=1, capacityKg=1)
        with pytest.raises(HTTPException) as error:
            optimize_pickups(db, {"role": "admin"}, request)
        assert error.value.status_code == status
