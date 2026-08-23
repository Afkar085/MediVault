"""The assistant's tools must never reach outside the user's own family.

Authorization happens when RecordTools is constructed, so these tests check the
queries the tools actually build, not just the values they return.
"""
import pytest

from app.services import agent_tools
from app.services.agent_tools import RecordTools

MINE = [
    {"id": "p-me", "name": "Afkar", "relationship": "Self"},
    {"id": "p-dad", "name": "Abdul", "relationship": "Father"},
]

RECORDS = [
    {
        "id": "r-knee", "profile_id": "p-dad", "document_category": "prescription",
        "doctor_name": "Kumar", "specialty": "Orthopedics",
        "diagnosis": "Osteoarthritis of the right knee", "document_date": "2026-06-14",
        "created_at": "2026-06-14T00:00:00Z", "status": "done",
    },
    {
        "id": "r-blood", "profile_id": "p-me", "document_category": "lab_report",
        "doctor_name": "Bhat", "specialty": "Pathology",
        "diagnosis": "Complete blood count normal", "document_date": "2026-05-02",
        "created_at": "2026-05-02T00:00:00Z", "status": "done",
    },
]

MEDICINES = [
    {"record_id": "r-knee", "name": "Paracetamol", "dosage": "650mg", "frequency": "BD", "duration": "5 days"},
]


class _Query:
    def __init__(self, table, store):
        self.table = table
        self.store = store
        self.filters = {"eq": [], "in_": []}

    def select(self, columns):
        self.store["columns"] = columns
        return self

    def eq(self, column, value):
        self.filters["eq"].append((column, value))
        return self

    def in_(self, column, values):
        self.filters["in_"].append((column, list(values)))
        return self

    def order(self, *a, **k):
        return self

    def execute(self):
        self.store["queries"].append({"table": self.table, **self.filters})
        rows = RECORDS if self.table == "records" else MEDICINES
        for column, value in self.filters["eq"]:
            rows = [r for r in rows if r.get(column) == value]
        for column, values in self.filters["in_"]:
            rows = [r for r in rows if r.get(column) in values]
        return type("R", (), {"data": [dict(r) for r in rows]})()


@pytest.fixture
def spy(monkeypatch):
    store = {"queries": []}
    monkeypatch.setattr(
        agent_tools, "supabase",
        type("S", (), {"table": staticmethod(lambda name: _Query(name, store))})(),
    )
    return store


@pytest.fixture
def tools(spy):
    return RecordTools(MINE)


# --- authorization ----------------------------------------------------------

def test_every_record_query_is_restricted_to_this_users_profiles(tools, spy):
    tools.search_records(query="knee")
    tools.get_timeline()
    tools.get_test_history()
    tools.get_medication_history()

    record_queries = [q for q in spy["queries"] if q["table"] == "records"]
    assert record_queries
    for query in record_queries:
        scoped = [values for column, values in query["in_"] if column == "profile_id"]
        assert scoped, query
        assert set(scoped[0]) <= {"p-me", "p-dad"}


def test_a_record_id_from_another_family_is_simply_not_found(tools, spy):
    result = tools.get_record_details("r-someone-elses")
    assert result == {"error": "No such record."}
    query = [q for q in spy["queries"] if q["table"] == "records"][-1]
    assert ("profile_id", ["p-me", "p-dad"]) in query["in_"]


def test_naming_someone_outside_the_family_widens_nothing(tools):
    result = tools.search_records(query="anything", member="Someone Else")
    assert result["records"] == []
    assert "No family member" in result["error"]


def test_an_unknown_tool_is_refused(tools):
    assert "Unknown tool" in tools.call("run_sql", {"q": "select * from users"})["error"]


def test_bad_arguments_are_reported_not_raised(tools):
    assert "Bad arguments" in tools.call("get_test_history", {"user_id": "p-other"})["error"]


def test_tools_never_return_file_paths_or_embeddings(tools):
    columns = agent_tools._RECORD_COLUMNS
    assert "file_path" not in columns
    assert "embedding" not in columns
    assert "raw_ocr_text" not in columns
    presented = tools.search_records(query="knee")["records"][0]
    assert not {"file_path", "file_url", "embedding"} & set(presented)


# --- resolving who the question is about ------------------------------------

def test_dad_resolves_to_the_father_profile(tools):
    assert tools._resolve_member("Dad") == ["p-dad"]
    assert tools._resolve_member("father") == ["p-dad"]
    assert tools._resolve_member("Abdul") == ["p-dad"]


def test_me_resolves_to_self(tools):
    assert tools._resolve_member("me") == ["p-me"]


def test_no_member_means_the_whole_family(tools):
    assert tools._resolve_member(None) == ["p-me", "p-dad"]


# --- what the tools return --------------------------------------------------

def test_search_finds_the_record_the_question_is_about(tools):
    records = tools.search_records(query="knee pain")["records"]
    assert [r["record_id"] for r in records] == ["r-knee"]
    assert records[0]["member"] == "Abdul (Father)"


def test_medication_history_carries_the_dose(tools):
    entries = tools.get_medication_history(member="Dad")["prescriptions"]
    assert entries[0]["medicines"][0]["name"] == "Paracetamol"
    assert entries[0]["medicines"][0]["dosage"] == "650mg"


def test_medication_history_can_be_filtered_to_one_medicine(tools):
    assert tools.get_medication_history(medicine="ibuprofen")["prescriptions"] == []
    assert tools.get_medication_history(medicine="paracetamol")["prescriptions"]


def test_test_history_only_returns_lab_reports(tools, spy):
    tools.get_test_history()
    query = [q for q in spy["queries"] if q["table"] == "records"][-1]
    assert ("document_category", "lab_report") in query["eq"]


def test_only_finished_records_are_ever_shown(tools, spy):
    tools.get_timeline()
    query = [q for q in spy["queries"] if q["table"] == "records"][-1]
    assert ("status", "done") in query["eq"]


def test_family_members_are_listed_without_ids(tools):
    members = tools.list_family_members()["members"]
    assert members == [
        {"name": "Afkar", "relationship": "Self"},
        {"name": "Abdul", "relationship": "Father"},
    ]
