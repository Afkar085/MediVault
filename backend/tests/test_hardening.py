"""The protections added in the security review, exercised through the real API.

Runs against the in-memory fakes (scripts/dev_fakes.py), never Supabase or Groq.
"""
import io

import pytest
from starlette.requests import Request

from app.core import login_guard
from app.core.security import create_access_token
from app.limiter import account_or_address
from test_record_lifecycle import env, upload  # noqa: F401  (env is a fixture)


@pytest.fixture(autouse=True)
def _fresh_guard():
    login_guard.reset()
    yield
    login_guard.reset()


def _request(headers=None, client=("203.0.113.9", 1234)):
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "headers": raw, "client": client, "method": "GET", "path": "/"})


# ── rate limits are per account, not per (possibly shared) address ─────────

def test_signed_in_requests_are_limited_per_account():
    token = create_access_token("user-1")
    assert account_or_address(_request({"Authorization": "Bearer " + token})) == "user:user-1"


def test_two_accounts_behind_one_proxy_do_not_share_a_limit():
    a = account_or_address(_request({"Authorization": "Bearer " + create_access_token("a")}))
    b = account_or_address(_request({"Authorization": "Bearer " + create_access_token("b")}))
    assert a != b


def test_a_forged_or_missing_token_falls_back_to_the_address():
    assert account_or_address(_request({"Authorization": "Bearer not-a-real-token"})) == "ip:203.0.113.9"
    assert account_or_address(_request()) == "ip:203.0.113.9"


def test_the_paid_endpoints_have_a_daily_ceiling():
    import app.main  # noqa: F401  registers the routes
    from app.limiter import limiter
    daily = {
        route for route, limits in limiter._route_limits.items()
        if any(item.limit.get_expiry() >= 24 * 3600 for item in limits)
    }
    for route in ("upload.upload_file", "upload.add_pages", "upload.retry_record", "upload.reextract_record",
                  "records.ask_records", "records.get_health_journey", "assistant.ask_family"):
        assert any(r.endswith(route) for r in daily), route


# ── sign-in ──────────────────────────────────────────────────────────────────

def _login(e, email, password):
    return e.client.post("/api/v1/auth/login", json={"email": email, "password": password})


def test_repeated_wrong_passwords_lock_that_account(env):  # noqa: F811
    for _ in range(login_guard.MAX_FAILURES):
        assert _login(env, "a@example.com", "wrong-password").status_code == 401
    locked = _login(env, "a@example.com", "x" * 10)          # even the right password
    assert locked.status_code == 429
    assert int(locked.headers["Retry-After"]) > 0


def test_the_lock_is_per_account(env):  # noqa: F811
    for _ in range(login_guard.MAX_FAILURES):
        _login(env, "a@example.com", "wrong-password")
    assert _login(env, "b@example.com", "x" * 10).status_code == 200


def test_a_correct_password_clears_earlier_failures(env):  # noqa: F811
    for _ in range(login_guard.MAX_FAILURES - 1):
        _login(env, "a@example.com", "wrong-password")
    assert _login(env, "a@example.com", "x" * 10).status_code == 200
    assert _login(env, "a@example.com", "wrong-password").status_code == 401   # count started again


def test_unknown_and_known_emails_fail_the_same_way(env):  # noqa: F811
    unknown = _login(env, "nobody@example.com", "whatever-password")
    known = _login(env, "a@example.com", "wrong-password")
    assert unknown.status_code == known.status_code == 401
    assert unknown.json() == known.json()


def test_an_absurdly_long_password_is_refused_not_processed(env):  # noqa: F811
    assert _login(env, "a@example.com", "x" * 5000).status_code == 422


def test_a_lock_expires():
    login_guard.reset()
    for _ in range(login_guard.MAX_FAILURES):
        login_guard.record_failure("a@example.com", now=1000.0)
    assert login_guard.seconds_locked("a@example.com", now=1001.0) > 0
    assert login_guard.seconds_locked("a@example.com", now=1000.0 + login_guard.LOCKOUT + 1) == 0


