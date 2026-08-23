"""Exercise the real path end to end: real Supabase, real storage, real Groq.

Nothing here is mocked. It drives the running backend over HTTP exactly as the
browser does, so what it proves is what a user would actually experience.

Safety
------
* Every account it creates is named medivault-itest+<run id>@example.invalid and
  is deleted at the end, which cascades through profiles, records, medicines,
  passages and storage objects.
* It never reads or writes any other account's data.
* It never prints a key, a token or a password.
* It is read-only with respect to schema: it applies no migrations.

Usage
-----
    # terminal 1
    uvicorn app.main:app --reload

    # terminal 2
    python scripts/integration_test.py --image /path/to/a/real/prescription.jpg

The image should be a genuine prescription or lab report photo — the point is to
find out whether OCR reads *your* documents, not a synthetic one.
"""
import argparse
import json
import os
import sys
import time
import uuid
from datetime import datetime

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

API = os.getenv("MEDIVAULT_API", "http://localhost:8000/api/v1")
RUN = uuid.uuid4().hex[:8]
PASSWORD = "itest-" + uuid.uuid4().hex          # never printed, never reused
PROCESSING_TIMEOUT_S = 180

GREEN, YELLOW, RED = "GREEN", "YELLOW", "RED"
_MARK = {GREEN: "[GREEN] ", YELLOW: "[YELLOW]", RED: "[RED]   "}

results = []
created_tokens = []


def check(number, label):
    """Decorator turning a function into a numbered, fail-safe check."""
    def wrap(fn):
        def run(*a, **kw):
            try:
                status, detail = fn(*a, **kw)
            except AssertionError as e:
                status, detail = RED, str(e)
            except Exception as e:
                status, detail = RED, f"{type(e).__name__}: {str(e)[:200]}"
            results.append((number, label, status, detail))
            print(f"{_MARK[status]} {number:2}. {label}")
            if detail:
                print(f"         {detail}")
            return status
        return run
    return wrap


def api(method, path, token=None, **kw):
    headers = kw.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return httpx.request(method, API + path, headers=headers, timeout=180, **kw)


def register(label):
    email = f"medivault-itest+{RUN}-{label}@example.invalid"
    r = api("POST", "/auth/register", json={"email": email, "password": PASSWORD, "name": f"ITest {label}"})
    r.raise_for_status()
    token = r.json()["access_token"]
    created_tokens.append(token)
    return token


# --------------------------------------------------------------------------
# The checks
# --------------------------------------------------------------------------

@check(1, "Backend connects to Supabase")
def c1():
    r = httpx.get(API.rsplit("/api/", 1)[0] + "/health", timeout=30)
    assert r.status_code == 200, f"/health returned {r.status_code}"
    probe = api("POST", "/auth/login", json={"email": f"nobody-{RUN}@example.invalid", "password": "x" * 12})
    assert probe.status_code == 401, (
        f"expected 401 from a real credential lookup, got {probe.status_code}: {probe.text[:120]}"
    )
    return GREEN, "A credential lookup reached the database and came back 401 as it should"


@check(3, "Authentication works")
def c3(state):
    token = register("owner")
    state["token"] = token
    me = api("GET", "/profiles", token=token)
    assert me.status_code == 200, f"authenticated request failed: {me.status_code}"
    anon = api("GET", "/profiles")
    assert anon.status_code in (401, 403), f"unauthenticated request returned {anon.status_code}"
    bad = api("GET", "/profiles", token="not.a.real.token")
    assert bad.status_code == 401, f"a forged token returned {bad.status_code}"
    return GREEN, "Register, authenticated read, unauthenticated reject, forged-token reject"


