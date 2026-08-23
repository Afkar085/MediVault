"""What a password has to be before it can protect a family's medical records."""
import pytest
from pydantic import ValidationError

from app.schemas.auth import MIN_PASSWORD_LENGTH, LoginRequest, RegisterRequest


def test_a_trivial_password_is_rejected():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="a")


def test_password_one_character_short_is_rejected():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="x" * (MIN_PASSWORD_LENGTH - 1))


def test_password_at_the_minimum_is_accepted():
    assert RegisterRequest(email="a@b.com", password="x" * MIN_PASSWORD_LENGTH)


def test_password_beyond_what_bcrypt_reads_is_rejected_not_truncated():
    """bcrypt only hashes the first 72 bytes. Accepting more would let someone
    believe a 200-character passphrase is stronger than it actually is."""
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="x" * 200)


def test_existing_accounts_can_still_sign_in_with_a_short_password():
    """The rule applies to new passwords; it must not lock anyone out."""
    assert LoginRequest(email="a@b.com", password="old")


def test_email_must_look_like_an_email():
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", password="x" * MIN_PASSWORD_LENGTH)
