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


def test_cors_origins_are_parsed_from_whatever_is_configured():
    """Asserting a literal here made the suite depend on the developer having no
    .env, so it passed in CI and failed for anyone who had actually configured
    the app. Test the transformation instead."""
    from app.config import settings
    from app.main import allowed_origins, parse_origins
    assert allowed_origins == parse_origins(settings.ALLOWED_ORIGINS)


def test_origins_are_split_and_trimmed():
    from app.main import parse_origins
    assert parse_origins("http://a.com, http://b.com") == ["http://a.com", "http://b.com"]


def test_blank_entries_are_dropped():
    from app.main import parse_origins
    assert parse_origins("http://a.com,,  ,http://b.com") == ["http://a.com", "http://b.com"]


def test_an_empty_setting_allows_nothing():
    """An empty list is correct: CORS with credentials must never be a wildcard."""
    from app.main import parse_origins
    assert parse_origins("") == []
