"""Endpoints that spend money or hand out tokens must be rate limited."""
import app.main  # noqa: F401  - importing registers every route's limits
from app.limiter import limiter

# Anything here calls an LLM or issues credentials on every request. Without a
# limit, one account can drain the deployment's whole Groq quota.
EXPECTED = {
    "app.api.v1.endpoints.auth.check_email",
    "app.api.v1.endpoints.auth.register",
    "app.api.v1.endpoints.auth.login",
    "app.api.v1.endpoints.upload.upload_file",
    "app.api.v1.endpoints.records.get_health_journey",
    "app.api.v1.endpoints.records.ask_records",
}


def test_expensive_endpoints_are_rate_limited():
    assert EXPECTED <= set(limiter._route_limits)


def test_every_registered_limit_is_actually_bounded():
    for route, limits in limiter._route_limits.items():
        assert limits, route
        for item in limits:
            assert item.limit.amount > 0, route
