from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

# Categories the app understands. Anything else would be stored and then never
# match a filter, an icon or a tab.
DocumentCategory = Literal["prescription", "lab_report", "bill", "discharge_summary", "other"]

# Generous next to a real prescription, small enough that a client cannot post a
# megabyte into a text column.
_SHORT = 200
_LONG = 5000


class MedicineResponse(BaseModel):
    id: str
    record_id: str
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None


class RecordFileResponse(BaseModel):
    id: str
    record_id: str
    file_url: Optional[str] = None
    file_path: str
    page_number: int = 1
    created_at: Optional[datetime] = None


class RecordResponse(BaseModel):
    id: str
    profile_id: str
    document_type: str
    status: str
    file_url: Optional[str] = None
    file_path: Optional[str] = None
    raw_ocr_text: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    document_date: Optional[date] = None
    specialty: Optional[str] = None
    diagnosis: Optional[str] = None
    recommendations: Optional[str] = None
    document_category: Optional[str] = "prescription"
    bill_amount: Optional[float] = None
    bill_category: Optional[str] = None
    bill_title: Optional[str] = None
    bill_number: Optional[str] = None
    insurance_claimed: Optional[bool] = False
    visit_group: Optional[str] = None
    created_at: Optional[datetime] = None
    medicines: List[MedicineResponse] = []
    files: List[RecordFileResponse] = []


class MedicineInput(BaseModel):
    """One prescribed medicine, as sent by the record editor.

    Was `Any`, so a payload of {"medicines": ["aspirin"]} reached code that
    called .get() on a string and returned a 500 instead of a validation error.
    """

    name: str = Field(min_length=1, max_length=_SHORT)
    dosage: Optional[str] = Field(default=None, max_length=_SHORT)
    frequency: Optional[str] = Field(default=None, max_length=_SHORT)
    duration: Optional[str] = Field(default=None, max_length=_SHORT)


class RecordUpdate(BaseModel):
    document_type: Optional[str] = Field(default=None, max_length=_SHORT)
    doctor_name: Optional[str] = Field(default=None, max_length=_SHORT)
    hospital_name: Optional[str] = Field(default=None, max_length=_SHORT)
    document_date: Optional[date] = None
    specialty: Optional[str] = Field(default=None, max_length=_SHORT)
    diagnosis: Optional[str] = Field(default=None, max_length=_LONG)
    recommendations: Optional[str] = Field(default=None, max_length=_LONG)
    document_category: Optional[DocumentCategory] = None
    bill_amount: Optional[float] = Field(default=None, ge=0)
    bill_category: Optional[str] = Field(default=None, max_length=_SHORT)
    bill_title: Optional[str] = Field(default=None, max_length=_SHORT)
    bill_number: Optional[str] = Field(default=None, max_length=_SHORT)
    # A record's medicines are replaced wholesale, so this is the whole list.
    medicines: Optional[List[MedicineInput]] = None


class RecordEditResponse(BaseModel):
    id: str
    record_id: str
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    edited_at: datetime
