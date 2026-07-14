import sys
from pydantic import ValidationError
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    JWT_SECRET: str
    JWT_EXPIRE_HOURS: int = 24
    GROQ_API_KEY: str
    GROQ_TEXT_MODEL: str = "openai/gpt-oss-120b"
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    DEBUG: bool = False

    class Config:
        env_file = ".env"


try:
    settings = Settings()
except ValidationError as e:
    missing = [err["loc"][0] for err in e.errors() if err["type"] == "missing"]
    sys.stderr.write(
        "\nFATAL: MediVault backend cannot start — missing required environment variable(s): "
        + ", ".join(str(m) for m in missing)
        + ".\nSet them in your host's environment settings (see backend/.env.example) before starting the app.\n\n"
    )
    raise SystemExit(1)
