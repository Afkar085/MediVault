"""Is a medicine read off a page spelled like a real one?

Each name gets a status:
  green    a known brand, a known generic, or a name this person confirmed
  amber    not known, but a known name is close: show it as a one tap fix
  red      nothing close: ask the person to check it
  unchecked  the medicine list is not in the database yet (migration 009 not
           run, or the list not loaded). The app carries on as before.

Names are cleaned here, in Python, the same way the loader cleaned the list
(scripts/load_medicines.py), and matched in one database call per document
(check_medicine_names in migration 009).
"""
import re
from typing import Iterable, List, Optional

from app.database import supabase
from app.logger import logger

# A close match counts as amber from this similarity up. A starting guess:
# tune it on real prescriptions (work order Job 9).
AMBER_FROM = 0.5

MAX_NAMES = 50
MAX_NAME_LENGTH = 200

# Words for the form of a medicine, not its name. "Tab. Azee 500mg" and
# "Azee 500 Tablet" must clean to the same thing. Variant markers that change
# the product (SR, DSR, CV, LP, Forte, Plus) are deliberately NOT here.
_FORM_WORDS = {
    "tab", "tabs", "tablet", "tablets", "cap", "caps", "capsule", "capsules",
    "syp", "syr", "syrup", "inj", "injection", "susp", "suspension",
    "drop", "drops", "cream", "gel", "oint", "ointment", "lotion", "spray",
    "sachet", "sachets", "powder", "solution", "soln", "oral", "liquid",
    "strip", "kit", "bottle", "vial", "ampoule", "amp",
}
_UNITS = r"(?:mg|mcg|µg|ug|gm|g|ml|iu|kg|%)(?:\s*w/[vw])?"   # '5% w/v' is one strength
_STRENGTH = re.compile(r"(\d+(?:\.\d+)?)\s*" + _UNITS + r"(?![a-z])", re.I)
_LOOSE_DOT = re.compile(r"(?<!\d)\.|\.(?!\d)")   # a dot that is not a decimal point
_PARENS = re.compile(r"\([^)]*\)")
_NOT_WORD = re.compile(r"[^a-z0-9.]+")
_GENERIC_SPLIT = re.compile(r"\s*(?:\+|&|/|,|\band\b|\bwith\b)\s*", re.I)


def clean_name(name: Optional[str]) -> str:
    """'Tab. AZEE-500mg' -> 'azee 500'. Lowercase, no form words, no units."""
    s = (name or "").lower()
    s = _PARENS.sub(" ", s)
    s = _STRENGTH.sub(r" \1 ", s)
    s = _LOOSE_DOT.sub(" ", s)
    s = _NOT_WORD.sub(" ", s)
    words = s.split()
    return " ".join(w for w in words if w and w not in _FORM_WORDS)


def brand_of(clean: str) -> str:
    """The words before the first number: 'pantocid dsr 40' -> 'pantocid dsr',
    'dolo 650' -> 'dolo'. A word like 'd3' or 'b12' is part of the name
    ('vitamin d3'), only a word that starts with a digit ends it. If the name
    starts with a number, the whole name."""
    words = clean.split()
    out = []
    for w in words:
        if w[0].isdigit():
            break
        out.append(w)
    return " ".join(out) or clean


_NUMBER = re.compile(r"[\d.]+")


def generic_clean(name: Optional[str]) -> str:
    """'Vitamin D3 (60000IU)' -> 'vitamin d3'. Like clean_name, without the numbers."""
    return " ".join(w for w in clean_name(name).split() if not _NUMBER.fullmatch(w))


def generic_parts(name: Optional[str]) -> List[str]:
    """'Amoxicillin 500mg + Clavulanic Acid 125mg' -> ['amoxicillin', 'clavulanic acid']."""
    parts = []
    for piece in _GENERIC_SPLIT.split(_PARENS.sub(" ", name or "")):
        g = generic_clean(piece)
        if g:
            parts.append(g)
    return parts


def prepare(name: str) -> dict:
    """What the database function needs for one name."""
    brand = brand_of(clean_name(name))
    return {
        "brand": brand,
        "first": brand.split()[0] if brand else "",
        "generics": generic_parts(name),
    }


def _unchecked(names: Iterable[str]) -> List[dict]:
    return [{"name": n, "status": "unchecked", "matched": None, "generic": None,
             "score": None, "suggestions": []} for n in names]


def check(names: List[str], user_id: Optional[str]) -> List[dict]:
    """A status for each name, in the same order. Never raises."""
    names = list(names)
    if not names:
        return []
    try:
        rows = supabase.rpc("check_medicine_names", {
            "p_items": [prepare(n) for n in names],
            "p_user_id": user_id,
            "p_amber": AMBER_FROM,
        }).execute().data or []
    except Exception as e:
        # Migration 009 not run yet, most likely. Not an error for the person.
        logger.info("Medicine list unavailable, names left unchecked: %s", type(e).__name__)
        return _unchecked(names)

    by_idx = {r.get("idx"): r for r in rows}
    out = []
    for i, name in enumerate(names, start=1):
        r = by_idx.get(i)
        if not r:
            out.extend(_unchecked([name]))
            continue
        out.append({
            "name": name,
            "status": r.get("status") or "unchecked",
            "matched": r.get("matched"),
            "generic": r.get("generic"),
            "score": r.get("score"),
            "suggestions": r.get("suggestions") or [],
        })
    return out


def confirm(user_id: str, name: str) -> bool:
    """Remember a name this person says is right, so it is green next time."""
    brand = brand_of(clean_name(name))
    if not brand:
        return False
    try:
        supabase.table("user_medicines").upsert(
            {"user_id": user_id, "name": name.strip(), "brand_clean": brand},
            on_conflict="user_id,brand_clean",
        ).execute()
        return True
    except Exception as e:
        logger.info("Could not remember a confirmed medicine name: %s", type(e).__name__)
        return False
