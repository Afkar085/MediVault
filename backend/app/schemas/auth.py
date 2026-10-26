from typing import Optional

from pydantic import BaseModel, EmailStr, Field

# Length is the requirement that actually matters; composition rules mostly push
# people towards predictable substitutions. bcrypt only reads the first 72
# bytes, so anything beyond that would be silently ignored.
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 72


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=MIN_PASSWORD_LENGTH,
        max_length=MAX_PASSWORD_LENGTH,
        description=f"At least {MIN_PASSWORD_LENGTH} characters.",
    )
    name: Optional[str] = Field(default=None, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    # No minimum: accounts created before the rule existed must still be able to
    # sign in. The maximum only stops absurd payloads (bcrypt reads 72 bytes).
    password: str = Field(min_length=1, max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Absent only if the session store could not be written to: the client then
    # has a working (short) session rather than a failed sign-in.
    refresh_token: Optional[str] = None
    # Seconds until access_token expires, so the client can refresh *before* a
    # request fails rather than after.
    expires_in: Optional[int] = None


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=512)
