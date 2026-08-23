import sys
from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings

# A short signing key is brute-forceable, and forging a JWT here means taking
# over any account and reading that family's medical records.
MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    JWT_SECRET: str
    JWT_EXPIRE_HOURS: int = 24
    GROQ_API_KEY: str
    GROQ_TEXT_MODEL: str = "openai/gpt-oss-120b"
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    DEBUG: bool = False

    @field_validator("JWT_SECRET")
    @classmethod
    def _reject_weak_secret(cls, value: str) -> str:
        if len(value) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                f"must be at least {MIN_JWT_SECRET_LENGTH} characters; generate one with "
                '`python -c "import secrets; print(secrets.token_urlsafe(48))"`'
            )
        return value

    class Config:
        env_file = ".env"


try:
    settings = Settings()
except ValidationError as e:
    missing = [str(err["loc"][0]) for err in e.errors() if err["type"] == "missing"]
    invalid = [
        f"{err['loc'][0]}: {err['msg'].removeprefix('Value error, ')}"
        for err in e.errors()
        if err["type"] != "missing"
    ]
    sys.stderr.write("\nFATAL: MediVault backend cannot start.\n")
    if missing:
        sys.stderr.write("  Missing environment variable(s): " + ", ".join(missing) + "\n")
    for problem in invalid:
        sys.stderr.write("  Invalid setting -> " + problem + "\n")
    sys.stderr.write(
        "  Set them in your host's environment settings (see backend/.env.example).\n\n"
    )
    raise SystemExit(1)
