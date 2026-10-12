"""In-memory stand-ins for Supabase and Groq, for running MediVault locally.

LOCAL DEVELOPMENT AND TESTING ONLY. Nothing in app/ imports this module; it is
wired in by scripts/dev_server.py before the app is imported, so a production
deployment cannot pick it up by accident.

Why it exists: the real backend needs a Supabase project and a Groq key, and the
only database most people have credentials for is the one holding real medical
records. This lets the whole app (upload, OCR, extraction, editing, deletion,
search, Ask) run end to end against throwaway data, deterministically.

Fidelity: it implements only the slice of the PostgREST query builder the app
uses, but with the semantics that matter for correctness: update/delete return
the affected rows, foreign keys cascade on delete and are enforced on insert,
unique constraints are enforced, and selecting an unknown column is an error.

Fake OCR: a PNG is "readable" when it carries a text chunk named ``mvtext``
(see scripts/make_dev_documents.py); its value is returned as the document text.
Any other image is treated as unreadable, which is exactly the failure path that
needs exercising. Every vision call sleeps briefly so the processing states are
visible in the UI.
"""
from __future__ import annotations

import copy
import io
import json
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# ── Schema: columns per table, plus FK/unique rules ─────────────────────────

SCHEMA: Dict[str, List[str]] = {
    "users": ["id", "email", "hashed_password", "created_at"],
    "profiles": ["id", "user_id", "name", "relationship", "date_of_birth", "gender", "created_at"],
    "records": [
        "id", "profile_id", "document_type", "status", "file_url", "file_path", "raw_ocr_text",
        "doctor_name", "hospital_name", "document_date", "specialty", "diagnosis", "recommendations",
        "document_category", "bill_amount", "insurance_claimed", "visit_group", "created_at",
        "updated_at", "embedding", "bill_title", "bill_category", "bill_number",
    ],
    "medicines": ["id", "record_id", "name", "dosage", "frequency", "duration"],
    "record_edits": ["id", "record_id", "field_name", "old_value", "new_value", "edited_at"],
    "record_files": ["id", "record_id", "file_url", "file_path", "page_number", "created_at"],
    "document_passages": ["id", "record_id", "chunk_index", "content", "embedding", "created_at"],
}

DEFAULTS = {
    "records": {"status": "processing", "document_category": "prescription", "insurance_claimed": False},
    "record_files": {"page_number": 1},
}

# child table -> (fk column, parent table); all ON DELETE CASCADE in schema.sql
FOREIGN_KEYS = {
    "profiles": ("user_id", "users"),
    "records": ("profile_id", "profiles"),
    "medicines": ("record_id", "records"),
    "record_edits": ("record_id", "records"),
    "record_files": ("record_id", "records"),
    "document_passages": ("record_id", "records"),
}

UNIQUE = {"users": [("email",)], "document_passages": [("record_id", "chunk_index")],
          "record_files": [("file_path",)]}  # migration 005

TIMESTAMP_COLUMNS = {"created_at", "updated_at", "edited_at"}



def _like_regex(pattern: str) -> str:
    """Postgres LIKE: % and _ are wildcards, and a backslash makes the next character literal."""
    out, i = [], 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "\\" and i + 1 < len(pattern):
            out.append(re.escape(pattern[i + 1]))
            i += 2
            continue
        out.append(".*" if ch == "%" else "." if ch == "_" else re.escape(ch))
        i += 1
    return "^" + "".join(out) + "$"


class FakeAPIError(Exception):
    """Mirrors postgrest.exceptions.APIError closely enough for `except Exception`."""


def _now() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


class _Result:
    def __init__(self, data):
        self.data = data
        self.count = None


class FakeDB:
    def __init__(self):
        self.tables: Dict[str, List[dict]] = {name: [] for name in SCHEMA}
        self.lock = threading.RLock()
        self.storage_objects: Dict[str, bytes] = {}
        self.storage_types: Dict[str, str] = {}
        self.base_url = "http://localhost:8787"
        # Counters a test or the dev console can read to check request volume.
        self.stats = {"selects": 0, "vision_calls": 0, "text_calls": 0}

    # -- integrity helpers --------------------------------------------------

    def _check_columns(self, table: str, row: dict):
        unknown = set(row) - set(SCHEMA[table])
        if unknown:
            raise FakeAPIError(f"column {sorted(unknown)} of relation {table} does not exist")

    def _check_fk(self, table: str, row: dict):
        fk = FOREIGN_KEYS.get(table)
        if not fk:
            return
        column, parent = fk
        if not any(p["id"] == row.get(column) for p in self.tables[parent]):
            raise FakeAPIError(f"insert or update on table {table} violates foreign key constraint ({column})")

    def _check_unique(self, table: str, row: dict, ignore_id=None):
        for cols in UNIQUE.get(table, []):
            for existing in self.tables[table]:
                if existing["id"] == ignore_id:
                    continue
                if all(existing.get(c) == row.get(c) for c in cols):
                    raise FakeAPIError(f"duplicate key value violates unique constraint on {table}{cols}")

    def _cascade_delete(self, table: str, ids: List[str]):
        for child, (column, parent) in FOREIGN_KEYS.items():
            if parent != table:
                continue
            doomed = [r["id"] for r in self.tables[child] if r.get(column) in ids]
            if doomed:
                self._cascade_delete(child, doomed)
                self.tables[child] = [r for r in self.tables[child] if r["id"] not in doomed]

    # -- client surface -----------------------------------------------------

    def table(self, name: str) -> "_Query":
        if name not in SCHEMA:
            raise FakeAPIError(f'relation "public.{name}" does not exist')
        return _Query(self, name)

    def rpc(self, name, params):
        # pgvector is not available here; the app treats this as "not migrated".
        raise FakeAPIError(f"function {name} does not exist")

    @property
    def storage(self) -> "_Storage":
        return _Storage(self)


