"""Settings must refuse to start on a configuration that isn't safe."""
import pytest
from pydantic import ValidationError

from app.config import MIN_JWT_SECRET_LENGTH, Settings

_BASE = {
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_KEY": "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.dummy",
    "GROQ_API_KEY": "test-groq-key",
}


def _settings(secret: str) -> Settings:
    return Settings(JWT_SECRET=secret, **_BASE)


def test_short_jwt_secret_is_rejected():
    """A guessable signing key means anyone can forge a token for any account."""
    with pytest.raises(ValidationError) as exc:
        _settings("hunter2")
    assert "at least" in str(exc.value)


def test_secret_one_character_short_is_rejected():
    with pytest.raises(ValidationError):
        _settings("x" * (MIN_JWT_SECRET_LENGTH - 1))


def test_secret_of_minimum_length_is_accepted():
    assert _settings("x" * MIN_JWT_SECRET_LENGTH).JWT_SECRET

