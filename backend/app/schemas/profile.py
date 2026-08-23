from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator

# Matches the column widths in database/schema.sql. Without these a longer value
# reached Postgres and came back as a 500 instead of a validation error naming
# the field.
NAME_MAX = 100
RELATIONSHIP_MAX = 50
GENDER_MAX = 20


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


class ProfileCreate(_ProfileFields):
    name: str = Field(min_length=1, max_length=NAME_MAX)
    relationship: str = Field(min_length=1, max_length=RELATIONSHIP_MAX)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(default=None, max_length=GENDER_MAX)


class ProfileUpdate(_ProfileFields):
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
