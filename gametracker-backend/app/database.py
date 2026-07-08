"""
Configuração da conexão com o banco de dados via SQLAlchemy.
Fornece:
    - engine: conexão com o banco
    - SessionLocal: fábrica de sessões
    - Base: classe base para os modelos ORM
    - get_db: dependency do FastAPI para injeção de sessão nas rotas
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

# connect_args é necessário apenas para SQLite (não usar em Postgres/MySQL)
connect_args = {"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency: abre uma sessão por requisição e garante o fechamento."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
