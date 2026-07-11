"""
Configurações centrais da aplicação.
Carrega variáveis de ambiente e expõe um objeto `settings` único (padrão Singleton via lru_cache).
"""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Segurança / JWT ---
    SECRET_KEY: str = os.getenv("SECRET_KEY", "troque-esta-chave-em-producao")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 horas

    # --- Banco de Dados ---
    # SQLite para dev; troque por uma URL do Postgres em produção, ex:
    # postgresql://user:senha@localhost:5432/gametracker
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./gametracker.db")

    # --- APIs Externas ---
    RAWG_API_KEY: str = os.getenv("RAWG_API_KEY", "")
    RAWG_BASE_URL: str = "https://api.rawg.io/api"

    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")
    YOUTUBE_BASE_URL: str = "https://www.googleapis.com/youtube/v3"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