@check(4, "Profile / member switching works")
def c4(state):
    token = state["token"]
    existing = api("GET", "/profiles", token=token).json()
    assert existing, "registration did not create a Self profile"

    dad = api("POST", "/profiles", token=token, json={"name": "ITest Dad", "relationship": "Father"})
    assert dad.status_code == 200, f"creating a member failed: {dad.text[:160]}"
    state["self_id"] = existing[0]["id"]
    state["dad_id"] = dad.json()["id"]

    both = api("GET", "/profiles", token=token).json()
    assert len(both) == 2, f"expected 2 members, got {len(both)}"

    self_records = api("GET", f"/profiles/{state['self_id']}/records", token=token)
    dad_records = api("GET", f"/profiles/{state['dad_id']}/records", token=token)
    assert self_records.status_code == dad_records.status_code == 200
    assert dad_records.json() == [], "a brand-new member already has records"
    return GREEN, "Two members, each with a separate record list"


@check(5, "Uploading a real prescription works")
def c5(state, image_path):
    token = state["token"]
    with open(image_path, "rb") as fh:
        content = fh.read()
    suffix = os.path.splitext(image_path)[1].lower()
    mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
            ".webp": "image/webp", ".pdf": "application/pdf"}.get(suffix)
    assert mime, f"unsupported test file type {suffix}"

    r = api("POST", f"/upload/{state['self_id']}", token=token,
            files={"files": (os.path.basename(image_path), content, mime)})
    assert r.status_code == 200, f"upload rejected: {r.status_code} {r.text[:200]}"
    body = r.json()
    state["record_id"] = body["record_id"]
    state["file_url"] = body.get("file_url")
    return GREEN, f"{len(content) // 1024} KB accepted, record {body['record_id'][:8]}…, {body['pages']} page(s)"


@check(6, "Storage upload works")
def c6(state):
    token = state["token"]
    record = api("GET", f"/profiles/{state['self_id']}/records/{state['record_id']}", token=token).json()
    files = record.get("files") or []
    assert files, "no record_files row was written"
    assert files[0].get("file_path"), "the stored file has no path"
    state["signed_url"] = files[0].get("file_url")
    return GREEN, f"{len(files)} file row(s), path stored, signed URL {'present' if state['signed_url'] else 'MISSING'}"


@check(7, "OCR actually runs")
def c7(state):
    token = state["token"]
    deadline = time.time() + PROCESSING_TIMEOUT_S
    last = None
    while time.time() < deadline:
        record = api("GET", f"/profiles/{state['self_id']}/records/{state['record_id']}", token=token).json()
        last = record.get("status")
        if last in ("done", "failed"):
            state["record"] = record
            break
        time.sleep(4)
    assert last == "done", f"processing ended as {last!r} after {PROCESSING_TIMEOUT_S}s"
    return GREEN, "Background pipeline reached status=done"


@check(9, "OCR text is stored correctly")
def c9(state):
    text = (state.get("record") or {}).get("raw_ocr_text") or ""
    assert text.strip(), "raw_ocr_text is empty"
    for leak in ("OCR failed", "No text found in image", "PDF text extraction failed"):
        assert leak not in text, f"an error message was stored as the document text: {leak!r}"
    state["ocr_text"] = text
    words = len(text.split())
    return GREEN, f"{len(text)} chars / {words} words stored; no error string in the text"


@check(8, "Extracted fields are stored correctly")
def c8(state):
    record = state.get("record") or {}
    fields = {k: record.get(k) for k in
              ("doctor_name", "hospital_name", "document_date", "specialty", "diagnosis", "document_category")}
    found = {k: v for k, v in fields.items() if v}
    meds = record.get("medicines") or []
    if not found and not meds:
        return YELLOW, "Nothing was extracted. The text was read, so this is the extraction step, not OCR."
    summary = ", ".join(f"{k}={str(v)[:28]}" for k, v in found.items())
    return GREEN, f"{summary}" + (f"; {len(meds)} medicine(s)" if meds else "")


@check(10, "Passage chunking works")
def c10(state):
    from app.services.chunking import chunk_document
    passages = chunk_document(state["ocr_text"])
    assert passages, "the stored document text produced no passages"
    longest = max(len(p) for p in passages)
    return GREEN, f"{len(passages)} passage(s) from the real document, longest {longest} chars"