# ── responses ────────────────────────────────────────────────────────────────

def test_medical_responses_are_never_cached_and_carry_security_headers(env):  # noqa: F811
    r = env.client.get(f"/api/v1/profiles/{env.asha}/records", headers=env.auth)
    assert r.headers["Cache-Control"] == "no-store"
    for header in ("X-Content-Type-Options", "X-Frame-Options", "Strict-Transport-Security",
                   "Content-Security-Policy", "Referrer-Policy", "Permissions-Policy"):
        assert header in r.headers, header


def test_cors_answers_only_the_configured_origin(env):  # noqa: F811
    from app.main import allowed_origins
    good = env.client.options("/api/v1/auth/login", headers={
        "Origin": allowed_origins[0], "Access-Control-Request-Method": "POST"})
    bad = env.client.options("/api/v1/auth/login", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert good.headers.get("access-control-allow-origin") == allowed_origins[0]
    assert "access-control-allow-origin" not in bad.headers


# ── uploads ──────────────────────────────────────────────────────────────────

def test_an_oversized_request_is_refused_before_it_is_read(env):  # noqa: F811
    from app.main import MAX_REQUEST_BYTES
    r = env.client.post(f"/api/v1/upload/{env.asha}", headers={**env.auth, "Content-Length": str(MAX_REQUEST_BYTES + 1)},
                        content=b"x")
    assert r.status_code == 413


def test_too_many_files_in_one_upload_is_refused(env):  # noqa: F811
    from app.services.document_files import MAX_FILES
    files = [("files", (f"p{i}.png", io.BytesIO(env.docs["rx_readable.png"]), "image/png")) for i in range(MAX_FILES + 1)]
    r = env.client.post(f"/api/v1/upload/{env.asha}", files=files, headers=env.auth)
    assert r.status_code == 400 and "Too many files" in r.json()["detail"]
    assert env.db.storage_objects == {} or len(env.db.storage_objects) == 0


def test_a_file_pretending_to_be_an_image_is_refused(env):  # noqa: F811
    files = [("files", ("x.png", io.BytesIO(b"<script>alert(1)</script>"), "image/png"))]
    assert env.client.post(f"/api/v1/upload/{env.asha}", files=files, headers=env.auth).status_code == 400


# ── input ────────────────────────────────────────────────────────────────────

def test_search_wildcards_are_literal(env):  # noqa: F811
    upload(env, env.asha, "rx_readable.png")
    hits = env.client.get("/api/v1/search", params={"q": "%"}, headers=env.auth).json()
    rows = hits.get("results", hits) if isinstance(hits, dict) else hits
    assert rows == [] or len(rows) == 0


def test_questions_and_searches_are_bounded(env):  # noqa: F811
    long_q = env.client.post(f"/api/v1/profiles/{env.asha}/ask", json={"question": "x" * 501}, headers=env.auth)
    assert long_q.status_code == 422
    long_s = env.client.get("/api/v1/search", params={"q": "x" * 201}, headers=env.auth)
    assert long_s.status_code == 422


def test_another_accounts_records_stay_out_of_reach(env):  # noqa: F811
    rid = upload(env, env.asha, "rx_readable.png").json()["record_id"]
    o = env.other_auth
    assert env.client.get(f"/api/v1/profiles/{env.asha}/records", headers=o).status_code == 404
    assert env.client.get(f"/api/v1/profiles/{env.asha}/records/{rid}", headers=o).status_code == 404
    assert env.client.delete(f"/api/v1/profiles/{env.asha}/records/{rid}", headers=o).status_code == 404
    # Own profile id, someone else's record id.
    assert env.client.get(f"/api/v1/profiles/{env.stranger}/records/{rid}", headers=o).status_code == 404
    assert env.client.get(f"/api/v1/profiles/{env.asha}/records").status_code in (401, 403)
