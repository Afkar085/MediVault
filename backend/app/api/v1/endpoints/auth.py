from fastapi import APIRouter, HTTPException, Request, Depends
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.core.dependencies import get_current_user
from app.database import supabase
from app.limiter import limiter
from pydantic import BaseModel, EmailStr

router = APIRouter()


class CheckEmailRequest(BaseModel):
    email: EmailStr


@router.post("/check-email")
@limiter.limit("10/minute")
def check_email(request: Request, body: CheckEmailRequest):
    existing = supabase.table("users").select("id").eq("email", body.email).execute()
    return {"exists": bool(existing.data)}


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
    result = supabase.table("users").select("*").eq("email", body.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = result.data[0]
    if not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

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
