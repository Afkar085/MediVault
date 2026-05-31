from pydantic import BaseModel
from typing import Optional, List
from datetime import date

class RecordResponse(BaseModel):
    id: str
    profile_id: str
    document_type: str
    status: str
    file_url: Optional[str] = None
    raw_ocr_text: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    document_date: Optional[date] = None
    specialty: Optional[str] = None
    diagnosis: Optional[str] = None
    recommendations: Optional[str] = None

class RecordUpdate(BaseModel):
    document_type: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    document_date: Optional[date] = None
    specialty: Optional[str] = None
    diagnosis: Optional[str] = None
    recommendations: Optional[str] = None