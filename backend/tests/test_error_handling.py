"""Audit Job 5: a save that failed used to look like nothing happened.

Two causes, both fixed: an unexpected error came back with no CORS header (so
the browser could not read it), and a dropped database connection failed a
request that one retry would have saved.
"""
import httpx
import pytest
from fastapi.testclient import TestClient

from app.database import RetryDroppedConnection
from app.main import allowed_origins, app


@app.get("/api/v1/__test_boom")
def _boom():
    raise RuntimeError("something unexpected")


def test_an_unexpected_error_is_json_and_readable_by_the_app():
    origin = allowed_origins[0]
    r = TestClient(app, raise_server_exceptions=False).get("/api/v1/__test_boom", headers={"Origin": origin})
    assert r.status_code == 500
    assert r.json()["detail"].startswith("Something went wrong on our side")
    assert r.headers.get("access-control-allow-origin") == origin


class _Flaky(RetryDroppedConnection):
    """Fails the first send with a dropped connection, then succeeds."""

    def __init__(self):
        super().__init__()
        self.sends = 0

    def _send(self, request):
        self.sends += 1
        if self.sends == 1:
            raise httpx.RemoteProtocolError("Server disconnected without sending a response.", request=request)
        return httpx.Response(200, json=[], request=request)


@pytest.fixture
def flaky(monkeypatch):
    t = _Flaky()
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", lambda self, request: self._send(request))
    return t


@pytest.mark.parametrize("method, path", [
    ("GET", "/rest/v1/records"), ("PATCH", "/rest/v1/records"), ("DELETE", "/rest/v1/medicines"),
    ("POST", "/rest/v1/rpc/check_medicine_names"),
])
def test_safe_requests_are_retried_once_on_a_dropped_connection(flaky, method, path):
    r = flaky.handle_request(httpx.Request(method, "https://x.supabase.co" + path))
    assert r.status_code == 200 and flaky.sends == 2


def test_an_insert_is_never_sent_twice(flaky):
    with pytest.raises(httpx.RemoteProtocolError):
        flaky.handle_request(httpx.Request("POST", "https://x.supabase.co/rest/v1/medicines"))
    assert flaky.sends == 1


def test_the_retry_is_installed_on_the_database_client():
    from app.database import supabase
    assert isinstance(supabase.postgrest.session._transport, RetryDroppedConnection)
