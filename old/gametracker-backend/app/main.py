"""
Ponto de entrada da aplicação GameTracker Pro.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth, discovery, games

# Cria as tabelas no banco caso ainda não existam.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="GameTracker Pro API",
    description="API para catalogação, avaliação e acompanhamento de jogos.",
    version="0.1.0",
)

# CORS liberado para o frontend Vanilla JS/Bootstrap consumir a API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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