"""Measure what the app's hot requests actually cost, against the dev server.

    python backend/scripts/dev_server.py            # in another terminal
    python scripts/measure.py [--port 8787]

Reports, for each workflow the user actually waits on: wall-clock time, and the
work the server did to answer it, read from /__dev/stats:

  selects   database read queries
  writes    database UPDATE statements
  signings  signed-URL requests (one HTTPS round-trip each against real
            Supabase, which is why they dominate list latency there)

Numbers from the in-memory dev database are not production latency; the query
and signing counts are, and those are what the changes were aimed at.
"""
import argparse
import json
import statistics
import sys
import time
import urllib.error
import urllib.request

DEV_EMAIL = "dev@example.com"
DEV_PASSWORD = "local-dev-only-password"


class Client:
    def __init__(self, base):
        self.base = base
        self.token = None

    def request(self, method, path, body=None, auth=True):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if data:
            req.add_header("Content-Type", "application/json")
        if auth and self.token:
            req.add_header("Authorization", "Bearer " + self.token)
        started = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                payload = json.loads(response.read() or b"null")
                status = response.status
        except urllib.error.HTTPError as e:
            payload, status = json.loads(e.read() or b"null"), e.code
        return status, payload, (time.perf_counter() - started) * 1000

    def get(self, path, **kw):
        return self.request("GET", path, **kw)

    def post(self, path, body=None, **kw):
        return self.request("POST", path, body, **kw)

    def stats(self):
        return self.get("/__dev/stats", auth=False)[1]


def timed(client, label, path, repeats, results):
    """Run one read `repeats` times and record time and server-side work."""
    before = client.stats()
    times = []
    for _ in range(repeats):
        status, _payload, ms = client.get(path)
        if status != 200:
            print(f"  !! {label}: HTTP {status}")
            return
        times.append(ms)
    after = client.stats()
    row = {
        "workflow": label,
        "requests": repeats,
        "median_ms": round(statistics.median(times), 1),
        "selects": after["selects"] - before["selects"],
        "signings": after.get("signings", 0) - before.get("signings", 0),
        "writes": after.get("writes", 0) - before.get("writes", 0),
    }
    results.append(row)
    print(f"  {label:<34} {row['median_ms']:>7.1f} ms   "
          f"{row['selects']:>4} selects   {row['writes']:>4} writes   "
          f"{row['signings']:>4} signings")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()
    client = Client(f"http://127.0.0.1:{args.port}")

    if client.get("/health", auth=False)[0] != 200:
        sys.exit(f"No dev server on port {args.port}. Start backend/scripts/dev_server.py first.")

    print(f"\nMediVault request cost, dev server on port {args.port}")
    print("=" * 74)

    status, body, login_ms = client.post(
        "/api/v1/auth/login", {"email": DEV_EMAIL, "password": DEV_PASSWORD}, auth=False)
    if status != 200:
        sys.exit(f"Sign-in failed: {status} {body}")
    client.token = body["access_token"]
    refresh_token = body.get("refresh_token")
    print(f"  {'sign in':<34} {login_ms:>7.1f} ms   "
          f"refresh token: {'yes' if refresh_token else 'NO (session store missing)'}")

    profiles = client.get("/api/v1/profiles")[1]
    pid = profiles[0]["id"]

    results = []
    print("\n  First visit (nothing warmed up)")
    timed(client, "dashboard: the records list", f"/api/v1/profiles/{pid}/records", 1, results)

    print("\n  Coming back to it (a reload, or Back)")
    timed(client, "dashboard: the records list x5", f"/api/v1/profiles/{pid}/records", 5, results)
    timed(client, "search: one query x5", "/api/v1/search?q=paracetamol", 5, results)
    timed(client, "search: whole family x5", "/api/v1/search?q=kumar", 5, results)
    timed(client, "upload polling: status x10", f"/api/v1/profiles/{pid}/records/status", 10, results)
    timed(client, "switching members x5", f"/api/v1/profiles/{profiles[1]['id']}/records", 5, results)

    print("\n  Staying signed in")
    if refresh_token:
        status, body, ms = client.post(
            "/api/v1/auth/refresh", {"refresh_token": refresh_token}, auth=False)
        ok = status == 200 and body.get("access_token") and body.get("refresh_token") != refresh_token
        print(f"  {'refresh rotates the session':<34} {ms:>7.1f} ms   {'ok' if ok else 'FAILED'}")
        replay = client.post("/api/v1/auth/refresh", {"refresh_token": refresh_token}, auth=False)
        print(f"  {'a replayed token is refused':<34} {'':>7}      "
              f"{'ok' if replay[0] == 401 else 'FAILED (' + str(replay[0]) + ')'}")
        after_replay = client.post(
            "/api/v1/auth/refresh", {"refresh_token": body["refresh_token"]}, auth=False)
        print(f"  {'and the session it came from ends':<34} {'':>7}      "
              f"{'ok' if after_replay[0] == 401 else 'FAILED (' + str(after_replay[0]) + ')'}")
    else:
        print("  no refresh token: this build cannot keep a session past the access token")

    print("=" * 74)
    print(json.dumps(results))


if __name__ == "__main__":
    main()
