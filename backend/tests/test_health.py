"""Smoke tests for the app + CORS wiring (no external services hit)."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "MediVault API running"


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_cors_origins_parsed_from_settings():
    # FRONTEND_ORIGINS defaults to "*" in the test env -> single allowed origin.
    from app.main import allowed_origins
    assert allowed_origins == ["*"]
