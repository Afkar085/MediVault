from pydantic import BaseModel
from typing import Optional
from datetime import date

class ProfileCreate(BaseModel):
    name: str
    relationship: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    relationship: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None

class ProfileResponse(BaseModel):
    id: str
    user_id: str
    name: str
    relationship: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None