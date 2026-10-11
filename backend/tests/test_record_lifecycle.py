"""The whole life of a document, through the real API, against an in-memory database.

Upload, OCR, extraction, retry, page attachment, editing and deletion, with the
real routing, auth, ownership checks and background tasks. Only the storage and
model calls are faked (scripts/dev_fakes.py), and those fakes keep the semantics
that matter here: foreign keys cascade, update/delete report the rows they hit.

Each test pins one of the bugs that made the app untrustworthy: duplicates from
a replayed upload, a warning that outlived its cause, a retry that stacked a
second copy of the medicines, a delete that removed files before the row.
"""
import importlib
import io
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import dev_fakes  # noqa: E402
from make_dev_documents import DOCUMENTS, make  # noqa: E402

from app.core.security import create_access_token, hash_password  # noqa: E402

# Every module that bound `supabase` or a Groq client at import time.
_DB_MODULES = [
    "app.api.v1.endpoints.upload", "app.api.v1.endpoints.records", "app.api.v1.endpoints.search",
    "app.api.v1.endpoints.auth", "app.api.v1.endpoints.profile", "app.api.v1.endpoints.assistant",
    "app.services.storage", "app.services.record_assembly", "app.services.passages",
    "app.services.retrieval", "app.services.agent_tools",
]
_MODEL_MODULES = ["app.services.ocr", "app.services.ai_extractor", "app.services.rag", "app.services.agent"]


@pytest.fixture
def env(monkeypatch, tmp_path):
    db = dev_fakes.FakeDB()
    dev_fakes.FakeGroq.db = db
    monkeypatch.setattr(dev_fakes, "VISION_DELAY_SECONDS", 0)
    for name in _DB_MODULES:
        monkeypatch.setattr(importlib.import_module(name), "supabase", db)
    for name in _MODEL_MODULES:
        monkeypatch.setattr(importlib.import_module(name), "client", dev_fakes.FakeGroq())
    monkeypatch.setattr(importlib.import_module("app.api.v1.endpoints.records"), "Groq", dev_fakes.FakeGroq)
    monkeypatch.setattr(importlib.import_module("app.services.record_assembly"), "_bill_columns", None)
    from app.limiter import limiter
    monkeypatch.setattr(limiter, "enabled", False)

    users = db.table("users").insert([
        {"email": "a@example.com", "hashed_password": hash_password("x" * 10)},
        {"email": "b@example.com", "hashed_password": hash_password("x" * 10)},
    ]).execute().data
    profiles = db.table("profiles").insert([
        {"user_id": users[0]["id"], "name": "Asha", "relationship": "Self"},
        {"user_id": users[0]["id"], "name": "Ravi", "relationship": "Father"},
        {"user_id": users[1]["id"], "name": "Stranger", "relationship": "Self"},
    ]).execute().data

    docs = {}
    for name, text in DOCUMENTS.items():
        path = tmp_path / name
        make(path, text)
        docs[name] = path.read_bytes()

    from app.main import app
    client = TestClient(app)

    class Env:
        pass

    e = Env()
    e.db, e.client, e.docs = db, client, docs
    e.asha, e.ravi, e.stranger = (p["id"] for p in profiles)
    e.auth = {"Authorization": "Bearer " + create_access_token(users[0]["id"])}
    e.other_auth = {"Authorization": "Bearer " + create_access_token(users[1]["id"])}
    return e


def upload(e, profile_id, *names, auth=None, **fields):
    files = [("files", (n, io.BytesIO(e.docs[n]), "image/png")) for n in names]
    return e.client.post(f"/api/v1/upload/{profile_id}", files=files, data=fields, headers=auth or e.auth)


def records(e, profile_id):
    return e.client.get(f"/api/v1/profiles/{profile_id}/records", headers=e.auth).json()


def meds(e, record_id):
    return sorted(m["name"] for m in e.db.tables["medicines"] if m["record_id"] == record_id)


# ── upload and extraction ────────────────────────────────────────────────────

def test_a_readable_prescription_is_saved_and_read(env):
    r = upload(env, env.asha, "rx_readable.png", document_category="prescription")
    assert r.status_code == 200 and r.json()["duplicate"] is False
    rec = records(env, env.asha)[0]
    assert rec["status"] == "done"
    assert rec["doctor_name"] == "Dr. Meera Rao"
    assert rec["document_date"] == "2026-09-20"
    # The extractor listed paracetamol twice; the record holds it once.
    assert meds(env, rec["id"]) == ["AMOXICILLIN 500MG", "PARACETAMOL 650MG"]
    assert len(rec["files"]) == 1 and rec["files"][0]["file_url"]


