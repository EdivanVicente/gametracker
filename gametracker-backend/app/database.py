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

    URLs absolutas (ex: Postgres em produção, ou um caminho SQLite absoluto)
    não são alteradas.
    """
    if not url:
        return url

    # Converte o prefixo postgres:// (padrão do Render) para postgresql:// (exigido pelo SQLAlchemy 2.0)
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

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

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    # Por padrão, o SQLAlchemy "expira" (invalida) TODOS os objetos ainda
    # presos na sessão depois de qualquer commit() — o próximo acesso a
    # qualquer atributo/relacionamento deles dispara uma consulta nova ao
    # banco pra recarregar, mesmo que esse objeto não tenha nada a ver com o
    # que acabou de ser commitado. Isso causava um bug real: ao traduzir a
    # descrição de vários jogos na tela "Meus Jogos", cada tradução salva no
    # cache fazia um commit() — e esse commit invalidava o UserGame de jogos
    # JÁ traduzidos antes, fazendo o relacionamento ".game" ser recarregado
    # do banco na hora de montar a resposta, jogando fora a tradução que já
    # tínhamos calculado em memória (o usuário via a descrição em inglês de
    # novo, mesmo a tradução tendo funcionado).
    # Com expire_on_commit=False, um objeto só fica desatualizado se alguém
    # pedir explicitamente (db.refresh(obj)) — o que o projeto já faz em
    # todo lugar que realmente precisa dos dados mais recentes depois de
    # salvar (ex: pegar o ID gerado pelo banco), então essa mudança não tira
    # nenhuma garantia que o código já dependia — só evita recargas
    # implícitas e surpreendentes no meio do caminho.
    expire_on_commit=False,
)

Base = declarative_base()


def get_db():
    """Dependency: abre uma sessão por requisição e garante o fechamento."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
