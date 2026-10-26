"""Request rate limits.

Limits are counted per account whenever the request carries a valid sign-in
token, and per client address otherwise (sign-in and sign-up).

Per account matters because of how the app is hosted: behind Render's proxy
every request can arrive from the proxy's own address, so per-address limits
would put every user in one shared bucket. One busy person could then lock
everyone else out, and the limits on paid AI calls would not be per person at
all. A token cannot be forged without the server's secret, so it is a key a
client cannot spoof (unlike an X-Forwarded-For header).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.security import decode_access_token

# Daily ceilings on the endpoints that spend money (vision OCR and LLM calls),
# per account, on top of their per-minute limits. Generous for a family using
# the app, but they stop one account, or a stolen token, from running up the AI
# bill without end. Counters live in memory, so a restart resets them: the
# hard spending cap belongs in the Groq console, not here.
AI_UPLOADS_PER_DAY = "200/day"
AI_QUESTIONS_PER_DAY = "150/day"
AI_REREADS_PER_DAY = "100/day"


def account_or_address(request) -> str:
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        user_id = decode_access_token(auth[7:].strip())
        if user_id:
            return "user:" + user_id
    return "ip:" + get_remote_address(request)


limiter = Limiter(key_func=account_or_address)
