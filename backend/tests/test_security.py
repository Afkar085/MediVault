"""Unit tests for password hashing and JWT handling."""
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


def test_hash_is_not_plaintext():
    hashed = hash_password("supersecret")
    assert hashed != "supersecret"
    assert hashed.startswith("$2")  # bcrypt hash prefix


def test_verify_correct_password():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", hashed) is True


def test_verify_wrong_password():
    hashed = hash_password("right-password")
    assert verify_password("wrong-password", hashed) is False


def test_verify_handles_garbage_hash():
    # Should return False, never raise, on a malformed stored hash.
    assert verify_password("anything", "not-a-real-hash") is False


def test_long_password_does_not_crash():
    # >72 bytes must be handled gracefully (bcrypt's hard limit).
    pw = "a" * 200
    hashed = hash_password(pw)
    assert verify_password(pw, hashed) is True


def test_token_roundtrip():
    token = create_access_token("user-123")
    assert decode_access_token(token) == "user-123"


def test_decode_invalid_token_returns_none():
    assert decode_access_token("garbage.token.value") is None