class _Query:
    def __init__(self, db: FakeDB, table: str):
        self.db, self.table = db, table
        self.op = "select"
        self.columns = "*"
        self.payload: Any = None
        self.filters: List = []
        self.orders: List = []
        self._limit: Optional[int] = None
        self._negate_next = False

    # builder ------------------------------------------------------------
    def select(self, columns="*", **_kw):
        self.op, self.columns = ("select", columns) if self.op == "select" else (self.op, columns)
        return self

    def insert(self, payload, **_kw):
        self.op, self.payload = "insert", payload
        return self

    def update(self, payload, **_kw):
        self.op, self.payload = "update", payload
        return self

    def upsert(self, payload, **_kw):
        self.op, self.payload = "upsert", payload
        return self

    def delete(self, **_kw):
        self.op = "delete"
        return self

    def _filter(self, kind, column, value):
        self.filters.append((kind, column, value, self._negate_next))
        self._negate_next = False
        return self

    def eq(self, c, v): return self._filter("eq", c, v)
    def neq(self, c, v): return self._filter("neq", c, v)
    def in_(self, c, v): return self._filter("in", c, list(v))
    def ilike(self, c, v): return self._filter("ilike", c, v)
    def gte(self, c, v): return self._filter("gte", c, v)
    def lte(self, c, v): return self._filter("lte", c, v)
    def lt(self, c, v): return self._filter("lt", c, v)
    def gt(self, c, v): return self._filter("gt", c, v)
    def is_(self, c, v): return self._filter("is", c, v)

    @property
    def not_(self):
        self._negate_next = True
        return self

    def order(self, column, desc=False, **_kw):
        self.orders.append((column, desc))
        return self

    def limit(self, n, **_kw):
        self._limit = n
        return self

    # evaluation -----------------------------------------------------------
    @staticmethod
    def _cmp_value(v):
        return "" if v is None else str(v)

    def _matches(self, row) -> bool:
        for kind, column, value, negate in self.filters:
            if column not in SCHEMA[self.table]:
                raise FakeAPIError(f"column {self.table}.{column} does not exist")
            cell = row.get(column)
            if kind == "eq":
                ok = cell is not None and str(cell) == str(value)
            elif kind == "neq":
                ok = cell is not None and str(cell) != str(value)
            elif kind == "in":
                ok = cell is not None and str(cell) in {str(v) for v in value}
            elif kind == "ilike":
                ok = cell is not None and re.match(_like_regex(str(value)), str(cell), re.I | re.S) is not None
            elif kind in ("gte", "lte", "lt", "gt"):
                if cell is None:
                    ok = False
                else:
                    a, b = self._cmp_value(cell), self._cmp_value(value)
                    ok = {"gte": a >= b, "lte": a <= b, "lt": a < b, "gt": a > b}[kind]
            elif kind == "is":
                ok = cell is None if str(value).lower() == "null" else cell == value
            else:  # pragma: no cover
                raise FakeAPIError(f"unsupported filter {kind}")
            if negate:
                ok = not ok
            if not ok:
                return False
        return True

    def _project(self, row) -> dict:
        spec = self.columns.strip()
        if spec == "*":
            return copy.deepcopy(row)
        out = {}
        # split on commas that are not inside an embedded resource's parens
        parts = [p.strip() for p in re.split(r",(?![^()]*\))", spec) if p.strip()]
        for part in parts:
            embed = re.match(r"^(\w+)\((.*)\)$", part)
            if embed:
                parent, cols = embed.group(1), [c.strip() for c in embed.group(2).split(",")]
                fk = FOREIGN_KEYS.get(self.table)
                if not fk or fk[1] != parent:
                    raise FakeAPIError(f"no relationship between {self.table} and {parent}")
                match = next((p for p in self.db.tables[parent] if p["id"] == row.get(fk[0])), None)
                out[parent] = {c: match.get(c) for c in cols} if match else None
                continue
            if part not in SCHEMA[self.table]:
                raise FakeAPIError(f"column {self.table}.{part} does not exist")
            out[part] = copy.deepcopy(row.get(part))
        return out

    def _sorted(self, rows):
        # Postgres defaults: ASC puts NULLs last, DESC puts them first.
        for column, desc in reversed(self.orders):
            present = sorted((r for r in rows if r.get(column) is not None),
                             key=lambda r: self._cmp_value(r.get(column)), reverse=desc)
            missing = [r for r in rows if r.get(column) is None]
            rows = missing + present if desc else present + missing
        return rows

    def _new_row(self, values: dict) -> dict:
        row = {c: None for c in SCHEMA[self.table]}
        row.update(DEFAULTS.get(self.table, {}))
        for col in TIMESTAMP_COLUMNS & set(SCHEMA[self.table]):
            row[col] = _now()
        row["id"] = str(uuid.uuid4())
        row.update(copy.deepcopy(values))
        return row

    def execute(self) -> _Result:
        db = self.db
        with db.lock:
            rows = db.tables[self.table]
            if self.op == "select":
                db.stats["selects"] += 1
                hits = self._sorted([r for r in rows if self._matches(r)])
                if self._limit is not None:
                    hits = hits[: self._limit]
                return _Result([self._project(r) for r in hits])

            if self.op in ("insert", "upsert"):
                payload = self.payload if isinstance(self.payload, list) else [self.payload]
                created = []
                staged = list(rows)
                for values in payload:
                    db._check_columns(self.table, values)
                    row = self._new_row(values)
                    db._check_fk(self.table, row)
                    for cols in UNIQUE.get(self.table, []):
                        if any(all(e.get(c) == row.get(c) for c in cols) for e in staged):
                            raise FakeAPIError(f"duplicate key value violates unique constraint on {self.table}{cols}")
                    staged.append(row)
                    created.append(row)
                db.tables[self.table] = staged  # all-or-nothing, like one INSERT statement
                return _Result(copy.deepcopy(created))

            if self.op == "update":
                db._check_columns(self.table, self.payload)
                changed = []
                for row in rows:
                    if self._matches(row):
                        candidate = {**row, **copy.deepcopy(self.payload)}
                        db._check_fk(self.table, candidate)
                        db._check_unique(self.table, candidate, ignore_id=row["id"])
                        changed.append((row, candidate))
                for row, candidate in changed:
                    row.update(candidate)
                return _Result([copy.deepcopy(c) for _, c in changed])

            if self.op == "delete":
                doomed = [r for r in rows if self._matches(r)]
                ids = [r["id"] for r in doomed]
                db._cascade_delete(self.table, ids)
                db.tables[self.table] = [r for r in db.tables[self.table] if r["id"] not in ids]
                return _Result(copy.deepcopy(doomed))
        raise FakeAPIError(f"unsupported operation {self.op}")  # pragma: no cover


