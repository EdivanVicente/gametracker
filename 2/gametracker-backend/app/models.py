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