def test_what_the_person_entered_is_never_overwritten_by_extraction(env):
    upload(env, env.asha, "rx_readable.png", document_category="bill",
           document_date="2026-09-01", doctor_name="Dr. Typed By Me")
    rec = records(env, env.asha)[0]
    assert rec["document_category"] == "bill"
    assert rec["document_date"] == "2026-09-01"
    assert rec["doctor_name"] == "Dr. Typed By Me"
    assert rec["hospital_name"] == "Lakeside Clinic"   # empty, so filled from the document


def test_replaying_an_upload_returns_the_same_record_instead_of_a_duplicate(env):
    first = upload(env, env.asha, "rx_readable.png").json()
    again = upload(env, env.asha, "rx_readable.png").json()
    assert again["duplicate"] is True
    assert again["record_id"] == first["record_id"]
    assert len(records(env, env.asha)) == 1
    assert len(meds(env, first["record_id"])) == 2


def test_the_same_document_for_a_different_member_is_a_separate_record(env):
    upload(env, env.asha, "rx_readable.png")
    upload(env, env.ravi, "rx_readable.png")
    assert len(records(env, env.asha)) == 1
    assert len(records(env, env.ravi)) == 1


def test_an_invalid_file_stores_nothing(env):
    files = [("files", ("ok.png", io.BytesIO(env.docs["rx_readable.png"]), "image/png")),
             ("files", ("bad.png", io.BytesIO(b"not really a png"), "image/png"))]
    r = env.client.post(f"/api/v1/upload/{env.asha}", files=files, headers=env.auth)
    assert r.status_code == 400
    assert env.db.storage_objects == {}
    assert env.db.tables["records"] == []


def test_upload_details_are_validated(env):
    assert upload(env, env.asha, "rx_readable.png", document_category="nonsense").status_code == 400
    assert upload(env, env.asha, "rx_readable.png", document_date="20/09/2026").status_code == 400
    assert env.db.tables["records"] == []


# ── failure, retry and the warning ───────────────────────────────────────────

def test_an_unreadable_document_fails_but_keeps_its_original(env):
    rid = upload(env, env.asha, "unreadable.png").json()["record_id"]
    rec = records(env, env.asha)[0]
    assert rec["status"] == "failed"
    assert rec["files"][0]["file_url"]                     # the original is still viewable
    assert rec["file_path"] in env.db.storage_objects
    assert rid == rec["id"]


def test_retrying_a_failure_reads_the_original_again_without_duplicating(env, monkeypatch):
    rid = upload(env, env.asha, "unreadable.png").json()["record_id"]
    # Pretend the reader now succeeds on the same file (a transient outage).
    monkeypatch.setattr(dev_fakes, "read_dev_text", lambda _b: DOCUMENTS["rx_readable.png"])
    r = env.client.post(f"/api/v1/profiles/{env.asha}/records/{rid}/retry", headers=env.auth)
    assert r.status_code == 200 and r.json()["started"] is True
    assert records(env, env.asha)[0]["status"] == "done"
    assert meds(env, rid) == ["AMOXICILLIN 500MG", "PARACETAMOL 650MG"]

    # A second retry is refused (it is already read) and changes nothing.
    again = env.client.post(f"/api/v1/profiles/{env.asha}/records/{rid}/retry", headers=env.auth)
    assert again.status_code == 409
    assert meds(env, rid) == ["AMOXICILLIN 500MG", "PARACETAMOL 650MG"]
    assert len(records(env, env.asha)) == 1


def test_a_retry_while_already_reading_does_not_start_a_second_job(env):
    rid = upload(env, env.asha, "unreadable.png").json()["record_id"]
    env.db.table("records").update({"status": "processing"}).eq("id", rid).execute()
    r = env.client.post(f"/api/v1/profiles/{env.asha}/records/{rid}/retry", headers=env.auth)
    assert r.status_code == 200 and r.json()["started"] is False


def test_adding_a_page_to_an_old_record_is_not_declared_stuck(env):
    """The cause of the warning that appeared and would not go away."""
    rid = upload(env, env.asha, "rx_readable.png").json()["record_id"]
    month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    env.db.table("records").update({"created_at": month_ago, "updated_at": month_ago}).eq("id", rid).execute()

    # Simulate the moment between "pages attached" and "pages read".
    from app.api.v1.endpoints import upload as upload_endpoint
    env.db.table("records").update({"status": "processing", "updated_at": upload_endpoint._now()}).eq("id", rid).execute()
    statuses = env.client.get(f"/api/v1/profiles/{env.asha}/records/status", headers=env.auth).json()
    assert statuses[0]["status"] == "processing"           # not flipped to failed


