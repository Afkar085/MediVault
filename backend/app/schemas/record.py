from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


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
    file_url: str
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
    insurance_claimed: Optional[bool] = False
    visit_group: Optional[str] = None
    created_at: Optional[datetime] = None
    medicines: List[MedicineResponse] = []
    files: List[RecordFileResponse] = []


class RecordUpdate(BaseModel):
    document_type: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    document_date: Optional[date] = None
    specialty: Optional[str] = None
    diagnosis: Optional[str] = None
    recommendations: Optional[str] = None
    document_category: Optional[str] = None
    bill_amount: Optional[float] = None


class RecordEditResponse(BaseModel):
    id: str
    record_id: str
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    edited_at: datetime
