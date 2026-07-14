"""
Schemas Pydantic — contratos de entrada e saída da API.
"""

import re
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

# Regex exigida pela especificação:
# mínimo 8 caracteres, 1 minúscula, 1 maiúscula, 1 número, 1 caractere especial (@$!%*?&)
PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$")

GENDER_OPTIONS = {"male", "female", "other", "private"}
VISIBILITY_OPTIONS = {"public", "friends", "private"}


def _validar_senha_forte(value: str) -> str:
    if not PASSWORD_REGEX.match(value):
        raise ValueError(
            "A senha deve ter no mínimo 8 caracteres, incluindo 1 letra maiúscula, "
            "1 minúscula, 1 número e 1 caractere especial (@$!%*?&)."
        )
    return value


class UserCreate(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, value: str) -> str:
        return _validar_senha_forte(value)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    display_name: str | None = None
    avatar_data: str | None = None
    bio: str | None = None
    country: str | None = None
    state: str | None = None
    gender: str | None = None
    profile_visibility: str = "public"

    friend_code_3ds: str | None = None
    ea_app_id: str | None = None
    nintendo_network_id: str | None = None
    nintendo_switch_id: str | None = None
    psn_id: str | None = None
    steam_id: str | None = None
    twitch: str | None = None
    ubisoft_connect: str | None = None
    wii_friend_code: str | None = None
    xbox_gamertag: str | None = None
    discord: str | None = None
    instagram: str | None = None
    x_handle: str | None = None

    is_verified: bool
    created_at: datetime
    pending_email: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    """Payload para editar o perfil. Todos os campos são opcionais (PATCH)."""
    display_name: str | None = Field(default=None, max_length=120)
    avatar_data: str | None = None  # data URI base64 (ex: "data:image/png;base64,...")
    bio: str | None = Field(default=None, max_length=30)
    country: str | None = Field(default=None, max_length=2)
    state: str | None = Field(default=None, max_length=100)
    gender: str | None = None
    profile_visibility: str | None = None

    friend_code_3ds: str | None = Field(default=None, max_length=100)
    ea_app_id: str | None = Field(default=None, max_length=100)
    nintendo_network_id: str | None = Field(default=None, max_length=100)
    nintendo_switch_id: str | None = Field(default=None, max_length=100)
    psn_id: str | None = Field(default=None, max_length=100)
    steam_id: str | None = Field(default=None, max_length=100)
    twitch: str | None = Field(default=None, max_length=100)
    ubisoft_connect: str | None = Field(default=None, max_length=100)
    wii_friend_code: str | None = Field(default=None, max_length=100)
    xbox_gamertag: str | None = Field(default=None, max_length=100)
    discord: str | None = Field(default=None, max_length=100)
    instagram: str | None = Field(default=None, max_length=100)
    x_handle: str | None = Field(default=None, max_length=100)

    @field_validator("gender")
    @classmethod
    def validar_gender(cls, value):
        if value is not None and value not in GENDER_OPTIONS:
            raise ValueError(f"gender deve ser um de: {', '.join(sorted(GENDER_OPTIONS))}")
        return value

    @field_validator("profile_visibility")
    @classmethod
    def validar_visibilidade(cls, value):
        if value is not None and value not in VISIBILITY_OPTIONS:
            raise ValueError(f"profile_visibility deve ser um de: {', '.join(sorted(VISIBILITY_OPTIONS))}")
        return value


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


# --- Conta: troca de e-mail, senha e exclusão ---

class ChangeEmailRequest(BaseModel):
    new_email: EmailStr
    current_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, value: str) -> str:
        return _validar_senha_forte(value)


class DeleteAccountRequest(BaseModel):
    current_password: str


# --- Catálogo externo (RAWG) ---

class GameOut(BaseModel):
    """Metadados de um jogo, já em cache local (tabela `games`)."""
    id: int
    external_id: str
    title: str
    cover_url: str | None = None
    description: str | None = None
    genre: str | None = None
    platforms: str | None = None
    multiplayer_info: str | None = None

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
