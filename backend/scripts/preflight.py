"""Inspect the environment an integration run would use. Changes nothing.

Answers the questions you need settled *before* pointing a test at real
infrastructure: which project is this, which key am I holding, is there real
data in there, and which migrations have actually been applied.

Never prints a key, a token or a password. Where something must be identified
(the project ref) it is shown partially masked.

    python scripts/preflight.py
"""
import base64
import json
import os
import re
import sys
from urllib.parse import urlparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

REQUIRED = ["SUPABASE_URL", "SUPABASE_KEY", "JWT_SECRET", "GROQ_API_KEY"]
OPTIONAL = ["SUPABASE_ANON_KEY", "GROQ_TEXT_MODEL", "ALLOWED_ORIGINS", "JWT_EXPIRE_HOURS", "DEBUG"]
APP_TABLES = ["users", "profiles", "records", "medicines", "record_edits", "record_files"]

GREEN, YELLOW, RED, INFO = "GREEN", "YELLOW", "RED", "INFO"
_MARK = {GREEN: "[GREEN] ", YELLOW: "[YELLOW]", RED: "[RED]   ", INFO: "[info]  "}

findings = []


def report(status, label, detail=""):
    findings.append((status, label, detail))
    print(f"{_MARK[status]} {label}" + (f"\n         {detail}" if detail else ""))


def mask(value, keep_start=6, keep_end=4):
    if not value:
        return "(unset)"
    if len(value) <= keep_start + keep_end:
        return "*" * len(value)
    return f"{value[:keep_start]}{'…' * 3}{value[-keep_end:]}"


def jwt_role(token):
    """The `role` claim of a Supabase key, read without verifying the signature.

    Only the claims are decoded, never printed in full, and the signature is
    never touched. This is how we tell an anon key from a service_role key
    without asking anyone to reveal either.
    """
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload))
        return claims.get("role"), claims.get("ref")
    except Exception:
        return None, None


