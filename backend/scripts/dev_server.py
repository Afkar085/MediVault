"""Run the real MediVault API locally against in-memory fakes. No credentials needed.

LOCAL DEVELOPMENT AND TESTING ONLY. Data lives in memory and is gone on restart.

    cd backend
    python scripts/dev_server.py            # API on http://localhost:8787
    # frontend/.env.local: REACT_APP_API_URL=http://localhost:8787/api/v1

Sign in with the dev account below. It exists only inside this process.
Two members are seeded so family isolation can be checked, including one record
that failed OCR (so the "couldn't be read" path is present from the start).

GET /__dev/stats shows request counters (selects, vision and text model calls),
which is how the performance changes were measured.
"""
import os
import sys
from pathlib import Path

DEV_EMAIL = "dev@example.com"  # .test is rejected by the email validator
DEV_PASSWORD = "local-dev-only-password"
OTHER_EMAIL = "other@example.com"  # a second account, for cross-user isolation checks
PORT = int(os.environ.get("MEDIVAULT_DEV_PORT", "8787"))

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

# Settings are read at import time, and backend/.env may hold real credentials:
# override everything so this process can never reach a real project.
os.environ.update({
    "SUPABASE_URL": "http://fake-supabase.invalid",
    "SUPABASE_KEY": "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiZGV2In0.local-dev-only",
    "JWT_SECRET": "local-dev-only-jwt-secret-0123456789abcdef",
    "GROQ_API_KEY": "local-dev-only",
    "ALLOWED_ORIGINS": "http://localhost:3100,http://localhost:3000,http://127.0.0.1:3100",
    "DEBUG": "true",
})

import dev_fakes  # noqa: E402

DB = dev_fakes.FakeDB()
DB.base_url = f"http://localhost:{PORT}"
dev_fakes.install(DB)

from fastapi import HTTPException  # noqa: E402
from fastapi.responses import Response  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402


@app.get("/__dev_storage/{path:path}", include_in_schema=False)
def dev_storage(path: str):
    if path not in DB.storage_objects:
        raise HTTPException(status_code=404)
    return Response(DB.storage_objects[path], media_type=DB.storage_types.get(path, "image/png"))


@app.get("/__dev/sample/{name}", include_in_schema=False)
def dev_sample(name: str):
    """The generated test documents, so a browser test can pick them as files."""
    import tempfile
    from make_dev_documents import DOCUMENTS, make

    if name not in DOCUMENTS:
        raise HTTPException(status_code=404)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / name
        make(path, DOCUMENTS[name])
        return Response(path.read_bytes(), media_type="image/png",
                        headers={"Access-Control-Allow-Origin": "*"})


@app.post("/__dev/models", include_in_schema=False)
def dev_models(fail: bool = False):
    """Make every OCR and language-model call fail (fail=true) or work again."""
    dev_fakes.FakeGroq.failing = fail
    return {"failing": fail}


@app.get("/__dev/stats", include_in_schema=False)
def dev_stats():
    return {**DB.stats, "rows": {t: len(rows) for t, rows in DB.tables.items()},
            "storage_objects": len(DB.storage_objects)}