class _Storage:
    def __init__(self, db: FakeDB):
        self.db = db

    def from_(self, _bucket):
        return self

    def upload(self, path, file, file_options=None):
        options = file_options or {}
        upsert = str(options.get("upsert", "false")).lower() == "true"
        with self.db.lock:
            if path in self.db.storage_objects and not upsert:
                raise FakeAPIError("The resource already exists (Duplicate)")
            self.db.storage_objects[path] = bytes(file)
            self.db.storage_types[path] = options.get("content-type", "application/octet-stream")
        return {"path": path}

    def download(self, path):
        with self.db.lock:
            if path not in self.db.storage_objects:
                raise FakeAPIError("Object not found")
            return self.db.storage_objects[path]

    def remove(self, paths):
        with self.db.lock:
            removed = [p for p in paths if self.db.storage_objects.pop(p, None) is not None]
        return [{"name": p} for p in removed]

    def _sign(self, path):
        return f"{self.db.base_url}/__dev_storage/{path}?token={uuid.uuid4().hex[:12]}"

    def create_signed_url(self, path, expires_in):
        return {"signedURL": self._sign(path)}

    def create_signed_urls(self, paths, expires_in):
        return [{"path": p, "signedURL": self._sign(p), "error": None} for p in paths]


# ── Fake Groq ────────────────────────────────────────────────────────────────

VISION_DELAY_SECONDS = 2.5


