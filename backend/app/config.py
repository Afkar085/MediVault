from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    JWT_SECRET: str
    JWT_EXPIRE_HOURS: int = 24
    GROQ_API_KEY: str
    # Comma-separated list of allowed CORS origins. Defaults to "*" for local dev;
    # set to your deployed frontend URL(s) in production,
    # e.g. "https://medi-vault-silk-five.vercel.app".
    FRONTEND_ORIGINS: str = "*"
    class Config:
        env_file = ".env"

settings = Settings()