"""Checking medicine names against the list of real medicines.

POST /medicines/check    green, amber or red for each name (the review card)
POST /medicines/confirm  "this name is right": shows green for this account next time
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user
from app.limiter import limiter
from app.services import medicine_names

router = APIRouter()


class CheckRequest(BaseModel):
    names: List[str] = Field(default_factory=list)


class ConfirmRequest(BaseModel):
    name: str


def _valid_name(name: str) -> str:
    name = (name or "").strip()
    if len(name) > medicine_names.MAX_NAME_LENGTH:
        raise HTTPException(status_code=400, detail="A medicine name is too long.")
    return name


@router.post("/medicines/check")
@limiter.limit("60/minute")
def check_names(request: Request, body: CheckRequest, user_id: str = Depends(get_current_user)):
    if len(body.names) > medicine_names.MAX_NAMES:
        raise HTTPException(status_code=400, detail="Too many names at once.")
    names = [_valid_name(n) for n in body.names]
    return {"results": medicine_names.check(names, user_id)}


@router.post("/medicines/confirm")
@limiter.limit("60/minute")
def confirm_name(request: Request, body: ConfirmRequest, user_id: str = Depends(get_current_user)):
    name = _valid_name(body.name)
    if not name:
        raise HTTPException(status_code=400, detail="Type the medicine's name.")
    return {"saved": medicine_names.confirm(user_id, name)}