class _Msg:
    def __init__(self, content=None, tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls


class _Choice:
    def __init__(self, message):
        self.message = message


class _Resp:
    def __init__(self, content):
        self.choices = [_Choice(_Msg(content))]


def read_dev_text(image_bytes: bytes) -> str:
    """The text a dev document carries in its ``mvtext`` PNG chunk, or ""."""
    try:
        from PIL import Image

        with Image.open(io.BytesIO(image_bytes)) as img:
            return (img.info or {}).get("mvtext", "") or ""
    except Exception:
        return ""


_FIELD_PATTERNS = {
    "doctor_name": r"^(?:Doctor:\s*)?(Dr\.?\s+[^\n]+)$",
    "hospital_name": r"^Hospital:\s*(.+)$",
    "document_date": r"^Date:\s*(\d{4}-\d{2}-\d{2})",
    "specialty": r"^Department:\s*(.+)$",
    "diagnosis": r"^Diagnosis:\s*(.+)$",
    "recommendations": r"^Advice:\s*(.+)$",
}


def extract_from_dev_text(text: str) -> dict:
    """What a careful extractor would return for a dev document. Nothing invented."""
    data: Dict[str, Any] = {"medicines": []}
    for field, pattern in _FIELD_PATTERNS.items():
        m = re.search(pattern, text, re.M | re.I)
        data[field] = m.group(1).strip() if m else None
    lowered = text.lower()
    if "invoice" in lowered or "total:" in lowered:
        data["document_category"], data["document_type"] = "bill", "Other"
        m = re.search(r"Total:\s*([\d.]+)", text, re.I)
        data["bill_amount"] = float(m.group(1)) if m else None
    elif "lab report" in lowered or "result:" in lowered:
        data["document_category"], data["document_type"] = "lab_report", "Lab Report"
    else:
        data["document_category"], data["document_type"] = "prescription", "Prescription"
    for m in re.finditer(r"^Rx:\s*(.+)$", text, re.M):
        name, *rest = [p.strip() for p in m.group(1).split("|")] + ["", "", ""]
        data["medicines"].append({"name": name, "dosage": rest[0] or None,
                                  "frequency": rest[1] or None, "duration": rest[2] or None})
    return data


class _Completions:
    def __init__(self, db: FakeDB):
        self.db = db

    def create(self, **kwargs):
        if FakeGroq.failing:  # simulates the model service being down
            raise RuntimeError("fake model outage")
        messages = kwargs.get("messages") or []
        last = messages[-1] if messages else {}
        content = last.get("content")

        # Vision OCR: the image arrives as a data URL.
        if isinstance(content, list):
            self.db.stats["vision_calls"] += 1
            time.sleep(VISION_DELAY_SECONDS)
            import base64
            url = next((c["image_url"]["url"] for c in content if c.get("type") == "image_url"), "")
            raw = base64.b64decode(url.split(",", 1)[1]) if "," in url else b""
            return _Resp(read_dev_text(raw))

        self.db.stats["text_calls"] += 1
        prompt = content if isinstance(content, str) else ""

        # Tool loop: decline, so the app falls back to grounded retrieval (rag.py).
        if kwargs.get("tools"):
            return _Resp(None)

        # Structured extraction.
        if kwargs.get("response_format"):
            m = re.search(r"OCR Text:\n(.*?)\n\nReturn ONLY", prompt, re.S)
            return _Resp(json.dumps(extract_from_dev_text(m.group(1) if m else prompt)))

        # Grounded answer: cite every record whose context mentions a question word.
        if "Question:" in prompt and "[Record" in prompt:
            question = prompt.rsplit("Question:", 1)[1].split("\n", 1)[0].lower()
            words = [w for w in re.findall(r"[a-z0-9]+", question) if len(w) > 3]
            cited = []
            context = prompt.split("Records:\n", 1)[-1].rsplit("\n\nQuestion:", 1)[0]
            for block in re.split(r"\n\n(?=\[Record \d+\])", context):
                ref = re.match(r"\[Record (\d+)\]", block)
                if ref and any(w in block.lower() for w in words):
                    cited.append(ref.group(1))
            if not cited:
                return _Resp("I couldn't find that in these records.")
            refs = " ".join(f"[Record {n}]" for n in cited)
            return _Resp(f"The records mention **{' '.join(words) or 'this'}** {refs}.")

        # Health journey summary.
        return _Resp("- Sept 2026: Visited the doctor; the records list the prescribed medicines.")


class _Chat:
    def __init__(self, db):
        self.completions = _Completions(db)


class FakeGroq:
    """Drop-in for groq.Groq(api_key=..., timeout=..., max_retries=...)."""

    db: FakeDB = None  # set by install()
    failing = False    # toggled by /__dev/models in dev_server.py

    def __init__(self, *args, **kwargs):
        self.chat = _Chat(FakeGroq.db)


def install(db: FakeDB) -> None:
    """Patch the client constructors BEFORE any app module is imported."""
    import groq
    import supabase

    FakeGroq.db = db
    supabase.create_client = lambda *_a, **_k: db
    groq.Groq = FakeGroq