def test_a_genuinely_stuck_record_is_failed_and_can_then_be_retried(env):
    rid = upload(env, env.asha, "rx_readable.png").json()["record_id"]
    long_ago = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
    env.db.table("records").update({"status": "processing", "updated_at": long_ago}).eq("id", rid).execute()
    assert records(env, env.asha)[0]["status"] == "failed"
    r = env.client.post(f"/api/v1/profiles/{env.asha}/records/{rid}/retry", headers=env.auth)
    assert r.json()["started"] is True
    assert records(env, env.asha)[0]["status"] == "done"
    assert len(meds(env, rid)) == 2                        # not four


def test_attaching_pages_merges_into_the_record(env):
    rid = upload(env, env.asha, "rx_readable.png").json()["record_id"]
    files = [("files", ("p2.png", io.BytesIO(env.docs["rx_second_page.png"]), "image/png"))]
    r = env.client.post(f"/api/v1/profiles/{env.asha}/records/{rid}/pages", files=files, headers=env.auth)
    assert r.json()["pages_added"] == 1
    rec = records(env, env.asha)
    assert len(rec) == 1 and rec[0]["status"] == "done"
    assert len(rec[0]["files"]) == 2
    assert meds(env, rid) == ["AMOXICILLIN 500MG", "CETIRIZINE 10MG", "PARACETAMOL 650MG"]
    # The same page again is recognised, not appended a second time.
    again = env.client.post(f"/api/v1/profiles/{env.asha}/records/{rid}/pages", files=files, headers=env.auth)
    assert again.json()["duplicate"] is True
    assert len(records(env, env.asha)[0]["files"]) == 2


def test_an_unreadable_extra_page_on_a_failed_record_leaves_it_failed(env):
    rid = upload(env, env.asha, "unreadable.png").json()["record_id"]
    # Different bytes (so not a duplicate page), equally unreadable.
    another_bad_photo = env.docs["unreadable.png"] + b"\x00"
    files = [("files", ("u2.png", io.BytesIO(another_bad_photo), "image/png"))]
    r = env.client.post(f"/api/v1/profiles/{env.asha}/records/{rid}/pages", files=files, headers=env.auth)
    assert r.json()["pages_added"] == 1
    rec = records(env, env.asha)[0]
    assert rec["status"] == "failed"                       # not "done" with no text
    assert len(rec["files"]) == 2                          # both originals kept


# ── editing ──────────────────────────────────────────────────────────────────

def test_an_edit_persists_and_is_recorded_once(env):
    rid = upload(env, env.asha, "rx_readable.png").json()["record_id"]
    url = f"/api/v1/profiles/{env.asha}/records/{rid}"
    r = env.client.put(url, json={"diagnosis": "Tonsillitis", "doctor_name": "Dr. Meera Rao"}, headers=env.auth)
    assert r.status_code == 200
    assert records(env, env.asha)[0]["diagnosis"] == "Tonsillitis"
    history = env.client.get(url + "/history", headers=env.auth).json()
    # doctor_name did not change, so it is not in the history.
    assert [h["field_name"] for h in history] == ["diagnosis"]


def test_bill_details_survive_a_refresh(env):
    rid = upload(env, env.asha, "bill_readable.png", document_category="bill").json()["record_id"]
    env.client.put(f"/api/v1/profiles/{env.asha}/records/{rid}",
                   json={"bill_title": "Pharmacy run", "bill_category": "Pharmacy"}, headers=env.auth)
    rec = records(env, env.asha)[0]
    assert rec["bill_title"] == "Pharmacy run" and rec["bill_category"] == "Pharmacy"


def test_saving_identical_medicines_twice_keeps_one(env):
    rid = upload(env, env.asha, "rx_readable.png").json()["record_id"]
    same = {"name": "X 5MG", "dosage": "5mg", "frequency": "1-0-0", "duration": "5 days"}
    env.client.put(f"/api/v1/profiles/{env.asha}/records/{rid}", json={"medicines": [same, same]}, headers=env.auth)
    assert meds(env, rid) == ["X 5MG"]
    history = env.client.get(f"/api/v1/profiles/{env.asha}/records/{rid}/history", headers=env.auth).json()
    assert history[0]["field_name"] == "medicines"


# ── deletion ─────────────────────────────────────────────────────────────────

