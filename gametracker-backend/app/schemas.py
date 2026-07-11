"""
Schemas Pydantic — contratos de entrada e saída da API.
"""

import re
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

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
    display_name: str | None = None
    avatar_data: str | None = None
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    """Payload para editar o perfil (nome de exibição e/ou foto)."""
    display_name: str | None = Field(default=None, max_length=120)
    avatar_data: str | None = None  # data URI base64 (ex: "data:image/png;base64,...")


class RegisterResponse(BaseModel):
    """Retorno do cadastro: não faz login automático, pois é preciso confirmar o e-mail antes."""
    message: str
    email: EmailStr


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int | None = None


# --- Catálogo externo (RAWG) ---

class GameOut(BaseModel):
    """Metadados de um jogo, já em cache local (tabela `games`)."""
    id: int
    external_id: str
    title: str
    cover_url: str | None = None
    description: str | None = None
    genre: str | None = None

    model_config = ConfigDict(from_attributes=True)


# --- Avaliação (Rating) ---

class RatingOut(BaseModel):
    graphics_score: int | None = None
    sound_score: int | None = None
    gameplay_score: int | None = None
    difficulty_score: int | None = None

    model_config = ConfigDict(from_attributes=True)


# --- Minha Biblioteca (UserGame) ---

class UserGameCreate(BaseModel):
    """Payload para adicionar um jogo (já pesquisado via /games/search) à biblioteca."""
    external_id: str
    platform: str | None = None


class UserGameUpdate(BaseModel):
    """Payload para atualizar tracking/avaliação. Todos os campos são opcionais (PATCH)."""
    platform: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_favorite: bool | None = None
    graphics_score: int | None = Field(default=None, ge=1, le=5)
    sound_score: int | None = Field(default=None, ge=1, le=5)
    gameplay_score: int | None = Field(default=None, ge=1, le=5)
    difficulty_score: int | None = Field(default=None, ge=1, le=5)


class UserGameOut(BaseModel):
    id: int
    platform: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str
    is_favorite: bool
    created_at: datetime
    game: GameOut
    rating: RatingOut | None = None

    model_config = ConfigDict(from_attributes=True)
