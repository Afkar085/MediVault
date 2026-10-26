from datetime import datetime, timedelta
import secrets

import bcrypt
from jose import JWTError, jwt
from app.config import settings

# bcrypt has a hard 72-byte limit on the password input; anything longer is
# silently ignored by the algorithm, so we truncate explicitly to stay
# deterministic. (Using bcrypt directly avoids the passlib 1.7.4 + bcrypt 4.x
# `__about__` incompatibility.)
_BCRYPT_MAX_BYTES = 72


def _to_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bytes(password), bcrypt.gensalt()).decode("utf-8")


# Checked against when the email is unknown, so that path takes as long as a
# real one. Its password is random and discarded: nothing can match it.
DUMMY_HASH = bcrypt.hashpw(secrets.token_bytes(16), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bytes(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False

def create_access_token(user_id: str, hours: int | None = None) -> str:
    expire = datetime.utcnow() + timedelta(hours=hours or settings.JWT_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

def decode_access_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        return payload.get("sub")
    except JWTError:
        return None