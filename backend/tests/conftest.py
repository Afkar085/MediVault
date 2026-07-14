"""Pytest setup: provide dummy settings before any app module is imported.

The app's Settings model requires these env vars at import time, and several
modules build clients (Supabase, Groq) on import. We inject harmless dummy
values so the suite can import and unit-test pure logic without real
credentials or network access.
"""
import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
# supabase-py validates that the key is JWT-shaped at client creation, so use a
# dummy (non-functional) JWT rather than an arbitrary string.
os.environ.setdefault(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.dummy-signature-for-tests-only",
)
os.environ.setdefault("JWT_SECRET", "test-secret-for-ci-only")
os.environ.setdefault("JWT_EXPIRE_HOURS", "24")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")
os.environ.setdefault("FRONTEND_ORIGINS", "*")
