"""The only way the model is allowed to touch medical data.

Every tool is bound at construction time to the profiles the *authenticated
user* owns. There is no tool that takes a user id, no tool that runs arbitrary
SQL, and no tool that can widen its own scope: a record id belonging to another
family simply is not found. Authorization therefore happens before any data
reaches the model, not after.
"""
from typing import Dict, List, Optional

from app.database import supabase
from app.logger import logger
from app.services.passages import relevant_passages
from app.services.retrieval import keyword_rank, reciprocal_rank_fusion, vector_search

# Columns a tool may return. Deliberately excludes file paths and the embedding.
_RECORD_COLUMNS = (
    "id, profile_id, document_type, document_category, status, doctor_name, "
    "hospital_name, document_date, specialty, diagnosis, recommendations, "
    "bill_amount, created_at"
)

MAX_RESULTS = 8


class RecordTools:
    """Read-only access to one user's records, exposed to the model as tools."""

    def __init__(self, profiles: List[dict]):
        self._profiles = profiles
        self._profile_ids = [p["id"] for p in profiles]
        self._by_id = {p["id"]: p for p in profiles}

    # -- helpers -----------------------------------------------------------

    def _resolve_member(self, member: Optional[str]) -> Optional[List[str]]:
        """Map "Dad"/"Abdul"/None onto profile ids the user actually owns.

        Returns None when a name was given but matches nobody, which the caller
        reports as "no such family member" rather than silently widening the
        search to everyone.
        """
        if not member:
            return self._profile_ids
        needle = member.strip().lower()
        # Words people use that the stored relationship does not literally match.
        aliases = {
            "dad": "father", "papa": "father", "appa": "father",
            "mom": "mother", "mum": "mother", "mummy": "mother", "amma": "mother",
            "me": "self", "myself": "self", "i": "self",
            "wife": "spouse", "husband": "spouse",
        }
        needle = aliases.get(needle, needle)

        matches = [
            p["id"] for p in self._profiles
            if needle in (p.get("name") or "").lower()
            or needle == (p.get("relationship") or "").lower()
        ]
        return matches or None

    def _label(self, profile_id: str) -> str:
        profile = self._by_id.get(profile_id, {})
        name = profile.get("name") or "Unknown"
        relationship = profile.get("relationship")
        return f"{name} ({relationship})" if relationship else name

    def _fetch(self, profile_ids: List[str], category: Optional[str] = None) -> List[dict]:
        query = (
            supabase.table("records")
            .select(_RECORD_COLUMNS)
            .in_("profile_id", profile_ids)
            .eq("status", "done")
        )
        if category:
            query = query.eq("document_category", category)
        return query.order("document_date", desc=True).execute().data or []

    def _with_medicines(self, records: List[dict]) -> List[dict]:
        if not records:
            return records
        rows = (
            supabase.table("medicines")
            .select("record_id, name, dosage, frequency, duration")
            .in_("record_id", [r["id"] for r in records])
            .execute()
            .data
            or []
        )
        by_record: Dict[str, list] = {}
        for row in rows:
            by_record.setdefault(row["record_id"], []).append(row)
        for record in records:
            record["medicines"] = by_record.get(record["id"], [])
        return records

    def _present(self, record: dict) -> dict:
        return {
            "record_id": record["id"],
            "member": self._label(record["profile_id"]),
            "date": record.get("document_date") or (record.get("created_at") or "")[:10],
            "doctor": record.get("doctor_name"),
            "department": record.get("specialty"),
            "hospital": record.get("hospital_name"),
            "type": record.get("document_category") or record.get("document_type"),
            "diagnosis": record.get("diagnosis"),
            "advice": record.get("recommendations"),
            "medicines": [
                {k: m.get(k) for k in ("name", "dosage", "frequency", "duration") if m.get(k)}
                for m in record.get("medicines", [])
            ],
        }

    # -- tools -------------------------------------------------------------

    def list_family_members(self) -> dict:
        """Who this user has records for. Lets the model resolve "Dad" itself."""
        return {
            "members": [
                {"name": p.get("name"), "relationship": p.get("relationship")}
                for p in self._profiles
            ]
        }

    def search_records(
        self,
        query: str = "",
        member: Optional[str] = None,
        category: Optional[str] = None,
    ) -> dict:
        ids = self._resolve_member(member)
        if ids is None:
            return {"error": f"No family member matching '{member}'.", "records": []}
        records = self._with_medicines(self._fetch(ids, category))
        if query:
            records = self._rank(records, query, ids)
        return {"records": [self._present(r) for r in records[:MAX_RESULTS]]}

    def _rank(self, records: List[dict], query: str, profile_ids: List[str]) -> List[dict]:
        """Keyword ranking, fused with semantic ranking when it is available.

        Reciprocal rank fusion needs only ranks, so it works whether or not the
        embedding model is installed.
        """
        by_keyword = keyword_rank(records, query, limit=MAX_RESULTS * 2)
        semantic = vector_search(profile_ids, query, limit=MAX_RESULTS * 2)
        if not semantic:
            return by_keyword
        by_id = {r["id"]: r for r in records}
        fused = reciprocal_rank_fusion([[r["id"] for r in by_keyword], semantic])
        return [by_id[i] for i in fused if i in by_id]

    def get_medication_history(
        self, member: Optional[str] = None, medicine: Optional[str] = None
    ) -> dict:
        ids = self._resolve_member(member)
        if ids is None:
            return {"error": f"No family member matching '{member}'.", "prescriptions": []}
        records = self._with_medicines(self._fetch(ids))
        entries = []
        for record in records:
            medicines = record.get("medicines") or []
            if medicine:
                needle = medicine.lower()
                medicines = [m for m in medicines if needle in (m.get("name") or "").lower()]
            if not medicines:
                continue
            entries.append({**self._present(record), "medicines": medicines})
        return {"prescriptions": entries[:MAX_RESULTS]}

    def get_test_history(self, member: Optional[str] = None) -> dict:
        """Lab reports newest first — this is what "when was the last one" needs."""
        ids = self._resolve_member(member)
        if ids is None:
            return {"error": f"No family member matching '{member}'.", "tests": []}
        records = self._fetch(ids, category="lab_report")
        return {"tests": [self._present(r) for r in records[:MAX_RESULTS]]}

    def get_timeline(self, member: Optional[str] = None) -> dict:
        ids = self._resolve_member(member)
        if ids is None:
            return {"error": f"No family member matching '{member}'.", "visits": []}
        records = self._fetch(ids)
        return {
            "visits": [
                {
                    "record_id": r["id"],
                    "member": self._label(r["profile_id"]),
                    "date": r.get("document_date") or (r.get("created_at") or "")[:10],
                    "doctor": r.get("doctor_name"),
                    "department": r.get("specialty"),
                    "diagnosis": r.get("diagnosis"),
                }
                for r in records[:MAX_RESULTS * 2]
            ]
        }

    def retrieve_document_context(self, query: str, member: Optional[str] = None) -> dict:
        """Passages of the scanned documents themselves.

        Values like a haemoglobin reading or a specific instruction live in the
        document text and were never extracted into a column, so the other tools
        cannot see them. Scoped to the same authorized records as everything else.
        """
        ids = self._resolve_member(member)
        if ids is None:
            return {"error": f"No family member matching '{member}'.", "passages": []}
        records = self._fetch(ids)
        if not records:
            return {"passages": []}
        by_id = {r["id"]: r for r in records}
        found = relevant_passages([r["id"] for r in records], query)
        return {
            "passages": [
                {
                    "record_id": p["record_id"],
                    "member": self._label(by_id[p["record_id"]]["profile_id"]),
                    "date": by_id[p["record_id"]].get("document_date"),
                    "doctor": by_id[p["record_id"]].get("doctor_name"),
                    "text": p["text"],
                }
                for p in found
                if p["record_id"] in by_id
            ]
        }

    def get_record_details(self, record_id: str) -> dict:
        """Full detail for one record. A record outside this user's family is
        reported as not found — the id alone grants nothing."""
        rows = (
            supabase.table("records")
            .select(_RECORD_COLUMNS)
            .eq("id", record_id)
            .in_("profile_id", self._profile_ids)
            .execute()
            .data
            or []
        )
        if not rows:
            return {"error": "No such record."}
        return self._present(self._with_medicines(rows)[0])

    # -- dispatch ----------------------------------------------------------

    def call(self, name: str, arguments: dict) -> dict:
        handler = {
            "list_family_members": self.list_family_members,
            "search_records": self.search_records,
            "get_medication_history": self.get_medication_history,
            "get_test_history": self.get_test_history,
            "get_timeline": self.get_timeline,
            "retrieve_document_context": self.retrieve_document_context,
            "get_record_details": self.get_record_details,
        }.get(name)
        if handler is None:
            return {"error": f"Unknown tool '{name}'."}
        try:
            return handler(**(arguments or {}))
        except TypeError as e:
            # The model passed arguments the tool does not take.
            return {"error": f"Bad arguments for {name}: {e}"}
        except Exception as e:
            logger.error("Tool %s failed: %s", name, e)
            return {"error": f"{name} could not be completed."}


