from fastapi import APIRouter, HTTPException, Request, Depends
from app.config import settings
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse
from app.core import login_guard, sessions
from app.core.security import hash_password, verify_password, create_access_token, DUMMY_HASH
from app.core.dependencies import get_current_user
from app.database import supabase
from app.services.document_files import thumbnail_path
from app.limiter import limiter

router = APIRouter()


# Used only when there is no refresh token to renew the session with, which
# means the session store is unavailable (most likely migration 007 has not
# been applied yet). Falling back to the access token's old lifetime keeps
# people signed in exactly as long as they were before, rather than cutting
# their session to an hour because the half of the mechanism that renews it
# is missing.
LEGACY_ACCESS_TOKEN_HOURS = 24


def _tokens(user_id: str, refresh_token: str | None = None) -> TokenResponse:
    """An access token plus the refresh token that will renew it."""
    if refresh_token is None:
        refresh_token = sessions.issue(user_id)
    hours = settings.JWT_EXPIRE_HOURS if refresh_token else LEGACY_ACCESS_TOKEN_HOURS
    return TokenResponse(
        access_token=create_access_token(user_id, hours),
        refresh_token=refresh_token,
        expires_in=hours * 3600,
    )


@router.post("/register", response_model=TokenResponse)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest):
    existing = supabase.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(body.password)
    result = supabase.table("users").insert({
        "email": body.email,
        "hashed_password": hashed
    }).execute()

    user_id = result.data[0]["id"]

    # Use name from request if provided, otherwise derive from email
    name = getattr(body, "name", None) or body.email.split("@")[0]
    supabase.table("profiles").insert({
        "user_id": user_id,
        "name": name,
        "relationship": "Self"
    }).execute()

    return _tokens(user_id)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, body: LoginRequest):
    wait = login_guard.seconds_locked(body.email)
    if wait:
        raise HTTPException(
            status_code=429,
            detail="Too many wrong passwords for this account. Try again in a few minutes.",
            headers={"Retry-After": str(wait)},
        )

    result = supabase.table("users").select("id, hashed_password").eq("email", body.email).execute()
    user = result.data[0] if result.data else None
    # An unknown email still costs one bcrypt check, so the response time does
    # not reveal which addresses have an account.
    ok = verify_password(body.password, user["hashed_password"] if user else DUMMY_HASH)
    if not (user and ok):
        login_guard.record_failure(body.email)
        raise HTTPException(status_code=401, detail="Invalid credentials")

    login_guard.record_success(body.email)
    return _tokens(user["id"])


# Deliberately generous compared with /login: this is a signed-in client
# renewing its own session, not an attempt to guess a password. Too tight a
# limit here would sign people out, which is the exact problem refresh tokens
# exist to solve.
@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("60/minute")
def refresh(request: Request, body: RefreshRequest):
    """Exchange a refresh token for a new access token and a new refresh token.

    No access token is required, and an expired one is fine: an expired access
    token is the normal reason to be here.
    """
    rotated = sessions.rotate(body.refresh_token)
    if not rotated:
        raise HTTPException(status_code=401, detail="Your session has ended. Please sign in again.")
    user_id, new_refresh = rotated
    return _tokens(user_id, new_refresh)


@router.post("/logout")
def logout(body: RefreshRequest):
    """End this session. Always succeeds, so signing out never gets stuck."""
    sessions.revoke(body.refresh_token)
    return {"message": "Signed out"}


@router.delete("/account")
def delete_account(user_id: str = Depends(get_current_user)):
    profiles = supabase.table("profiles").select("id").eq("user_id", user_id).execute().data
    profile_ids = [p["id"] for p in profiles]

    if profile_ids:
        records = supabase.table("records").select("id, file_path").in_("profile_id", profile_ids).execute().data
        record_ids = [r["id"] for r in records]
        paths = [r["file_path"] for r in records if r.get("file_path")]

        if record_ids:
            files = supabase.table("record_files").select("file_path").in_("record_id", record_ids).execute().data
            paths += [f["file_path"] for f in files if f.get("file_path")]

        if paths:
            try:
                paths += [thumbnail_path(p) for p in paths]
                supabase.storage.from_("medical-records").remove(list(set(paths)))
            except Exception:
                pass  # DB rows are removed below regardless; orphaned storage objects can be cleaned up manually

    # Every device this account was signed in on stops working immediately,
    # even if the row delete below were to fail partway.
    sessions.revoke_all(user_id)

    # DB rows cascade: users -> profiles -> records -> medicines/record_files/record_edits (ON DELETE CASCADE in schema.sql)
    supabase.table("users").delete().eq("id", user_id).execute()
    return {"message": "Account and all associated data deleted"}
