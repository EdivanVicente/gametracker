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

    # --- E-mail (confirmação de cadastro) ---
    # Se SMTP_HOST ficar vazio, o link de confirmação é apenas registrado no
    # log do servidor (modo desenvolvimento) em vez de enviado por e-mail.
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "no-reply@gametrackerpro.local")
    SMTP_USE_TLS: bool = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    # URL pública do backend, usada para montar o link de confirmação de e-mail.
    BACKEND_BASE_URL: str = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000")
    # URL do frontend, para onde o usuário é direcionado após confirmar o e-mail.
    FRONTEND_BASE_URL: str = os.getenv("FRONTEND_BASE_URL", "http://127.0.0.1:5500")

    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = 60 * 24  # 24 horas

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
