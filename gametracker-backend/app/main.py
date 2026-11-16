"""
Ponto de entrada da aplicação GameTracker Pro.
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.core.config import settings
from app.database import Base, engine, DATABASE_URL_RESOLVIDA
from app import models
from app.routers import auth, discovery, games, social, search

logger = logging.getLogger("gametracker.migrations")

# Log bem visível de qual arquivo de banco está sendo usado nesta execução —
# ajuda a diagnosticar rapidamente se o servidor foi iniciado a partir de uma
# pasta diferente e por isso está enxergando um banco (e portanto uma conta)
# diferente do esperado.
logger.warning("Banco de dados em uso: %s", DATABASE_URL_RESOLVIDA)

# Cria as tabelas no banco caso ainda não existam.
Base.metadata.create_all(bind=engine)


def _run_light_migrations() -> None:
    """
    Migração leve para bancos já existentes de versões anteriores do projeto:
    adiciona colunas/valores novos caso ainda não existam. `Base.metadata.create_all`
    só cria tabelas novas, não adiciona colunas em tabelas já existentes — por
    isso esse passo extra é necessário.

    IMPORTANTE: todo passo aqui é estritamente ADITIVO (nunca remove/renomeia
    coluna, nunca apaga dado) — sempre checa antes se já existe, então rodar
    isso de novo (ou contra um banco que já tem tudo) nunca faz nada.
    """
    inspector = inspect(engine)

    # No Postgres, o SQLAlchemy Enum(GameStatus) vira um TYPE nativo — adicionar
    # um valor novo ("wish_to_play") ao enum exige um ALTER TYPE explícito, algo
    # que o SQLite nem precisa (lá é só texto). Roda só se estiver no Postgres,
    # e só se o valor ainda não existir — sem isso, quem já tem o banco em
    # produção continuaria preso no enum antigo (2 valores) pra sempre.
    if engine.dialect.name == "postgresql":
        try:
            with engine.begin() as conn:
                nome_tipo = models.UserGame.__table__.c.status.type.name
                conn.execute(text(f"ALTER TYPE {nome_tipo} ADD VALUE IF NOT EXISTS 'WISH_TO_PLAY'"))
        except Exception:
            logger.exception(
                "Migração: não consegui adicionar 'wish_to_play' ao enum de status no Postgres "
                "(pode já existir, ou o nome do tipo pode ser outro — confira manualmente se "
                "a categoria \"Próximos Jogos\" não aparecer)."
            )

        # A tabela `follows` já existe em produção (era só "seguir instantâneo",
        # sem aprovação) — precisamos criar o TYPE do enum novo antes de poder
        # usar a coluna `status`. O Postgres não tem "CREATE TYPE IF NOT EXISTS",
        # então só tenta criar e ignora se já existir (idempotente por captura
        # de exceção, igual ao resto das migrações deste arquivo).
        try:
            with engine.begin() as conn:
                conn.execute(text("CREATE TYPE followstatus AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED')"))
        except Exception:
            pass  # já existe — normal a partir da 2ª execução

    with engine.begin() as conn:
        if "follows" in inspector.get_table_names():
            colunas_existentes_follows = {col["name"] for col in inspector.get_columns("follows")}
            if "status" not in colunas_existentes_follows:
                logger.info("Migração: adicionando coluna follows.status")
                tipo_sql = "followstatus" if engine.dialect.name == "postgresql" else "VARCHAR(20)"
                # DEFAULT 'ACCEPTED' pras relações que já existiam: elas foram
                # criadas quando "seguir" ainda era instantâneo (sem aprovação),
                # então já eram, de fato, seguidas de verdade — não faz sentido
                # essas virarem "pendente" retroativamente e sumirem da lista
                # de seguidores de ninguém. Só pedidos NOVOS (a partir de agora)
                # nascem como 'pending' (via código Python, não pelo DEFAULT
                # da coluna). IMPORTANTE: o valor tem que ser MAIÚSCULO
                # ('ACCEPTED', não 'accepted') — o SQLAlchemy grava o NOME do
                # enum Python na coluna (ex: "ACCEPTED"), não o .value ("accepted").
                # Um DEFAULT em minúsculo pareceria funcionar no SQLite (que não
                # valida nada) mas quebraria a leitura desses registros assim que
                # o SQLAlchemy tentasse converter de volta pro enum Python.
                conn.execute(text(f"ALTER TABLE follows ADD COLUMN status {tipo_sql} NOT NULL DEFAULT 'ACCEPTED'"))
            if "responded_at" not in colunas_existentes_follows:
                logger.info("Migração: adicionando coluna follows.responded_at")
                conn.execute(text("ALTER TABLE follows ADD COLUMN responded_at DATETIME"))
            if "is_favorite_friend" not in colunas_existentes_follows:
                logger.info("Migração: adicionando coluna follows.is_favorite_friend")
                conn.execute(text("ALTER TABLE follows ADD COLUMN is_favorite_friend BOOLEAN NOT NULL DEFAULT FALSE"))

        if "users" in inspector.get_table_names():
            colunas_existentes = {col["name"] for col in inspector.get_columns("users")}
            colunas_novas = {
                "display_name": "VARCHAR(120)",
                "avatar_data": "TEXT",
                "is_verified": "BOOLEAN DEFAULT 0",
                "verification_token": "VARCHAR(255)",
                "verification_token_expires_at": "DATETIME",
                "bio": "VARCHAR(30)",
                "country": "VARCHAR(2)",
                "state": "VARCHAR(100)",
                "gender": "VARCHAR(20)",
                "profile_visibility": "VARCHAR(20) DEFAULT 'public'",
                "onboarding_completed": "BOOLEAN DEFAULT 0",
                "friend_code_3ds": "VARCHAR(100)",
                "ea_app_id": "VARCHAR(100)",
                "nintendo_network_id": "VARCHAR(100)",
                "nintendo_switch_id": "VARCHAR(100)",
                "psn_id": "VARCHAR(100)",
                "steam_id": "VARCHAR(100)",
                "twitch": "VARCHAR(100)",
                "ubisoft_connect": "VARCHAR(100)",
                "wii_friend_code": "VARCHAR(100)",
                "xbox_gamertag": "VARCHAR(100)",
                "discord": "VARCHAR(100)",
                "instagram": "VARCHAR(100)",
                "x_handle": "VARCHAR(100)",
                "pending_email": "VARCHAR(255)",
                "email_change_token": "VARCHAR(255)",
                "email_change_token_expires_at": "DATETIME",
                "deletion_token": "VARCHAR(255)",
                "deletion_token_expires_at": "DATETIME",
                "password_reset_token": "VARCHAR(255)",
                "password_reset_token_expires_at": "DATETIME",
            }

            for nome, tipo_sql in colunas_novas.items():
                if nome not in colunas_existentes:
                    logger.info("Migração: adicionando coluna users.%s", nome)
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {nome} {tipo_sql}"))

            # Usuários criados antes da verificação por e-mail existir: marca como
            # verificados para não travar o acesso de quem já usava o sistema.
            if "is_verified" not in colunas_existentes:
                conn.execute(text("UPDATE users SET is_verified = 1 WHERE is_verified IS NULL OR is_verified = 0"))

        if "games" in inspector.get_table_names():
            colunas_existentes_games = {col["name"] for col in inspector.get_columns("games")}
            colunas_novas_games = {
                "platforms": "TEXT",
                "multiplayer_info": "VARCHAR(255)",
                "critic_score": "INTEGER",
                "critic_source": "VARCHAR(20)",
                "critic_checked_at": "TIMESTAMP",
            }
            for nome, tipo_sql in colunas_novas_games.items():
                if nome not in colunas_existentes_games:
                    logger.info("Migração: adicionando coluna games.%s", nome)
                    conn.execute(text(f"ALTER TABLE games ADD COLUMN {nome} {tipo_sql}"))

        if "user_games" in inspector.get_table_names():
            colunas_existentes_ug = {col["name"] for col in inspector.get_columns("user_games")}
            colunas_novas_ug = {
                "play_count": "INTEGER DEFAULT 1",
                "hours_played": "INTEGER",
                "time_to_beat_main": "INTEGER",
                "time_to_beat_completionist": "INTEGER",
                "verdict": "VARCHAR(20)",
            }
            for nome, tipo_sql in colunas_novas_ug.items():
                if nome not in colunas_existentes_ug:
                    logger.info("Migração: adicionando coluna user_games.%s", nome)
                    conn.execute(text(f"ALTER TABLE user_games ADD COLUMN {nome} {tipo_sql}"))
            if "play_count" not in colunas_existentes_ug:
                conn.execute(text("UPDATE user_games SET play_count = 1 WHERE play_count IS NULL"))

        if "play_sessions" in inspector.get_table_names():
            colunas_existentes_ps = {col["name"] for col in inspector.get_columns("play_sessions")}
            if "started_at" not in colunas_existentes_ps:
                logger.info("Migração: adicionando coluna play_sessions.started_at")
                conn.execute(text("ALTER TABLE play_sessions ADD COLUMN started_at DATE"))
                # Registros antigos só tinham played_at — usamos esse valor como started_at.
                conn.execute(text("UPDATE play_sessions SET started_at = played_at WHERE started_at IS NULL"))
            if "finished_at" not in colunas_existentes_ps:
                logger.info("Migração: adicionando coluna play_sessions.finished_at")
                conn.execute(text("ALTER TABLE play_sessions ADD COLUMN finished_at DATE"))
                # Sessões antigas (de antes dessa migração) são tratadas como já
                # concluídas no mesmo dia, pra não aparecerem como "em andamento"
                # indevidamente no histórico — o status real do card não muda.
                conn.execute(text("UPDATE play_sessions SET finished_at = started_at WHERE finished_at IS NULL"))
            if "duration_minutes" not in colunas_existentes_ps:
                logger.info("Migração: adicionando coluna play_sessions.duration_minutes")
                conn.execute(text("ALTER TABLE play_sessions ADD COLUMN duration_minutes INTEGER"))

        if "game_translations" in inspector.get_table_names():
            # Correção de um bug anterior: quando a tradução falhava, o app
            # gravava um registro de cache com descrição vazia (NULL) e passava
            # a devolver "nada" pra sempre pro jogo naquele idioma, mesmo depois
            # do serviço de tradução voltar a funcionar. Aqui a gente limpa
            # esses registros "envenenados" pra forçar uma nova tentativa.
            resultado = conn.execute(text("DELETE FROM game_translations WHERE description IS NULL"))
            if resultado.rowcount:
                logger.info("Migração: removidos %s registros de tradução vazios (bug corrigido).", resultado.rowcount)


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
#
# Por padrão libera qualquer origem (mais simples pra colocar no ar rápido).
# Pra travar só no seu domínio do Vercel em produção, defina no .env:
#   CORS_ALLOWED_ORIGINS=https://seu-projeto.vercel.app,https://seu-dominio.com
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão dos roteadores (cada um incluído exatamente uma vez)
app.include_router(auth.router)
app.include_router(discovery.router)
app.include_router(games.router)
app.include_router(social.router)
app.include_router(search.router)


@app.get("/health", tags=["Status"])
def health_check():
    return {"status": "ok"}