def test_delete_removes_the_record_its_children_and_its_files(env):
    rid = upload(env, env.asha, "rx_readable.png").json()["record_id"]
    path = records(env, env.asha)[0]["file_path"]
    r = env.client.delete(f"/api/v1/profiles/{env.asha}/records/{rid}", headers=env.auth)
    assert r.status_code == 200
    assert records(env, env.asha) == []
    assert env.db.tables["medicines"] == [] and env.db.tables["record_files"] == []
    assert path not in env.db.storage_objects
    # Gone means gone: a second delete is a 404, not a second success.
    assert env.client.delete(f"/api/v1/profiles/{env.asha}/records/{rid}", headers=env.auth).status_code == 404
    # And the same document can be uploaded again afterwards.
    assert upload(env, env.asha, "rx_readable.png").json()["duplicate"] is False


def test_deleting_a_member_deletes_their_documents(env):
    upload(env, env.ravi, "rx_readable.png")
    assert env.db.storage_objects
    assert env.client.delete(f"/api/v1/profiles/{env.ravi}", headers=env.auth).status_code == 200
    assert env.db.storage_objects == {}
    assert env.db.tables["records"] == []


# ── isolation ────────────────────────────────────────────────────────────────

def test_another_account_cannot_touch_these_records(env):
    rid = upload(env, env.asha, "unreadable.png").json()["record_id"]
    base = f"/api/v1/profiles/{env.asha}/records/{rid}"
    o = env.other_auth
    assert env.client.get(base, headers=o).status_code == 404
    assert env.client.put(base, json={"diagnosis": "x"}, headers=o).status_code == 404
    assert env.client.post(base + "/retry", headers=o).status_code == 404
    assert env.client.delete(base, headers=o).status_code == 404
    assert env.client.get(f"/api/v1/profiles/{env.asha}/records/status", headers=o).status_code == 404
    assert upload(env, env.asha, "rx_readable.png", auth=o).status_code == 404
    # Their own records are untouched by any of that.
    assert len(records(env, env.asha)) == 1


def test_a_record_id_from_another_member_is_not_reachable_through_this_one(env):
    rid = upload(env, env.ravi, "rx_readable.png").json()["record_id"]
    r = env.client.get(f"/api/v1/profiles/{env.asha}/records/{rid}", headers=env.auth)
    assert r.status_code == 404


def test_search_and_ask_stay_inside_the_member_and_the_account(env):
    upload(env, env.asha, "rx_readable.png")
    upload(env, env.stranger, "lab_readable.png", auth=env.other_auth)
    found = env.client.get("/api/v1/search", params={"q": "haemoglobin"}, headers=env.auth).json()
    assert found == []                                      # the stranger's lab report never appears
    answer = env.client.post(f"/api/v1/profiles/{env.asha}/ask", json={"question": "amoxicillin dose"},
                             headers=env.auth).json()
    assert answer["found"] is True
    assert {s["record_id"] for s in answer["sources"]} <= {r["id"] for r in records(env, env.asha)}


def test_ask_distinguishes_no_match_from_a_failure(env, monkeypatch):
    upload(env, env.asha, "rx_readable.png")
    none = env.client.post(f"/api/v1/profiles/{env.asha}/ask", json={"question": "zebra stripes"}, headers=env.auth)
    assert none.status_code == 200 and none.json()["found"] is False and none.json()["sources"] == []

    def boom(**_kw):
        raise RuntimeError("model down")

    monkeypatch.setattr(importlib.import_module("app.services.rag").client.chat.completions, "create", boom)
    failed = env.client.post(f"/api/v1/profiles/{env.asha}/ask", json={"question": "amoxicillin"}, headers=env.auth)
    assert failed.status_code == 503


def test_two_identical_uploads_racing_create_one_record_and_keep_the_file(env, monkeypatch):
    """Both requests pass the 'already saved?' check before either writes."""
    first = upload(env, env.asha, "rx_readable.png").json()
    from app.api.v1.endpoints import upload as upload_endpoint
    real = upload_endpoint._records_holding
    calls = {"n": 0}

    def racing(paths, profile_id):
        calls["n"] += 1
        return {} if calls["n"] == 1 else real(paths, profile_id)  # the first check misses

    monkeypatch.setattr(upload_endpoint, "_records_holding", racing)
    second = upload(env, env.asha, "rx_readable.png").json()
    assert second["duplicate"] is True and second["record_id"] == first["record_id"]
    assert len(records(env, env.asha)) == 1
    rec = records(env, env.asha)[0]
    assert rec["file_path"] in env.db.storage_objects   # the loser did not delete the winner's file
    assert rec["files"][0]["file_url"]
