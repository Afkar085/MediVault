"""Tests for retrieval helpers (pure logic, no model/DB)."""
from app.services.retrieval import keyword_rank, reciprocal_rank_fusion, select_context_records


def test_rrf_rewards_agreement():
    # 'b' is high in both rankings -> should rank first after fusion.
    keyword = ["a", "b", "c"]
    vector = ["b", "d", "a"]
    fused = reciprocal_rank_fusion([keyword, vector])
    assert fused[0] == "b"
    assert set(fused) == {"a", "b", "c", "d"}


def test_rrf_single_ranking_preserves_order():
    assert reciprocal_rank_fusion([["x", "y", "z"]]) == ["x", "y", "z"]


def test_rrf_empty():
    assert reciprocal_rank_fusion([]) == []
    assert reciprocal_rank_fusion([[], []]) == []


# --- keyword_rank: the retrieval that runs when the embedding model is absent ---

KNEE = {
    "id": "knee",
    "doctor_name": "Kumar",
    "specialty": "Orthopedics",
    "diagnosis": "Osteoarthritis of the right knee",
    "document_date": "2026-06-14",
    "medicines": [{"name": "Paracetamol"}],
}
BLOOD = {
    "id": "blood",
    "doctor_name": "Bhat",
    "specialty": "Pathology",
    "diagnosis": "Complete blood count normal",
    "document_date": "2026-05-02",
    "medicines": [],
}
SKIN = {
    "id": "skin",
    "doctor_name": "Rao",
    "specialty": "Dermatology",
    "diagnosis": "Eczema",
    "document_date": "2026-01-09",
    "medicines": [{"name": "Hydrocortisone"}],
}
ALL = [BLOOD, SKIN, KNEE]  # deliberately not in relevance order


def test_tokenize_drops_question_words():
    from app.services.retrieval import tokenize

    assert tokenize("What medicines was he prescribed for his knee problem?") == [
        "medicines",
        "prescribed",
        "knee",
        "problem",
    ]


def test_a_question_finds_the_record_it_is_about():
    ranked = keyword_rank(ALL, "What was prescribed for the knee problem?")
    assert ranked[0]["id"] == "knee"


def test_unrelated_records_are_dropped_not_padded():
    """Answering from an unrelated record is worse than finding nothing."""
    ranked = keyword_rank(ALL, "knee")
    assert [r["id"] for r in ranked] == ["knee"]


def test_a_question_about_nothing_in_the_records_returns_nothing():
    assert keyword_rank(ALL, "When is my dentist appointment?") == []


def test_medicine_names_are_searchable():
    assert [r["id"] for r in keyword_rank(ALL, "Was I given paracetamol?")] == ["knee"]


def test_a_year_in_the_question_matches_the_document_date():
    ranked = keyword_rank([BLOOD, SKIN], "dermatology 2026")
    assert ranked[0]["id"] == "skin"


def test_limit_caps_the_context():
    assert len(keyword_rank(ALL, "Kumar Bhat Rao", limit=2)) == 2


def test_query_with_only_stopwords_matches_nothing():
    assert keyword_rank(ALL, "what is the") == []


def test_medicines_can_be_supplied_separately():
    records = [{"id": "knee", "diagnosis": "knee pain"}]
    ranked = keyword_rank(records, "hydrocortisone", {"knee": [{"name": "Hydrocortisone"}]})
    assert [r["id"] for r in ranked] == ["knee"]


# The prescriptions a real user had on file when "what medicines do I have"
# came back "I couldn't find that in the uploaded records".
PRESCRIPTIONS = [
    {
        "id": "r1",
        "doctor_name": "Dr Smith",
        "document_category": "prescription",
        "document_date": "2026-07-10",
        "medicines": [{"name": "Paracetamol"}],
    },
    {
        "id": "r2",
        "doctor_name": "Dr Smith",
        "document_category": "prescription",
        "document_date": "2026-05-31",
        "medicines": [{"name": "Paracetamol"}],
    },
]


def test_a_question_naming_a_medicine_still_ranks_by_overlap():
    ranked = select_context_records(PRESCRIPTIONS, "paracetamol", limit=6)
    assert [r["id"] for r in ranked] == ["r1", "r2"]


def test_asking_for_medicines_reaches_the_prescriptions_that_hold_them():
    """The word "medicines" appears in no record; "Paracetamol" does.

    Term overlap alone therefore scores every record zero, which used to mean
    the user was told nothing was on file while two prescriptions sat there.
    """
    assert keyword_rank(PRESCRIPTIONS, "what medicines do i have", limit=6) == []
    assert select_context_records(PRESCRIPTIONS, "what medicines do i have", limit=6) == PRESCRIPTIONS


def test_a_question_in_another_language_still_reaches_the_records():
    # Tokenising an English field set can never overlap these, so the old
    # behaviour refused every non-English question outright.
    assert select_context_records(PRESCRIPTIONS, "मेरी दवाइयाँ क्या हैं", limit=6) == PRESCRIPTIONS
    assert select_context_records(PRESCRIPTIONS, "ನನ್ನ ಔಷಧಿಗಳು ಯಾವುವು", limit=6) == PRESCRIPTIONS


def test_the_fallback_is_bounded_and_keeps_the_newest_first():
    many = [{"id": f"r{i}", "doctor_name": "Dr Smith"} for i in range(20)]
    selected = select_context_records(many, "unrelatedquestionword", limit=6)
    assert [r["id"] for r in selected] == ["r0", "r1", "r2", "r3", "r4", "r5"]


def test_no_records_at_all_still_yields_nothing_to_answer_from():
    assert select_context_records([], "what medicines do i have", limit=6) == []
