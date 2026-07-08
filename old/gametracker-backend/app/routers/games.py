# app/routers/games.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.deps import get_current_user
from app import models

router = APIRouter(prefix="/games", tags=["Minha Biblioteca"])

@router.get("/")
def get_my_games(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Busca apenas os jogos do usuário logado
    games = db.query(models.UserGame).filter(models.UserGame.user_id == current_user.id).all()
    return games