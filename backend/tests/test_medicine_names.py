"""Checking medicine names against the list of real medicines (migration 009).

The cleaning and the API run everywhere. The matching itself is SQL, so the
tests at the bottom run it on a real Postgres, and are skipped unless one is
named in MEDIVAULT_TEST_PSQL (psql connection flags, for example
"-h /tmp -p 5433 -U postgres"). They create and drop their own database.
"""
import importlib
import json
import os
import shlex
import subprocess
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.services import medicine_names as mn
from app.services.medicine_names import brand_of, clean_name, generic_parts, prepare

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND / "scripts"))
import dev_fakes  # noqa: E402

from app.core.security import create_access_token, hash_password  # noqa: E402


# ── cleaning ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw, clean", [
    ("Tab. AZEE 500mg", "azee 500"),
    ("Azee 500 Tablet", "azee 500"),
    ("Dolo-650", "dolo 650"),
    ("Cap. Pantocid DSR", "pantocid dsr"),
    ("Syp. Ascoril LS 100ml", "ascoril ls 100"),
    ("Thyronorm 50mcg Tablet", "thyronorm 50"),
    ("Vitamin D3 60000 IU", "vitamin d3 60000"),
    ("Augmentin 625 Duo Tablet", "augmentin 625 duo"),
    ("T-Bact Ointment", "t bact"),
    ("Betadine 5% w/v Solution", "betadine 5"),
    ("Calpol 2.5mg", "calpol 2.5"),
    ("", ""),
    (None, ""),
])
def test_names_clean_the_same_way_however_they_are_written(raw, clean):
    assert clean_name(raw) == clean


@pytest.mark.parametrize("clean, brand", [
    ("pantocid dsr 40", "pantocid dsr"),
    ("dolo 650", "dolo"),
    ("vitamin d3 60000", "vitamin d3"),   # d3 is part of the name, 60000 is not
    ("sinarest lp new", "sinarest lp new"),
    ("500 forte", "500 forte"),           # starts with a number: keep it all
])
def test_the_brand_is_the_words_before_the_strength(clean, brand):
    assert brand_of(clean) == brand


def test_generic_names_split_on_plus_and_lose_their_strengths():
    assert generic_parts("Amoxicillin 500mg + Clavulanic Acid 125mg") == ["amoxicillin", "clavulanic acid"]
    assert generic_parts("Calcium & Vitamin D3 (1000IU)") == ["calcium", "vitamin d3"]
    assert generic_parts("Paracetamol 650") == ["paracetamol"]


def test_prepare_gives_the_database_what_it_matches_on():
    assert prepare("Sinarest LP New Tablet") == {
        "brand": "sinarest lp new", "first": "sinarest", "generics": ["sinarest lp new"]}


# ── the service and the API, on the in-memory database ───────────────────────

@pytest.fixture
def api(monkeypatch):
    db = dev_fakes.FakeDB()
    for name in ("app.services.medicine_names", "app.api.v1.endpoints.auth"):
        monkeypatch.setattr(importlib.import_module(name), "supabase", db)
    from app.limiter import limiter
    monkeypatch.setattr(limiter, "enabled", False)
    user = db.table("users").insert({"email": "a@example.com", "hashed_password": hash_password("x" * 10)}).execute().data[0]
    from app.main import app
    return db, TestClient(app), {"Authorization": "Bearer " + create_access_token(user["id"])}, user["id"]


def test_names_are_left_unchecked_when_the_list_is_not_in_the_database(api):
    _, client, auth, _ = api
    r = client.post("/api/v1/medicines/check", json={"names": ["Azee 500", "Dolo 650"]}, headers=auth)
    assert r.status_code == 200
    results = r.json()["results"]
    assert [x["name"] for x in results] == ["Azee 500", "Dolo 650"]
    assert {x["status"] for x in results} == {"unchecked"}


