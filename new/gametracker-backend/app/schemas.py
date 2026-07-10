"""
Schemas Pydantic — contratos de entrada e saída da API.
"""

import re
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, field_validator, ConfigDict

# Regex exigida pela especificação:
# mínimo 8 caracteres, 1 minúscula, 1 maiúscula, 1 número, 1 caractere especial (@$!%*?&)
PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$")


class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        if not PASSWORD_REGEX.match(value):
            raise ValueError(
                "A senha deve ter no mínimo 8 caracteres, incluindo 1 letra maiúscula, "
                "1 minúscula, 1 número e 1 caractere especial (@$!%*?&)."
            )
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int | None = None


# ---------------------------------------------------------------------------
# Catálogo (UserGame + Rating)
# ---------------------------------------------------------------------------

class RatingIn(BaseModel):
    graphics_score: int | None = None
    sound_score: int | None = None
    gameplay_score: int | None = None
    difficulty_score: int | None = None

    @field_validator(
        "graphics_score", "sound_score", "gameplay_score", "difficulty_score"
    )
    @classmethod
    def validate_score_range(cls, value: int | None) -> int | None:
        if value is not None and not (1 <= value <= 5):
            raise ValueError("A nota deve estar entre 1 e 5.")
        return value


class RatingOut(RatingIn):
    model_config = ConfigDict(from_attributes=True)


class GameOut(BaseModel):
    id: int
    external_id: str
    title: str
    cover_url: str | None = None
    description: str | None = None
    genre: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserGameCreate(BaseModel):
    """Payload enviado quando o usuário seleciona um jogo no modal de busca."""
    external_id: str
    title: str
    cover_url: str | None = None
    description: str | None = None
    genre: str | None = None
    platform: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_favorite: bool = False


class UserGameUpdate(BaseModel):
    """Payload para PATCH — todos os campos opcionais (atualização parcial)."""
    platform: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_favorite: bool | None = None
    rating: RatingIn | None = None


class UserGameOut(BaseModel):
    id: int
    platform: str | None
    start_date: date | None
    end_date: date | None
    status: str
    is_favorite: bool
    game: GameOut
    rating: RatingOut | None = None

    model_config = ConfigDict(from_attributes=True)


class CatalogSummary(BaseModel):
    total: int
    playing: int
    finished: int
    favorites: int

