"""
Configuração da conexão com o banco de dados via SQLAlchemy.
Fornece:
    - engine: conexão com o banco
    - SessionLocal: fábrica de sessões
    - Base: classe base para os modelos ORM
    - get_db: dependency do FastAPI para injeção de sessão nas rotas
"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings


def _resolver_database_url(url: str) -> str:
    """
    Garante que um SQLite relativo (ex: "sqlite:///./gametracker.db") sempre
    aponte pro MESMO arquivo, não importa de qual pasta o servidor é iniciado.

    Sem isso, rodar `uvicorn` a partir de terminais/atalhos diferentes (VS Code,
    um .bat, outra IDE) pode criar um "gametracker.db" novo e vazio em cada
    lugar — o efeito prático é a conta/os dados "sumirem" de vez em quando,
    quando na real é só um arquivo de banco diferente sendo aberto.

    URLs absolutas (ex: Postgres em produção, ou um caminho SQLite absoluto)
    não são alteradas.
    """
    prefixo_relativo = "sqlite:///./"
    if not url.startswith(prefixo_relativo):
        return url

    nome_arquivo = url[len(prefixo_relativo):]
    # Ancora no diretório raiz do backend (duas pastas acima deste arquivo:
    # app/database.py -> app/ -> raiz do projeto), não no cwd do processo.
    raiz_projeto = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    caminho_absoluto = os.path.join(raiz_projeto, nome_arquivo)
    return f"sqlite:///{caminho_absoluto}"


DATABASE_URL_RESOLVIDA = _resolver_database_url(settings.DATABASE_URL)

# connect_args é necessário apenas para SQLite (não usar em Postgres/MySQL)
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL_RESOLVIDA else {}

engine = create_engine(DATABASE_URL_RESOLVIDA, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency: abre uma sessão por requisição e garante o fechamento."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
