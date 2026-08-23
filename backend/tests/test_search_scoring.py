"""Search scoring, including the document text that stays inside Postgres."""
from app.api.v1.endpoints.search import _match_record

RECORD = {
    "id": "r1",
    "profile_id": "p1",
    "doctor_name": "Kumar",
    "hospital_name": "Kasturba Medical College",
    "specialty": "Orthopedics",
    "diagnosis": "Osteoarthritis of the right knee",
    "document_type": "Prescription",
    "document_date": "2026-06-14",
    "created_at": "2026-06-14T00:00:00Z",
}

PROFILES = {"p1": {"name": "Afkar", "relationship": "Self"}}
MEDS = {"r1": [{"name": "Paracetamol"}]}


def score(query, ocr_matches=frozenset()):
    return _match_record(RECORD, query, MEDS, PROFILES, ocr_matches)


def test_a_doctor_name_outranks_everything_else():
    assert score("kumar") > score("prescription")


def test_an_exact_field_match_beats_a_partial_one():
    assert score("orthopedics") > score("ortho")


def test_a_medicine_name_is_matched():
    assert score("paracetamol") > 0


def test_the_family_members_name_is_matched():
    assert score("afkar") > 0


def test_a_relationship_is_matched():
    assert score("self") > 0


def test_a_year_in_the_query_matches_the_date():
    assert score("2026") > 0


def test_a_month_name_matches_the_document_date():
    assert score("june") > 0


def test_an_unrelated_query_scores_nothing():
    assert score("dentist") == 0


def test_a_hit_in_the_scanned_text_still_counts():
    """The text itself never leaves Postgres, so the match arrives as an id set."""
    assert score("tablet") == 0
    assert score("tablet", ocr_matches={"r1"}) == 1


def test_a_text_hit_ranks_below_a_named_field():
    assert score("tablet", ocr_matches={"r1"}) < score("kumar")
