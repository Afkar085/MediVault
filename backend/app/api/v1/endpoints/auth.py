from fastapi import APIRouter, HTTPException, Request, Depends
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.core import login_guard
from app.core.security import hash_password, verify_password, create_access_token, DUMMY_HASH
from app.core.dependencies import get_current_user
from app.database import supabase
from app.limiter import limiter

router = APIRouter()


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

    token = create_access_token(user_id)
    return TokenResponse(access_token=token)


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
    token = create_access_token(user["id"])
    return TokenResponse(access_token=token)


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
                supabase.storage.from_("medical-records").remove(list(set(paths)))
            except Exception:
                pass  # DB rows are removed below regardless; orphaned storage objects can be cleaned up manually

    # DB rows cascade: users -> profiles -> records -> medicines/record_files/record_edits (ON DELETE CASCADE in schema.sql)
    supabase.table("users").delete().eq("id", user_id).execute()
    return {"message": "Account and all associated data deleted"}