@check(11, "Migration 004 requirements identified")
def c11(state):
    from app.database import supabase
    try:
        supabase.table("document_passages").select("id").limit(1).execute()
    except Exception:
        return YELLOW, ("document_passages does not exist. Retrieval falls back to chunking "
                        "raw_ocr_text per request, which works. Apply 004 for semantic passages.")
    rows = (supabase.table("document_passages")
            .select("id", count="exact")
            .eq("record_id", state["record_id"]).execute())
    stored = rows.count or 0
    if stored == 0:
        return YELLOW, "Table exists but this upload stored no passages — check the indexing step."
    state["passages_stored"] = stored
    return GREEN, f"{stored} passage row(s) written for this record"


@check(12, "Embeddings work if configured")
def c12(state):
    from app.services.embeddings import embed_text
    vector = embed_text("haemoglobin level")
    if vector is None:
        return YELLOW, ("No embedding model (fastembed not installed, or it did not load). "
                        "Retrieval uses term overlap. This is expected on a small host.")
    state["embeddings"] = True
    assert len(vector) == 384, f"expected a 384-dim vector, got {len(vector)}"
    return GREEN, "fastembed loaded, 384-dim vectors produced"


@check(13, "pgvector retrieval works if 004 applied")
def c13(state):
    if not state.get("passages_stored") or not state.get("embeddings"):
        return YELLOW, "Skipped: needs both migration 004 and a working embedding model."
    from app.services.passages import _from_stored_chunks
    term = state["ocr_text"].split()[0] if state["ocr_text"].split() else "report"
    hits = _from_stored_chunks([state["record_id"]], term, 5)
    if not hits:
        return YELLOW, f"match_chunks returned nothing for {term!r} — check the similarity threshold."
    return GREEN, f"match_chunks returned {len(hits)} passage(s) from the real index"


@check(14, "Fallback document retrieval works")
def c14(state):
    from app.services.passages import _from_ocr_text
    words = [w for w in state["ocr_text"].split() if len(w) > 4]
    assert words, "the document text has no word long enough to search for"
    term = words[0]
    hits = _from_ocr_text([state["record_id"]], term)
    assert hits, f"no passage matched {term!r}, a word taken from the document itself"
    assert term.lower() in hits[0]["text"].lower()
    state["known_term"] = term
    return GREEN, f"Searching the real document for {term!r} returned {len(hits)} passage(s)"


@check(15, "Ask reaches the real Groq API")
def c15(state):
    token = state["token"]
    r = api("POST", f"/profiles/{state['self_id']}/ask", token=token,
            json={"question": f"What does the record mention about {state['known_term']}?"})
    assert r.status_code == 200, f"ask failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    assert body.get("answer", "").strip(), "an empty answer came back"
    state["ask"] = body
    return GREEN, f"Answered in {len(body['answer'])} chars with {len(body.get('sources', []))} source(s)"


@check(16, "Agent tool schema accepted by Groq")
def c16(state):
    token = state["token"]
    r = api("POST", "/ask", token=token, json={"question": "Which doctors have treated my family?"})
    assert r.status_code == 200, f"family ask failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    state["agent"] = body
    used = body.get("used_tools")
    if used is None:
        return YELLOW, ("Answered, but via the retrieval fallback rather than the tool loop — "
                        "so the tool schema was not exercised. Check the backend log for a Groq error.")
    return GREEN, f"Tool loop ran; tools called: {', '.join(used) or '(none)'}"


@check(17, "retrieve_document_context is called when appropriate")
def c17(state):
    token = state["token"]
    r = api("POST", "/ask", token=token, json={
        "question": f"Quote exactly what the document says about {state['known_term']}.",
    })
    assert r.status_code == 200, f"ask failed: {r.status_code}"
    used = r.json().get("used_tools")
    if used is None:
        return YELLOW, "Fell back to plain retrieval, so no tool was chosen."
    if "retrieve_document_context" not in used:
        return YELLOW, f"The model chose {used} instead. Not wrong, but the document tool was not needed."
    state["doc_answer"] = r.json()
    return GREEN, "The model chose the document-text tool for a wording question"


