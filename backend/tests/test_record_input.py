"""What a client is allowed to send when editing a record.

Bad input should be a validation error, not a 500 from code that assumed the
shape it was given.
"""
import pytest
from pydantic import ValidationError

from app.schemas.record import RecordUpdate


def test_a_normal_edit_is_accepted():
    body = RecordUpdate(
        doctor_name="Kumar",
        diagnosis="Osteoarthritis, right knee",
        document_category="prescription",
        bill_amount=4820,
        medicines=[{"name": "Paracetamol", "dosage": "650mg"}],
    )
    assert body.medicines[0].name == "Paracetamol"


def test_a_medicine_that_is_not_an_object_is_refused():
    """This used to reach .get() on a string and return a 500."""
    with pytest.raises(ValidationError):
        RecordUpdate(medicines=["aspirin"])


def test_a_medicine_without_a_name_is_refused():
    with pytest.raises(ValidationError):
        RecordUpdate(medicines=[{"dosage": "650mg"}])


def test_an_empty_medicine_name_is_refused():
    with pytest.raises(ValidationError):
        RecordUpdate(medicines=[{"name": ""}])


def test_an_empty_medicine_list_is_allowed():
    """Clearing every medicine off a record is a legitimate edit."""
    assert RecordUpdate(medicines=[]).medicines == []


def test_an_unknown_document_category_is_refused():
    with pytest.raises(ValidationError):
        RecordUpdate(document_category="whatever")


def test_every_category_the_app_can_display_is_accepted():
    for category in ("prescription", "lab_report", "bill", "discharge_summary", "other"):
        assert RecordUpdate(document_category=category).document_category == category


def test_a_negative_bill_amount_is_refused():
    with pytest.raises(ValidationError):
        RecordUpdate(bill_amount=-100)


def test_a_zero_bill_amount_is_allowed():
    assert RecordUpdate(bill_amount=0).bill_amount == 0


def test_an_oversized_field_is_refused():
    """A text column should not be a place to post a megabyte."""
    with pytest.raises(ValidationError):
        RecordUpdate(diagnosis="x" * 10_000)
    with pytest.raises(ValidationError):
        RecordUpdate(doctor_name="x" * 1000)


def test_fields_the_client_must_not_set_are_ignored():
    """Nothing here may reassign a record to another profile or force a status."""
    body = RecordUpdate(profile_id="someone-elses", status="done", id="other")
    assert not hasattr(body, "profile_id")
    assert "profile_id" not in body.model_dump(exclude_none=True)
    assert "status" not in body.model_dump(exclude_none=True)


# --- family member details ---------------------------------------------------

from datetime import date, timedelta  # noqa: E402

from app.schemas.profile import NAME_MAX, ProfileCreate, ProfileUpdate  # noqa: E402


def test_a_family_member_is_created_from_normal_details():
    profile = ProfileCreate(name="Abdul Rahman", relationship="Father")
    assert profile.name == "Abdul Rahman"


def test_surrounding_whitespace_is_trimmed():
    """Otherwise " Mom" and "Mom" become two different people in the switcher."""
    assert ProfileCreate(name="  Mom  ", relationship=" Mother ").name == "Mom"


def test_a_name_longer_than_the_column_is_refused_here():
    """Postgres would reject it too, but as a 500 with no useful message."""
    with pytest.raises(ValidationError):
        ProfileCreate(name="x" * (NAME_MAX + 1), relationship="Father")


def test_a_blank_name_is_refused():
    with pytest.raises(ValidationError):
        ProfileCreate(name="   ", relationship="Father")


def test_a_birth_date_in_the_future_is_refused():
    with pytest.raises(ValidationError):
        ProfileCreate(
            name="A", relationship="Father",
            date_of_birth=date.today() + timedelta(days=1),
        )


def test_todays_date_is_a_valid_birth_date():
    assert ProfileCreate(name="A", relationship="Son", date_of_birth=date.today())


def test_an_update_can_change_one_field_alone():
    assert ProfileUpdate(name="Mom").model_dump(exclude_none=True) == {"name": "Mom"}


def test_an_update_cannot_reassign_the_profile_to_another_account():
    body = ProfileUpdate(name="Mom", user_id="someone-elses", id="other")
    assert "user_id" not in body.model_dump(exclude_none=True)
    assert "id" not in body.model_dump(exclude_none=True)
