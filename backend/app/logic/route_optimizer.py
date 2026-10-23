"""Admin-only deterministic OR-Tools CVRP preview."""

import math

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.logic.duplicates import haversine_m
from app.models import RecyclingPickup


def optimize_pickups(db: Session, claims: dict, request) -> dict:
    if claims.get("role") != "admin":
        raise HTTPException(403, "admin required")
    ids = request.pickupIds
    if not 1 <= len(ids) <= 100 or len(set(ids)) != len(ids):
        raise HTTPException(422, "pickupIds must be unique and contain 1..100 ids")
    depot = request.depot.model_dump()
    try:
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2  # type: ignore[import-untyped]
    except ImportError as error:
        raise HTTPException(503, "OR-Tools is unavailable") from error
    rows = db.query(RecyclingPickup).filter(RecyclingPickup.id.in_(ids)).all()
    by_id = {row.id: row for row in rows}
    if len(by_id) != len(ids):
        raise HTTPException(404, "pickup not found")
    pickups = [by_id[key] for key in ids]
    for pickup in pickups:
        if pickup.status != "requested" or pickup.collector_id:
            raise HTTPException(409, "pickup is no longer available")
        if (
            pickup.lat is None
            or pickup.lng is None
            or not all(math.isfinite(v) for v in (pickup.lat, pickup.lng))
            or not -90 <= pickup.lat <= 90
            or not -180 <= pickup.lng <= 180
        ):
            raise HTTPException(422, "pickup has invalid coordinates")
    demand_grams = []
    for pickup in pickups:
        items = pickup.items if isinstance(pickup.items, list) else []
        weights = [item.get("estimatedKg") for item in items if isinstance(item, dict)]
        if (
            not weights
            or len(weights) != len(items)
            or any(
                not isinstance(weight, (int, float)) or not math.isfinite(weight) or weight <= 0 for weight in weights
            )
        ):
            raise HTTPException(422, "pickup requires positive estimated item weight")
        kg = sum(weights)
        demand_grams.append(math.ceil(kg * 1000))
    locations = [(depot["lat"], depot["lng"])] + [(p.lat, p.lng) for p in pickups]
    distance = [[round(haversine_m(*a, *b)) for b in locations] for a in locations]
    manager = pywrapcp.RoutingIndexManager(len(locations), request.vehicleCount, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        return distance[manager.IndexToNode(from_index)][manager.IndexToNode(to_index)]

    distance_idx = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(distance_idx)

    def demand_callback(index):
        node = manager.IndexToNode(index)
        return 0 if node == 0 else demand_grams[node - 1]

    demand_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    capacities = [math.floor(request.capacityKg * 1000)] * request.vehicleCount
    routing.AddDimensionWithVehicleCapacity(demand_idx, 0, capacities, True, "Capacity")
    for node in range(1, len(locations)):
        routing.AddDisjunction([manager.NodeToIndex(node)], 10**12)
    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.FromSeconds(3)
    params.sat_parameters.num_search_workers = 1
    solution = routing.SolveWithParameters(params)
    routes, served = [], set()
    if solution:
        for vehicle in range(request.vehicleCount):
            index = routing.Start(vehicle)
            nodes, load, route_distance = [], 0, 0
            previous = 0
            while not routing.IsEnd(index):
                index = solution.Value(routing.NextVar(index))
                node = manager.IndexToNode(index)
                route_distance += distance[previous][node]
                previous = node
                if node:
                    nodes.append(node - 1)
                    served.add(node - 1)
                    load += demand_grams[node - 1]
            if nodes:
                routes.append(
                    {
                        "vehicleIndex": vehicle,
                        "pickupIds": [pickups[i].id for i in nodes],
                        "loadKg": round(load / 1000, 3),
                        "distanceMeters": route_distance,
                        "stops": [
                            {"pickupId": pickups[i].id, "lat": pickups[i].lat, "lng": pickups[i].lng} for i in nodes
                        ],
                    }
                )
    unassigned = [pickups[i].id for i in range(len(pickups)) if i not in served]
    return {
        "algorithm": "ortools",
        "distanceModel": "haversine",
        "routes": routes,
        "unassignedPickupIds": unassigned,
        "totalDistanceMeters": sum(r["distanceMeters"] for r in routes),
    }
