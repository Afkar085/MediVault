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
    # Deliberately unconstrained: accounts created before the rule existed must
    # still be able to sign in.
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