def test_results_come_back_in_the_order_the_names_were_sent(monkeypatch):
    class Rpc:
        def __init__(self, rows):
            self.data = rows

        def execute(self):
            return self

    class DB:
        def rpc(self, name, params):
            assert name == "check_medicine_names"
            assert [p["brand"] for p in params["p_items"]] == ["azee", "pantocd", "qwrtpz"]
            assert params["p_amber"] == mn.AMBER_FROM
            # Out of order on purpose: idx decides, not position.
            return Rpc([
                {"idx": 3, "status": "red", "suggestions": []},
                {"idx": 1, "status": "green", "matched": "Azee", "generic": "Azithromycin (500mg)", "score": 1},
                {"idx": 2, "status": "amber", "score": 0.55,
                 "suggestions": [{"name": "Pantocid", "generic": "Pantoprazole", "score": 0.55, "distance": 1}]},
            ])

    monkeypatch.setattr(mn, "supabase", DB())
    out = mn.check(["Azee 500", "Pantocd 40", "qwrtpz"], user_id="u1")
    assert [o["status"] for o in out] == ["green", "amber", "red"]
    assert out[0]["matched"] == "Azee"
    assert out[1]["suggestions"][0]["name"] == "Pantocid"


def test_checking_needs_a_signed_in_account(api):
    _, client, _, _ = api
    assert client.post("/api/v1/medicines/check", json={"names": ["Azee"]}).status_code in (401, 403)


def test_too_many_or_too_long_names_are_refused(api):
    _, client, auth, _ = api
    assert client.post("/api/v1/medicines/check", json={"names": ["x"] * 51}, headers=auth).status_code == 400
    assert client.post("/api/v1/medicines/check", json={"names": ["x" * 201]}, headers=auth).status_code == 400


def test_a_confirmed_name_is_remembered_once_per_account(api):
    db, client, auth, user_id = api
    for _ in range(2):
        r = client.post("/api/v1/medicines/confirm", json={"name": "Shelcal 500"}, headers=auth)
        assert r.status_code == 200 and r.json()["saved"] is True
    rows = [r for r in db.tables["user_medicines"] if r["user_id"] == user_id]
    assert len(rows) == 1 and rows[0]["brand_clean"] == "shelcal"


def test_confirming_an_empty_name_is_refused(api):
    _, client, auth, _ = api
    assert client.post("/api/v1/medicines/confirm", json={"name": "  "}, headers=auth).status_code == 400


# ── the matching itself, on a real Postgres ──────────────────────────────────

PSQL = os.environ.get("MEDIVAULT_TEST_PSQL")
needs_postgres = pytest.mark.skipif(not PSQL, reason="set MEDIVAULT_TEST_PSQL to run the SQL matching tests")


def _psql(db, *args, sql=None):
    cmd = ["psql", *shlex.split(PSQL), "-d", db, "-v", "ON_ERROR_STOP=1", "-q", "-At", *args]
    return subprocess.run(cmd, input=sql, capture_output=True, text=True, check=True).stdout


@pytest.fixture(scope="module")
def pg(tmp_path_factory):
    name = "medivault_test_" + uuid.uuid4().hex[:8]
    _psql("postgres", "-c", f"create database {name}")
    try:
        _psql(name, sql="do $$ begin create role anon; exception when duplicate_object then null; end $$;"
                        "do $$ begin create role authenticated; exception when duplicate_object then null; end $$;"
                        "do $$ begin create role service_role; exception when duplicate_object then null; end $$;"
                        "create table public.users (id uuid primary key default gen_random_uuid(), email text);")
        migration = BACKEND / "database" / "migrations" / "009_medicine_names.sql"
        _psql(name, "-f", str(migration))
        _psql(name, "-f", str(migration))   # safe to run twice

        out = tmp_path_factory.mktemp("medicines")
        import load_medicines
        load_medicines.main([str(BACKEND / "tests" / "fixtures" / "medicines_sample.csv"), "--to-csv", str(out)])
        _psql(name, "-c", f"\\copy medicine_brands from '{out / 'medicine_brands.csv'}' csv header")
        _psql(name, "-c", f"\\copy medicine_generics from '{out / 'medicine_generics.csv'}' csv header")
        yield name
    finally:
        _psql("postgres", "-c", f"drop database if exists {name}")


