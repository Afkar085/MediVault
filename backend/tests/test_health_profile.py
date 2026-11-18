"""Health details on a family member (migration 011): allergies, conditions and
medicines taken every day. All optional, asked when a member is added or edited."""
import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dev_fakes  # noqa: E402

from app.core.security import create_access_token, hash_password  # noqa: E402


@pytest.fixture
def api(monkeypatch):
    db = dev_fakes.FakeDB()
    for name in ("app.api.v1.endpoints.profile", "app.api.v1.endpoints.auth"):
        monkeypatch.setattr(importlib.import_module(name), "supabase", db)
    from app.limiter import limiter
    monkeypatch.setattr(limiter, "enabled", False)
    users = db.table("users").insert([
        {"email": "a@example.com", "hashed_password": hash_password("x" * 10)},
        {"email": "b@example.com", "hashed_password": hash_password("x" * 10)},
    ]).execute().data
    from app.main import app
    auth = {"Authorization": "Bearer " + create_access_token(users[0]["id"])}
    other = {"Authorization": "Bearer " + create_access_token(users[1]["id"])}
    return db, TestClient(app), auth, other


def test_a_member_can_be_added_with_no_health_details(api):
    _, client, auth, _ = api
    r = client.post("/api/v1/profiles", headers=auth, json={"name": "Amma", "relationship": "Mother"})
    assert r.status_code == 200
    body = r.json()
    assert body["allergies"] == [] and body["conditions"] == [] and body["long_term_medicines"] == []
    assert body["blood_group"] is None


def test_health_details_are_saved_and_cleaned(api):
    _, client, auth, _ = api
    r = client.post("/api/v1/profiles", headers=auth, json={
        "name": "Abba", "relationship": "Father",
        "allergies": [" Penicillin ", "penicillin", "", "Peanuts"],
        "conditions": ["Sugar (diabetes)", "BP"],
        "long_term_medicines": [{"name": " Glycomet GP 1 ", "dosage": "1 tablet", "frequency": "1-0-1", "for_what": "Sugar"}],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["allergies"] == ["Penicillin", "Peanuts"]
    assert body["conditions"] == ["Sugar (diabetes)", "BP"]
    assert body["long_term_medicines"][0]["name"] == "Glycomet GP 1"


def test_health_details_can_be_edited_and_cleared(api):
    _, client, auth, _ = api
    pid = client.post("/api/v1/profiles", headers=auth, json={
        "name": "Abba", "relationship": "Father", "allergies": ["Sulfa"]}).json()["id"]
    r = client.put(f"/api/v1/profiles/{pid}", headers=auth, json={"allergies": [], "blood_group": "B+"})
    assert r.status_code == 200
    assert r.json()["allergies"] == [] and r.json()["blood_group"] == "B+"
    assert client.get("/api/v1/profiles", headers=auth).json()[0]["blood_group"] == "B+"


@pytest.mark.parametrize("bad", [
    {"blood_group": "Z+"},
    {"allergies": ["x" * 81]},
    {"conditions": ["c"] * 31},
    {"long_term_medicines": [{"name": ""}]},
])
def test_bad_health_details_are_refused(api, bad):
    _, client, auth, _ = api
    r = client.post("/api/v1/profiles", headers=auth, json={"name": "A", "relationship": "Self", **bad})
    assert r.status_code == 422


def test_someone_else_cannot_change_them(api):
    _, client, auth, other = api
    pid = client.post("/api/v1/profiles", headers=auth, json={"name": "A", "relationship": "Self"}).json()["id"]
    assert client.put(f"/api/v1/profiles/{pid}", headers=other, json={"allergies": ["X"]}).status_code == 404


def test_before_the_migration_it_says_so_instead_of_failing(api, monkeypatch):
    db, client, auth, _ = api
    pid = client.post("/api/v1/profiles", headers=auth, json={"name": "A", "relationship": "Self"}).json()["id"]
    real_table = db.table

    class NoHealthColumns:
        def __init__(self, q):
            self.q = q

        def __getattr__(self, name):
            attr = getattr(self.q, name)
            if name != "update":
                return attr

            def update(data, *a, **k):
                if "allergies" in data:
                    raise Exception('column "allergies" of relation "profiles" does not exist')
                return attr(data, *a, **k)
            return update

    monkeypatch.setattr(db, "table", lambda name: NoHealthColumns(real_table(name)) if name == "profiles" else real_table(name))
    r = client.put(f"/api/v1/profiles/{pid}", headers=auth, json={"allergies": ["X"]})
    assert r.status_code == 400 and "migration 011" in r.json()["detail"]
