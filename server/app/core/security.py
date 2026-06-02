from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import get_settings

_settings = get_settings()
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return _pwd.verify(password, hashed)


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or _settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, _settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    try:
        data = jwt.decode(token, _settings.secret_key, algorithms=[ALGORITHM])
        return data.get("sub")
    except JWTError:
        return None
