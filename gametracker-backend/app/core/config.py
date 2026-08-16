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

    # --- Provedor reserva (fallback), usado automaticamente quando a RAWG falha ---
    # Gere gratuitamente em https://dev.twitch.tv/console/apps
    IGDB_CLIENT_ID: str = os.getenv("IGDB_CLIENT_ID", "")
    IGDB_CLIENT_SECRET: str = os.getenv("IGDB_CLIENT_SECRET", "")

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

    def frontend_url(self, path: str) -> str:
        """
        Monta uma URL absoluta para o frontend, sem risco de barra dupla
        (bug clássico quando FRONTEND_BASE_URL termina com "/" no .env).
        Ex: settings.frontend_url("reset-password.html?token=abc")
        """
        base = self.FRONTEND_BASE_URL.rstrip("/")
        return f"{base}/{path.lstrip('/')}"

    def backend_url(self, path: str) -> str:
        """Mesma ideia de frontend_url(), mas para links que apontam pro próprio backend."""
        base = self.BACKEND_BASE_URL.rstrip("/")
        return f"{base}/{path.lstrip('/')}"

    # --- CORS ---
    # Lista separada por vírgula das origens autorizadas a chamar a API.
    # Deixe em branco (padrão) para liberar qualquer origem — mais simples
    # pra colocar no ar rápido. Em produção, defina no .env algo como:
    #   CORS_ALLOWED_ORIGINS=https://seu-projeto.vercel.app,https://seudominio.com
    CORS_ALLOWED_ORIGINS_RAW: str = os.getenv("CORS_ALLOWED_ORIGINS", "")

    @property
    def CORS_ALLOWED_ORIGINS(self) -> list[str]:
        if not self.CORS_ALLOWED_ORIGINS_RAW.strip():
            return ["*"]
        return [origem.strip() for origem in self.CORS_ALLOWED_ORIGINS_RAW.split(",") if origem.strip()]

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