def main():
    from dotenv import load_dotenv

    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if not os.path.exists(env_path):
        report(RED, "backend/.env not found",
               "Copy backend/.env.example to backend/.env and fill it in. Nothing here reads it aloud.")
        return summarise()
    load_dotenv(env_path)

    print("\n=== Configuration ===")
    missing = [name for name in REQUIRED if not os.getenv(name)]
    if missing:
        report(RED, "Required variables missing", ", ".join(missing))
        return summarise()
    placeholders = [n for n in REQUIRED
                    if re.search(r"your_|placeholder|changeme|<.*>", os.getenv(n, ""), re.I)]
    if placeholders:
        report(RED, "Still on template placeholders", ", ".join(placeholders) +
               "\n         Open backend/.env and paste the real values in.")
        return summarise()
    report(GREEN, "All required variables are set", ", ".join(REQUIRED))
    present_optional = [n for n in OPTIONAL if os.getenv(n)]
    report(INFO, "Optional variables set", ", ".join(present_optional) or "(none)")

    url = os.getenv("SUPABASE_URL", "")
    ref_from_url = urlparse(url).hostname.split(".")[0] if urlparse(url).hostname else "?"
    role, ref_from_key = jwt_role(os.getenv("SUPABASE_KEY", ""))

    print("\n=== Which project, which key ===")
    report(INFO, "Supabase project", f"ref {mask(ref_from_url)}  (confirm this is the project you intend)")

    if role == "service_role":
        report(GREEN, "SUPABASE_KEY is the service_role key",
               "Correct for this backend: it does its own JWT auth and needs to bypass RLS.")
    elif role == "anon":
        report(RED, "SUPABASE_KEY is the ANON key",
               "The app works today only because RLS is off. Applying 002 while on this key\n"
               "         will make every query return empty and the live app will go blank.")
    elif os.getenv("SUPABASE_KEY", "").startswith(("sb_secret_", "sb_publishable_")):
        report(RED, "That is Supabase's new-format API key",
               "supabase-py 2.10.0 requires the older JWT-shaped key: it regex-checks for\n"
               "         dots before making any request. In the dashboard look for a\n"
               "         'Legacy API keys' section and take service_role from there.")
    else:
        report(YELLOW, "Could not determine the key's role",
               "Not a Supabase-issued JWT. Check it was copied whole, with no line break.")

    if ref_from_key and ref_from_url != "?" and ref_from_key != ref_from_url:
        report(RED, "Key and URL belong to different projects",
               f"URL ref {mask(ref_from_url)} vs key ref {mask(ref_from_key)}")

    print("\n=== Connectivity and contents ===")
    try:
        from app.database import supabase
    except Exception as e:
        report(RED, "Backend could not build a Supabase client", str(e)[:200])
        return summarise()

    counts = {}
    for table in APP_TABLES:
        try:
            res = supabase.table(table).select("id", count="exact").limit(1).execute()
            counts[table] = res.count if res.count is not None else 0
        except Exception as e:
            counts[table] = f"error: {str(e)[:80]}"

    unreachable = [t for t, c in counts.items() if isinstance(c, str)]
    if unreachable:
        report(RED, "Some tables are unreachable", "; ".join(f"{t}: {counts[t]}" for t in unreachable))
    else:
        report(GREEN, "Connected to Supabase", ", ".join(f"{t}={counts[t]}" for t in APP_TABLES))

    real_rows = sum(c for c in counts.values() if isinstance(c, int))
    if real_rows > 0:
        report(YELLOW, f"This project already holds {real_rows} rows",
               "Treat it as production. The integration run creates its own throwaway\n"
               "         accounts and deletes them afterwards; it never reads or writes anyone else's.")
    else:
        report(GREEN, "Project is empty", "Safe to exercise freely.")

    print("\n=== Migrations actually applied ===")
    try:
        supabase.table("records").select("embedding").limit(1).execute()
        report(GREEN, "001 semantic search: records.embedding exists")
    except Exception:
        report(YELLOW, "001 not applied", "records.embedding is missing; semantic record search is off.")

    try:
        supabase.rpc("match_records", {
            "query_embedding": [0.0] * 384, "p_profile_ids": [], "match_count": 1,
        }).execute()
        report(GREEN, "001 RPC match_records is callable")
    except Exception as e:
        report(YELLOW, "match_records not callable", str(e)[:120])

    try:
        supabase.table("document_passages").select("id").limit(1).execute()
        report(GREEN, "004 document_passages table exists")
    except Exception:
        report(YELLOW, "004 not applied",
               "Passage retrieval will chunk raw_ocr_text on the fly instead. That works;\n"
               "         it just matches literally rather than semantically.")

    try:
        supabase.rpc("match_chunks", {
            "query_embedding": [0.0] * 384, "p_record_ids": [], "match_count": 1,
        }).execute()
        report(GREEN, "004 RPC match_chunks is callable")
    except Exception:
        report(YELLOW, "match_chunks not callable", "Expected if 004 has not been applied.")

    print("\n=== Public exposure ===")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not anon_key:
        report(YELLOW, "RLS exposure not tested",
               "Set SUPABASE_ANON_KEY in backend/.env to let preflight try reading your\n"
               "         medical tables the way the public internet would. Without it this is unknown.")
    else:
        import httpx
        leaked = []
        for table in APP_TABLES:
            try:
                r = httpx.get(
                    f"{url}/rest/v1/{table}?select=id&limit=1",
                    headers={"apikey": anon_key, "Authorization": f"Bearer {anon_key}"},
                    timeout=15,
                )
                if r.status_code == 200 and r.json():
                    leaked.append(table)
            except Exception:
                pass
        if leaked:
            report(RED, "Medical tables are readable with the anon key",
                   f"Exposed: {', '.join(leaked)}. This is what migration 002 closes.")
        else:
            report(GREEN, "Anon key cannot read the medical tables")

    try:
        buckets = supabase.storage.list_buckets()
        bucket = next((b for b in buckets if getattr(b, "name", None) == "medical-records"), None)
        if bucket is None:
            report(RED, "Storage bucket 'medical-records' not found")
        elif getattr(bucket, "public", False):
            report(RED, "Storage bucket is PUBLIC",
                   "Every document URL is readable by anyone who has ever seen it.\n"
                   "         Storage -> medical-records -> set to private.")
        else:
            report(GREEN, "Storage bucket is private")
    except Exception as e:
        report(YELLOW, "Could not inspect the storage bucket", str(e)[:120])

    print("\n=== Groq ===")
    try:
        from groq import Groq
        client = Groq(api_key=os.getenv("GROQ_API_KEY"), timeout=30.0, max_retries=0)
        model = os.getenv("GROQ_TEXT_MODEL", "openai/gpt-oss-120b")
        client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": "ok"}], max_tokens=1,
        )
        report(GREEN, f"Groq reachable, model {model} accepted")
    except Exception as e:
        report(RED, "Groq call failed", str(e)[:160])

    return summarise()


def summarise():
    print("\n" + "=" * 62)
    red = [f for f in findings if f[0] == RED]
    yellow = [f for f in findings if f[0] == YELLOW]
    print(f"RED {len(red)}   YELLOW {len(yellow)}   GREEN {len([f for f in findings if f[0] == GREEN])}")
    if red:
        print("\nMust be resolved before an integration run:")
        for _, label, _ in red:
            print(f"  - {label}")
        return 1
    print("\nNo blockers. Safe to run scripts/integration_test.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