_MEMBER_ARG = {
    "type": "string",
    "description": (
        "Which family member, by name or relationship (e.g. 'Father', 'Dad', "
        "'Priya'). Omit to cover everyone in the family."
    ),
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "list_family_members",
            "description": "List the family members this user keeps records for, with their relationships. Call this first if the question names a person.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_records",
            "description": "Find medical records matching a description, such as a condition, doctor, hospital or department.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "What to look for, e.g. 'knee pain' or 'Dr Kumar'."},
                    "member": _MEMBER_ARG,
                    "category": {
                        "type": "string",
                        "enum": ["prescription", "lab_report", "bill", "discharge_summary", "other"],
                        "description": "Restrict to one kind of document.",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_medication_history",
            "description": "Every prescription, newest first, optionally for one medicine. Use for questions about what someone was prescribed or is taking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member": _MEMBER_ARG,
                    "medicine": {"type": "string", "description": "Only prescriptions containing this medicine."},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_test_history",
            "description": "Lab reports and tests, newest first. Use for questions about test results or when a test was last done.",
            "parameters": {"type": "object", "properties": {"member": _MEMBER_ARG}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_timeline",
            "description": "All visits in date order. Use for questions about medical history over a period.",
            "parameters": {"type": "object", "properties": {"member": _MEMBER_ARG}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "retrieve_document_context",
            "description": (
                "The exact wording of the scanned documents. Use this whenever the question "
                "asks about something that would be written on the document rather than "
                "summarised — a test value or reading, a specific instruction, wording the "
                "doctor used. The other tools only return extracted fields."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What to look for in the document text, e.g. 'haemoglobin' or 'physiotherapy'.",
                    },
                    "member": _MEMBER_ARG,
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_record_details",
            "description": "Everything recorded for one specific record id returned by another tool.",
            "parameters": {
                "type": "object",
                "properties": {"record_id": {"type": "string"}},
                "required": ["record_id"],
            },
        },
    },
]
