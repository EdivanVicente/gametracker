"""
Funções auxiliares de segurança:
    - Hash e verificação de senha (bcrypt via passlib)
    - Criação e decodificação de JWT
"""

from datetime import datetime, timedelta, timezone
import secrets

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


import bcrypt

def hash_password(password: str) -> str:
    senha_bytes = password.encode("utf-8")[:72]  # bcrypt só aceita até 72 bytes
    hash_bytes = bcrypt.hashpw(senha_bytes, bcrypt.gensalt())
    return hash_bytes.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    senha_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.checkpw(senha_bytes, hashed_password.encode("utf-8"))


def generate_verification_token() -> str:
    """Token opaco e aleatório (não é um JWT) usado no link de confirmação de e-mail."""
    return secrets.token_urlsafe(32)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
