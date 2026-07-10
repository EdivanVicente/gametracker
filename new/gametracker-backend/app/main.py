"""
Ponto de entrada da aplicação GameTracker Pro.

Rodar localmente com:
    uvicorn app.main:app --reload

Docs interativas automáticas em:
    http://localhost:8000/docs
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import auth, discovery, catalog

# Cria as tabelas no banco caso ainda não existam.
# Em produção, prefira usar Alembic para migrations versionadas.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GameTracker Pro API",
    description="API para catalogação, avaliação e acompanhamento de jogos.",
    version="0.1.0",
)

# CORS liberado para o frontend Vanilla JS/Bootstrap consumir a API.
# Restrinja allow_origins para o domínio real em produção.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(discovery.router)
app.include_router(catalog.router)


@app.get("/health", tags=["Status"])
def health_check():
    return {"status": "ok"}