def seed():
    from make_dev_documents import DOCUMENTS, make  # noqa: F401
    import tempfile

    users = DB.table("users").insert([
        {"email": DEV_EMAIL, "hashed_password": hash_password(DEV_PASSWORD)},
        {"email": OTHER_EMAIL, "hashed_password": hash_password(DEV_PASSWORD)},
    ]).execute().data
    me, other = users[0]["id"], users[1]["id"]
    profiles = DB.table("profiles").insert([
        {"user_id": me, "name": "Asha Kumar", "relationship": "Self"},
        {"user_id": me, "name": "Ravi Kumar", "relationship": "Father"},
        {"user_id": other, "name": "Someone Else", "relationship": "Self"},
    ]).execute().data
    asha, ravi, stranger = (p["id"] for p in profiles)

    with tempfile.TemporaryDirectory() as tmp:
        bad = Path(tmp) / "bad.png"
        make(bad, None)
        bad_bytes = bad.read_bytes()

    def add(profile_id, owner, status, fields, meds=(), file_bytes=None, ocr=None):
        path = None
        if file_bytes is not None:
            path = f"{owner}/{profile_id}/seed-{len(DB.storage_objects)}.png"
            DB.storage.from_("medical-records").upload(path, file_bytes, {"content-type": "image/png"})
        rec = DB.table("records").insert({
            "profile_id": profile_id, "document_type": fields.pop("document_type", "Prescription"),
            "status": status, "file_path": path, "raw_ocr_text": ocr, **fields,
        }).execute().data[0]
        if path:
            DB.table("record_files").insert({"record_id": rec["id"], "file_path": path, "file_url": "",
                                             "page_number": 1}).execute()
        if meds:
            DB.table("medicines").insert([{"record_id": rec["id"], **m} for m in meds]).execute()
        return rec

    add(asha, me, "done", {
        "doctor_name": "Dr. Anil Shetty", "hospital_name": "City ENT Centre", "specialty": "ENT",
        "document_date": "2026-08-12", "diagnosis": "Allergic rhinitis", "document_category": "prescription",
        "recommendations": "Steam inhalation twice daily",
    }, meds=[
        {"name": "MONTELUKAST 10MG", "dosage": "10mg", "frequency": "0-0-1", "duration": "10 days"},
        {"name": "PARACETAMOL 500MG", "dosage": "500mg", "frequency": "SOS", "duration": "3 days"},
    ], ocr="Dr. Anil Shetty\nCity ENT Centre\nDiagnosis: Allergic rhinitis\nRx: MONTELUKAST 10MG\nRx: PARACETAMOL 500MG")
    add(asha, me, "failed", {"document_category": "prescription", "document_type": "Unknown"}, file_bytes=bad_bytes)
    add(asha, me, "done", {
        "document_type": "Lab Report", "document_category": "lab_report", "hospital_name": "Lakeside Diagnostics",
        "document_date": "2026-08-13", "diagnosis": "Haemoglobin 12.9 g/dL; WBC within range",
    }, ocr="LAB REPORT\nResult: Haemoglobin 12.9 g/dL")
    add(asha, me, "done", {
        "document_type": "Other", "document_category": "bill", "hospital_name": "City ENT Centre",
        "document_date": "2026-08-12", "bill_amount": 650.0,
    }, ocr="INVOICE\nTotal: 650.00")
    # Read, but the date could not be made out: should be flagged for review.
    add(asha, me, "done", {
        "doctor_name": "Dr. Leela Menon", "document_category": "prescription", "diagnosis": "Migraine",
    }, meds=[{"name": "NAPROXEN 250MG", "dosage": "250mg", "frequency": "SOS", "duration": "5 days"}],
        ocr="Dr. Leela Menon\nDiagnosis: Migraine\nRx: NAPROXEN 250MG")
    # The same prescription saved twice before uploads were de-duplicated.
    for _ in range(2):
        add(asha, me, "done", {
            "doctor_name": "Dr. Kiran Rao", "hospital_name": "Sunrise Clinic", "document_category": "prescription",
            "document_date": "2026-05-03", "diagnosis": "Viral fever",
        }, meds=[{"name": "DOLO 650", "dosage": "650mg", "frequency": "1-1-1", "duration": "3 days"}],
            ocr="Dr. Kiran Rao\nDiagnosis: Viral fever\nRx: DOLO 650")
    add(ravi, me, "done", {
        "doctor_name": "Dr. Kiran Patel", "hospital_name": "Heart Care Hospital", "specialty": "Cardiology",
        "document_date": "2026-07-02", "diagnosis": "Hypertension", "document_category": "prescription",
    }, meds=[{"name": "AMLODIPINE 5MG", "dosage": "5mg", "frequency": "1-0-0", "duration": "30 days"}],
        ocr="Dr. Kiran Patel\nDiagnosis: Hypertension\nRx: AMLODIPINE 5MG")
    add(stranger, other, "done", {
        "doctor_name": "Dr. Private Person", "document_date": "2026-06-01", "diagnosis": "Should never leak",
        "document_category": "prescription",
    }, meds=[{"name": "SECRETMED 1MG"}], ocr="Should never leak")


if __name__ == "__main__":
    import uvicorn

    seed()
    print(f"\nMediVault dev API on http://localhost:{PORT}  (sign in as {DEV_EMAIL})\n")
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
