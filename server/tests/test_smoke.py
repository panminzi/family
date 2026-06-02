"""Smoke test that imports the FastAPI app and ensures key routes are registered."""

from app.main import create_app


def test_app_routes_present():
    app = create_app()
    routes = {r.path for r in app.routes}
    assert "/health" in routes
    assert any(p.startswith("/api/auth") for p in routes)
    assert any(p.startswith("/api/families") for p in routes)
    assert any(p.startswith("/api/conversations") for p in routes)
