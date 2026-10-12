"""Stops password guessing against one account.

The per-address rate limit on /login cannot do this on its own: behind a proxy
the address may be shared by everyone, and an attacker can rotate addresses.
So failures are also counted per account (by email): after MAX_FAILURES wrong
passwords within WINDOW, that account refuses sign-in for LOCKOUT. A correct
password clears the count.

In memory, per process: enough to make guessing hopeless (5 tries per 15
minutes), and a restart only ever loosens it. Nothing here is stored or logged.
"""
import threading
import time

MAX_FAILURES = 5
WINDOW = 15 * 60
LOCKOUT = 15 * 60

_lock = threading.Lock()
_failures: dict = {}       # email -> [timestamps of recent failures]
_locked_until: dict = {}   # email -> unix time


def _key(email: str) -> str:
    return (email or "").strip().lower()


def seconds_locked(email: str, now: float = None) -> int:
    """How long this account must wait before trying again (0 when it may)."""
    now = time.time() if now is None else now
    with _lock:
        until = _locked_until.get(_key(email), 0)
        if until <= now:
            _locked_until.pop(_key(email), None)
            return 0
        return int(until - now) + 1


def record_failure(email: str, now: float = None) -> None:
    now = time.time() if now is None else now
    key = _key(email)
    with _lock:
        recent = [t for t in _failures.get(key, []) if now - t < WINDOW]
        recent.append(now)
        if len(recent) >= MAX_FAILURES:
            _locked_until[key] = now + LOCKOUT
            recent = []
        _failures[key] = recent
        # Keep memory bounded if someone sprays many addresses.
        if len(_failures) > 10000:
            for k in [k for k, ts in _failures.items() if not ts or now - ts[-1] >= WINDOW]:
                _failures.pop(k, None)


def record_success(email: str) -> None:
    key = _key(email)
    with _lock:
        _failures.pop(key, None)
        _locked_until.pop(key, None)


def reset() -> None:
    """For tests."""
    with _lock:
        _failures.clear()
        _locked_until.clear()
