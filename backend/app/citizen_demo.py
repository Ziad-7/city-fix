"""Local citizen endpoint harness. No database, real storage or AI endpoints."""

from fastapi import FastAPI

from app.auth_demo import create_app as create_auth_app
from app.demo_store import DemoCitizenRepository
from app.routers import incidents, map, reports, service_requests


def create_app() -> FastAPI:
    app = create_auth_app()
    app.title = "FixTheCity local citizen API demo"
    app.state.citizen_repository = DemoCitizenRepository()
    for router in (
        reports.router,
        incidents.router,
        map.router,
        service_requests.router,
    ):
        app.include_router(router)
    return app
