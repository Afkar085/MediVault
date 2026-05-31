from fastapi import APIRouter, HTTPException
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.core.security import hash_password, verify_password, create_access_token
from app.database import supabase
from pydantic import BaseModel, EmailStr

router = APIRouter()


class CheckEmailRequest(BaseModel):
    email: EmailStr


@router.post("/check-email")
def check_email(body: CheckEmailRequest):
    existing = supabase.table("users").select("id").eq("email", body.email).execute()
    return {"exists": bool(existing.data)}


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest):
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
def login(body: LoginRequest):
    result = supabase.table("users").select("*").eq("email", body.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = result.data[0]
    if not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user["id"])
    return TokenResponse(access_token=token)