@check(18, "The answer is grounded in the retrieved passage")
def c18(state):
    body = state.get("doc_answer") or state.get("ask") or {}
    answer = body.get("answer", "")
    sources = body.get("sources", [])
    assert answer, "no answer to check"
    if not sources:
        return YELLOW, "The answer cites nothing, so grounding cannot be confirmed from the response."
    excerpts = [s.get("excerpt") for s in sources if s.get("excerpt")]
    if not excerpts:
        return YELLOW, "Sources carry no excerpt, so the answer came from extracted fields, not document text."
    overlap = [w for w in state["known_term"].lower().split()
               if any(w in e.lower() for e in excerpts)]
    assert overlap, "the cited excerpt does not contain the term the question asked about"
    return GREEN, f"Cited excerpt contains {state['known_term']!r}; answer drawn from real document text"


@check(19, "Citations point to the actual source record")
def c19(state):
    token = state["token"]
    body = state.get("doc_answer") or state.get("ask") or {}
    sources = body.get("sources", [])
    if not sources:
        return YELLOW, "No citations returned for this question."
    for src in sources:
        rid = src.get("record_id")
        assert rid, "a citation has no record id"
        pid = src.get("profile_id") or state["self_id"]
        got = api("GET", f"/profiles/{pid}/records/{rid}", token=token)
        assert got.status_code == 200, f"cited record {rid[:8]}… does not resolve ({got.status_code})"
    ids = {s["record_id"] for s in sources}
    assert state["record_id"] in ids, "the uploaded record was not among the cited sources"
    return GREEN, f"All {len(sources)} citation(s) resolve; the uploaded record is among them"


@check(20, "Missing information produces an honest not-found")
def c20(state):
    token = state["token"]
    r = api("POST", f"/profiles/{state['self_id']}/ask", token=token, json={
        "question": "What was my bone density T-score from the DEXA scan in 1997?",
    })
    assert r.status_code == 200, f"ask failed: {r.status_code}"
    answer = r.json().get("answer", "").lower()
    honest = any(p in answer for p in
                 ("couldn't find", "could not find", "not in", "no information", "don't have",
                  "does not contain", "doesn't contain", "no mention", "not mentioned", "unable to find"))
    assert honest, f"did not decline; said: {answer[:220]}"
    assert "t-score" not in answer or "not" in answer, "a T-score appears to have been invented"
    return GREEN, "Declined instead of inventing a measurement"


