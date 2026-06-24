from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    JWT_SECRET: str
    JWT_EXPIRE_HOURS: int = 24
    GROQ_API_KEY: str
    class Config:
        env_file = ".env"

settings = Settings()