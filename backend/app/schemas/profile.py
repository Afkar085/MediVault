from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

# Matches the column widths in database/schema.sql. Without these a longer value
# reached Postgres and came back as a 500 instead of a validation error naming
# the field.
NAME_MAX = 100
RELATIONSHIP_MAX = 50
GENDER_MAX = 20

# Health details (migration 011). Bounded so a client cannot post a megabyte
# into a profile.
HEALTH_ITEM_MAX = 80
HEALTH_LIST_MAX = 30
BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]


class LongTermMedicine(BaseModel):
    """A medicine taken every day, e.g. Glycomet GP 1, 1-0-1, for sugar."""
    name: str = Field(min_length=1, max_length=HEALTH_ITEM_MAX)
    dosage: Optional[str] = Field(default=None, max_length=HEALTH_ITEM_MAX)
    frequency: Optional[str] = Field(default=None, max_length=HEALTH_ITEM_MAX)
    for_what: Optional[str] = Field(default=None, max_length=HEALTH_ITEM_MAX)

    @field_validator("name", "dosage", "frequency", "for_what", mode="before")
    @classmethod
    def _strip(cls, value):
        return value.strip() if isinstance(value, str) else value


def _clean_list(values):
    """Trimmed, no blanks, no repeats (case-insensitive), first spelling kept."""
    if values is None:
        return None
    seen, out = set(), []
    for v in values:
        v = (v or "").strip()
        if v and v.lower() not in seen:
            seen.add(v.lower())
            out.append(v)
    return out


class _HealthFields(BaseModel):
    allergies: Optional[List[str]] = Field(default=None, max_length=HEALTH_LIST_MAX)
    conditions: Optional[List[str]] = Field(default=None, max_length=HEALTH_LIST_MAX)
    long_term_medicines: Optional[List[LongTermMedicine]] = Field(default=None, max_length=HEALTH_LIST_MAX)
    blood_group: Optional[BloodGroup] = None

    @field_validator("allergies", "conditions")
    @classmethod
    def _items(cls, values):
        values = _clean_list(values)
        if values and any(len(v) > HEALTH_ITEM_MAX for v in values):
            raise ValueError(f"each item must be at most {HEALTH_ITEM_MAX} characters")
        return values


class _ProfileFields(BaseModel):
    @field_validator("name", "relationship", "gender", mode="before", check_fields=False)
    @classmethod
    def _strip(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("date_of_birth", check_fields=False)
    @classmethod
    def _not_in_the_future(cls, value: Optional[date]) -> Optional[date]:
        if value and value > date.today():
            raise ValueError("cannot be in the future")
        return value


class ProfileCreate(_ProfileFields, _HealthFields):
    name: str = Field(min_length=1, max_length=NAME_MAX)
    relationship: str = Field(min_length=1, max_length=RELATIONSHIP_MAX)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(default=None, max_length=GENDER_MAX)


class ProfileUpdate(_ProfileFields, _HealthFields):
    name: Optional[str] = Field(default=None, min_length=1, max_length=NAME_MAX)
    relationship: Optional[str] = Field(default=None, min_length=1, max_length=RELATIONSHIP_MAX)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(default=None, max_length=GENDER_MAX)


class ProfileResponse(BaseModel):
    id: str
    user_id: str
    name: str
    relationship: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    allergies: List[str] = []
    conditions: List[str] = []
    long_term_medicines: List[LongTermMedicine] = []
    blood_group: Optional[str] = None