@check(21, "A user cannot retrieve another family's data")
def c21(state):
    intruder = register("intruder")
    victim_profile = state["self_id"]
    victim_record = state["record_id"]

    probes = [
        ("read the profile", api("GET", f"/profiles/{victim_profile}", token=intruder)),
        ("list its records", api("GET", f"/profiles/{victim_profile}/records", token=intruder)),
        ("read the record", api("GET", f"/profiles/{victim_profile}/records/{victim_record}", token=intruder)),
        ("edit the record", api("PUT", f"/profiles/{victim_profile}/records/{victim_record}",
                                token=intruder, json={"diagnosis": "tampered"})),
        ("delete the record", api("DELETE", f"/profiles/{victim_profile}/records/{victim_record}",
                                  token=intruder)),
        ("upload into it", api("POST", f"/upload/{victim_profile}", token=intruder,
                               files={"files": ("x.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64, "image/png")})),
        ("read its history", api("GET", f"/profiles/{victim_profile}/records/{victim_record}/history",
                                 token=intruder)),
        ("ask about it", api("POST", f"/profiles/{victim_profile}/ask", token=intruder,
                             json={"question": "what medicines?"})),
    ]
    allowed = [name for name, r in probes if r.status_code not in (401, 403, 404)]
    assert not allowed, f"another account was permitted to: {', '.join(allowed)}"

    # The agentic endpoint is scoped by construction; make sure it sees nothing.
    fam = api("POST", "/ask", token=intruder, json={"question": "List every record you can see."})
    if fam.status_code == 200:
        leaked = [s for s in fam.json().get("sources", []) if s.get("record_id") == victim_record]
        assert not leaked, "the assistant surfaced another family's record"

    state["intruder"] = intruder
    return GREEN, f"All {len(probes)} cross-account attempts refused; assistant surfaced nothing"


@check(22, "Signed URLs actually resolve")
def c22(state):
    signed = state.get("signed_url")
    assert signed, "no signed URL was issued for the uploaded document"
    r = httpx.get(signed, timeout=60, follow_redirects=True)
    assert r.status_code == 200, f"the signed URL returned {r.status_code}"
    assert len(r.content) > 0, "the signed URL resolved but returned nothing"
    state["signed_bytes"] = len(r.content)
    return GREEN, f"Fetched {len(r.content) // 1024} KB from the signed URL"


@check(23, "Medical documents are not publicly accessible")
def c23(state):
    signed = state.get("signed_url")
    assert signed, "no signed URL to derive a public URL from"
    # Strip the signature: what remains is the public object path.
    base = signed.split("?")[0].replace("/object/sign/", "/object/public/")
    r = httpx.get(base, timeout=60, follow_redirects=True)
    assert r.status_code != 200, (
        "the document is readable WITHOUT a signature — the bucket is public. "
        "Storage -> medical-records -> set to private."
    )
    unsigned = httpx.get(signed.split("?")[0], timeout=60, follow_redirects=True)
    assert unsigned.status_code != 200, "the signed path serves content without its token"
    return GREEN, f"Unsigned access refused ({r.status_code}); signature is genuinely required"


@check(24, "RLS status verified")
def c24(state):
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
    anon = os.getenv("SUPABASE_ANON_KEY")
    url = os.getenv("SUPABASE_URL")
    if not anon:
        return YELLOW, ("SUPABASE_ANON_KEY not set, so public exposure could not be tested. "
                        "Add it to backend/.env to check this properly.")
    exposed = []
    for table in ("users", "profiles", "records", "medicines", "record_files", "record_edits"):
        r = httpx.get(f"{url}/rest/v1/{table}?select=*&limit=1",
                      headers={"apikey": anon, "Authorization": f"Bearer {anon}"}, timeout=30)
        if r.status_code == 200 and r.json():
            exposed.append(table)
    assert not exposed, (
        f"the anon key can read {', '.join(exposed)} directly over the REST API. "
        "This is what migration 002 closes."
    )
    return GREEN, "The anon key cannot read any medical table"


def cleanup():
    print("\n=== Cleanup ===")
    for token in created_tokens:
        try:
            r = api("DELETE", "/auth/account", token=token)
            print(f"  account deleted: {r.status_code}")
        except Exception as e:
            print(f"  FAILED to delete an account: {e}")
            print("  Remove it by hand: users whose email starts with medivault-itest+")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True, help="a real prescription or lab report")
    parser.add_argument("--keep", action="store_true", help="skip cleanup (leaves test data behind)")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"No such file: {args.image}")
        return 2

    print(f"MediVault integration run {RUN} against {API}")
    print(f"started {datetime.now():%H:%M:%S}\n")

    state = {}
    try:
        c1()
        c3(state)
        c4(state)
        c5(state, args.image)
        c6(state)
        c7(state)
        c9(state)
        c8(state)
        c10(state)
        c11(state)
        c12(state)
        c13(state)
        c14(state)
        c15(state)
        c16(state)
        c17(state)
        c18(state)
        c19(state)
        c20(state)
        c21(state)
        c22(state)
        c23(state)
        c24(state)
    finally:
        if not args.keep:
            cleanup()

    print("\n" + "=" * 66)
    for status in (RED, YELLOW, GREEN):
        rows = [r for r in results if r[2] == status]
        if rows:
            print(f"\n{status} ({len(rows)})")
            for number, label, _, detail in sorted(rows):
                print(f"  {number:2}. {label}")
                if status != GREEN and detail:
                    print(f"      {detail}")

    out = os.path.join(os.path.dirname(__file__), f"integration-{RUN}.json")
    with open(out, "w") as fh:
        json.dump([{"n": n, "check": c, "status": s, "detail": d} for n, c, s, d in sorted(results)], fh, indent=2)
    print(f"\nWritten to {os.path.basename(out)}")
    return 1 if any(r[2] == RED for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
