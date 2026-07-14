"""
Modelos ORM (SQLAlchemy) do GameTracker Pro.

Entidades:
    - User: usuários da aplicação
    - Game: cache local dos metadados vindos da API externa (RAWG/IGDB)
    - UserGame: relação N:N entre User e Game, com dados de tracking
    - Rating: notas por categoria, atrelada 1:1 a um UserGame
"""

import enum
from datetime import datetime, date

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Enum,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class GameStatus(str, enum.Enum):
    PLAYING = "playing"
    FINISHED = "finished"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # --- Perfil básico ---
    display_name = Column(String(120), nullable=True)
    avatar_data = Column(Text, nullable=True)  # data URI (base64) da foto de perfil
    bio = Column(String(30), nullable=True)  # frase de status, até 30 caracteres
    country = Column(String(2), nullable=True)  # código ISO 3166-1 alpha-2 (ex: "BR")
    state = Column(String(100), nullable=True)
    gender = Column(String(20), nullable=True)  # "male" | "female" | "other" | "private"
    profile_visibility = Column(String(20), default="public", nullable=False)  # public | friends | private

    # --- Redes sociais / friend codes ---
    friend_code_3ds = Column(String(100), nullable=True)
    ea_app_id = Column(String(100), nullable=True)
    nintendo_network_id = Column(String(100), nullable=True)
    nintendo_switch_id = Column(String(100), nullable=True)
    psn_id = Column(String(100), nullable=True)
    steam_id = Column(String(100), nullable=True)
    twitch = Column(String(100), nullable=True)
    ubisoft_connect = Column(String(100), nullable=True)
    wii_friend_code = Column(String(100), nullable=True)
    xbox_gamertag = Column(String(100), nullable=True)
    discord = Column(String(100), nullable=True)
    instagram = Column(String(100), nullable=True)
    x_handle = Column(String(100), nullable=True)

    # --- Verificação de e-mail ---
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255), nullable=True, index=True)
    verification_token_expires_at = Column(DateTime, nullable=True)

    # --- Troca de e-mail pendente ---
    pending_email = Column(String(255), nullable=True)
    email_change_token = Column(String(255), nullable=True, index=True)
    email_change_token_expires_at = Column(DateTime, nullable=True)

    # --- Exclusão de conta (exige confirmação por e-mail) ---
    deletion_token = Column(String(255), nullable=True, index=True)
    deletion_token_expires_at = Column(DateTime, nullable=True)

    # Relacionamento: um usuário tem muitos jogos catalogados
    games = relationship("UserGame", back_populates="user", cascade="all, delete-orphan")


class Game(Base):
    """Cache local dos metadados vindos da API externa (RAWG/IGDB)."""

    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    cover_url = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    genre = Column(String(255), nullable=True)
    platforms = Column(Text, nullable=True)  # nomes separados por vírgula (ex: "PC, PlayStation 5")
    multiplayer_info = Column(String(255), nullable=True)  # ex: "Single-player, Multiplayer"

    user_entries = relationship("UserGame", back_populates="game")


class UserGame(Base):
    """Relação entre um usuário e um jogo, com os dados de acompanhamento (tracking)."""

    __tablename__ = "user_games"
    __table_args__ = (
        UniqueConstraint("user_id", "game_id", "platform", name="uq_user_game_platform"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)

    platform = Column(String(100), nullable=True)  # ex: "PC", "PS5", "Switch"
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(Enum(GameStatus), default=GameStatus.PLAYING, nullable=False)
    is_favorite = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="games")
    game = relationship("Game", back_populates="user_entries")
    rating = relationship(
        "Rating", back_populates="user_game", uselist=False, cascade="all, delete-orphan"
    )

    def refresh_status(self):
        """Atualiza o status automaticamente com base nas datas preenchidas."""
        self.status = GameStatus.FINISHED if self.end_date else GameStatus.PLAYING


class Rating(Base):
    """Notas de 1 a 5 por categoria, atreladas a um único UserGame."""

    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    user_game_id = Column(Integer, ForeignKey("user_games.id"), unique=True, nullable=False)

    graphics_score = Column(Integer, nullable=True)   # 1-5
    sound_score = Column(Integer, nullable=True)      # 1-5
    gameplay_score = Column(Integer, nullable=True)   # 1-5
    difficulty_score = Column(Integer, nullable=True)  # 1-5

    user_game = relationship("UserGame", back_populates="rating")
