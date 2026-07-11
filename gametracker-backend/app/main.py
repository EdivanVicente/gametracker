"""
Ponto de entrada da aplicação GameTracker Pro.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.database import Base, engine
from app.routers import auth, discovery, games

logger = logging.getLogger("gametracker.migrations")

# Cria as tabelas no banco caso ainda não existam.
Base.metadata.create_all(bind=engine)


def _run_light_migrations() -> None:
    """
    Migração leve para bancos SQLite já existentes de versões anteriores do projeto:
    adiciona colunas novas na tabela `users` (perfil + verificação de e-mail) caso
    ainda não existam. `Base.metadata.create_all` só cria tabelas novas, não adiciona
    colunas em tabelas já existentes — por isso esse passo extra é necessário.
    """
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    colunas_existentes = {col["name"] for col in inspector.get_columns("users")}
    colunas_novas = {
        "display_name": "VARCHAR(120)",
        "avatar_data": "TEXT",
        "is_verified": "BOOLEAN DEFAULT 0",
        "verification_token": "VARCHAR(255)",
        "verification_token_expires_at": "DATETIME",
    }

    with engine.begin() as conn:
        for nome, tipo_sql in colunas_novas.items():
            if nome not in colunas_existentes:
                logger.info("Migração: adicionando coluna users.%s", nome)
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {nome} {tipo_sql}"))

        # Usuários criados antes da verificação por e-mail existir: marca como
        # verificados para não travar o acesso de quem já usava o sistema.
        if "is_verified" not in colunas_existentes:
            conn.execute(text("UPDATE users SET is_verified = 1 WHERE is_verified IS NULL OR is_verified = 0"))


_run_light_migrations()

app = FastAPI(
    title="GameTracker Pro API",
    description="API para catalogação, avaliação e acompanhamento de jogos.",
    version="0.1.0",
)

# CORS liberado para o frontend Vanilla JS/Bootstrap consumir a API.
# allow_credentials=False porque a autenticação usa Bearer token (Authorization header),
# não cookies — combinar allow_origins=["*"] com allow_credentials=True é inválido
# e é bloqueado pelos navegadores modernos.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão dos roteadores (cada um incluído exatamente uma vez)
app.include_router(auth.router)
app.include_router(discovery.router)
app.include_router(games.router)


@app.get("/health", tags=["Status"])
def health_check():
    return {"status": "ok"}
RAWG_API_KEY = "dummy_key_for_testing"