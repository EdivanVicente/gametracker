# app/routers/games.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.database import get_db
from app.core.deps import get_current_user
from app import models
from app.services.games_api import games_api_service

router = APIRouter(prefix="/games", tags=["Minha Biblioteca"])

class GameAddRequest(BaseModel):
    game_id: str

@router.post("/")
async def add_game(
    game_in: GameAddRequest, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # 1. Verifica se o jogo já existe no cache do nosso banco
    game = db.query(models.Game).filter(models.Game.external_id == game_in.game_id).first()
    
    # Se não existe, busca da RAWG e salva
    if not game:
        try:
            game_data = await games_api_service.get_game_details(game_in.game_id)
        except Exception as e:
            raise HTTPException(status_code=404, detail="Jogo não encontrado na API externa.")
        
        game = models.Game(
            external_id=game_data["external_id"],
            title=game_data["title"],
            cover_url=game_data["cover_url"],
            description=game_data["description"],
            genre=game_data["genre"]
        )
        db.add(game)
        db.commit()
        db.refresh(game)
    
    # 2. Verifica se o usuário já tem esse jogo na biblioteca
    existing_user_game = db.query(models.UserGame).filter(
        models.UserGame.user_id == current_user.id,
        models.UserGame.game_id == game.id
    ).first()

    if existing_user_game:
        raise HTTPException(status_code=400, detail="Este jogo já está na sua biblioteca.")
    
    # 3. Adiciona na biblioteca do usuário
    default_platform = "PC"
    if hasattr(game, "platforms") and game.platforms:
        default_platform = game.platforms[0] if isinstance(game.platforms, list) else "PC"

    new_user_game = models.UserGame(
        user_id=current_user.id,
        game_id=game.id,
        platform=default_platform
    )
    db.add(new_user_game)
    db.commit()
    
    return {"message": "Jogo adicionado com sucesso!"}

@router.get("/")
def get_my_games(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Traz as relações com joinedload para evitar N+1 queries no banco
    user_games = db.query(models.UserGame).options(
        joinedload(models.UserGame.game),
        joinedload(models.UserGame.rating)
    ).filter(models.UserGame.user_id == current_user.id).all()
    
    # Formata o output achatado (flat) exatamente como o dashboard.js espera
    result = []
    for ug in user_games:
        game = ug.game
        rating = ug.rating
        
        result.append({
            "id": ug.id,
            "status": ug.status.value if ug.status else "playing",
            "is_favorite": ug.is_favorite,
            "title": game.title if game else "Desconhecido",
            "platform": ug.platform or "Desconhecido",
            "genre": game.genre if game else "Gênero não informado",
            "score_graphics": rating.graphics_score if rating else "-",
            "score_sound": rating.sound_score if rating else "-",
            "score_gameplay": rating.gameplay_score if rating else "-",
            "score_difficulty": rating.difficulty_score if rating else "-"
        })
        
    return result