def _check(db, names, user_id=None):
    items = json.dumps([prepare(n) for n in names]).replace("'", "''")
    uid = f"'{user_id}'" if user_id else "null"
    out = _psql(db, "-F", "\t", "-c",
                f"select status, coalesce(matched, ''), suggestions::text "
                f"from check_medicine_names('{items}'::jsonb, {uid}, {mn.AMBER_FROM}) order by idx")
    rows = [line.split("\t") for line in out.strip().split("\n")]
    return [{"status": s, "matched": m, "suggestions": json.loads(j)} for s, m, j in rows]


@needs_postgres
def test_known_brands_are_green_however_they_are_written(pg):
    out = _check(pg, ["Tab. AZEE 500mg", "Dolo-650", "Sinarest", "Cap Pantocid DSR", "Thyronorm 50 mcg"])
    assert [o["status"] for o in out] == ["green"] * 5
    assert out[2]["matched"] == "Sinarest New"   # its first word is enough


@needs_postgres
def test_a_generic_is_green_even_in_the_other_spelling(pg):
    # The list writes "Amoxycillin"; doctors write "Amoxicillin".
    out = _check(pg, ["Amoxicillin 500", "Amoxicillin + Clavulanic acid 625", "Paracetamol 650"])
    assert [o["status"] for o in out] == ["green", "green", "green"]


@needs_postgres
def test_a_one_letter_typo_is_amber_with_the_real_name_first(pg):
    out = _check(pg, ["Pantocd 40"])[0]
    assert out["status"] == "amber"
    assert out["suggestions"][0]["name"] == "Pantocid"


@needs_postgres
def test_a_made_up_or_very_short_unknown_name_is_red(pg):
    out = _check(pg, ["qwrtpz", "Liv 52"])
    assert [o["status"] for o in out] == ["red", "red"]


@needs_postgres
def test_a_name_the_person_confirmed_is_green_for_them_only(pg):
    me = _psql(pg, "-c", "insert into users(email) values ('me@x') returning id").strip()
    other = _psql(pg, "-c", "insert into users(email) values ('other@x') returning id").strip()
    _psql(pg, "-c", f"insert into user_medicines(user_id, name, brand_clean) values ('{me}', 'Shelcal 500', "
                    f"'{brand_of(clean_name('Shelcal 500'))}')")
    assert _check(pg, ["Shelcal 500"], me)[0]["status"] == "green"
    assert _check(pg, ["Shelcal 500"], other)[0]["status"] != "green"


@needs_postgres
def test_the_function_is_closed_to_the_public_roles(pg):
    for role in ("anon", "authenticated"):
        assert _psql(pg, "-c", f"select has_function_privilege('{role}', "
                               "'public.check_medicine_names(jsonb, uuid, real)', 'EXECUTE')").strip() == "f"


def test_the_loader_upserts_in_batches_on_each_table_key(monkeypatch):
    import load_medicines
    calls = []

    class Q:
        def __init__(self, table):
            self.table = table

        def upsert(self, rows, on_conflict):
            calls.append((self.table, len(rows), on_conflict))
            return self

        def execute(self):
            return self

    class DB:
        def table(self, name):
            return Q(name)

    monkeypatch.setattr(importlib.import_module("app.database"), "supabase", DB())
    products, brands, generics = load_medicines.read_indian_medicine_dataset(
        BACKEND / "tests" / "fixtures" / "medicines_sample.csv")
    assert len(products) == 20 and {b["brand_clean"] for b in brands} >= {"azee", "pantocid", "sinarest new"}
    load_medicines.upload({"medicine_brands": brands, "medicine_generics": generics}, batch=5)
    assert all(c == "brand_clean" for t, _, c in calls if t == "medicine_brands")
    assert all(c == "name_clean" for t, _, c in calls if t == "medicine_generics")
    assert sum(n for t, n, _ in calls if t == "medicine_brands") == len(brands)
    assert max(n for _, n, _ in calls) <= 5
