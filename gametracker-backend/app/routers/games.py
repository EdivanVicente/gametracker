"""
Rotas da "Minha Biblioteca" (CRUD do catálogo pessoal do usuário).

- GET    /games/            -> lista os jogos do usuário logado (com capa, notas, etc.)
- POST   /games/            -> adiciona um jogo (encontrado via /games/search) à biblioteca
- PATCH  /games/{id}        -> atualiza tracking (datas/plataforma/favorito) e avaliação
- DELETE /games/{id}        -> remove um jogo da biblioteca

Todas as rotas exigem usuário autenticado e operam apenas sobre registros
pertencentes ao usuário logado (isolamento por user_id).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.deps import get_current_user
from app import models, schemas
from app.services.games_api import games_api_service

router = APIRouter(prefix="/games", tags=["Minha Biblioteca"])


async def _get_or_create_game(db: Session, external_id: str) -> tuple[models.Game, str | None]:
    """
    Retorna o jogo do cache local (tabela `games`); se não existir, busca na RAWG e salva.
    Também devolve a primeira plataforma sugerida pela RAWG (usada como valor padrão).
    """
    game = db.query(models.Game).filter(models.Game.external_id == external_id).first()
    if game:
        return game, None

    try:
        details = await games_api_service.get_game_details(external_id=external_id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Jogo não encontrado na API externa.")

    game = models.Game(
        external_id=details["external_id"],
        title=details["title"],
        cover_url=details["cover_url"],
        description=details["description"],
        genre=details["genre"],
        platforms=", ".join(details.get("platforms") or []) or None,
        multiplayer_info=details.get("multiplayer_info"),
    )
    db.add(game)
    db.commit()
    db.refresh(game)

    plataformas = details.get("platforms") or []
    plataforma_sugerida = plataformas[0] if plataformas else None
    return game, plataforma_sugerida


def _get_owned_user_game(db: Session, user_game_id: int, current_user: models.User) -> models.UserGame:
    """Busca um UserGame garantindo que pertence ao usuário logado (evita acesso cruzado entre contas)."""
    user_game = (
        db.query(models.UserGame)
        .options(joinedload(models.UserGame.game), joinedload(models.UserGame.rating))
        .filter(
            models.UserGame.id == user_game_id,
            models.UserGame.user_id == current_user.id,
        )
        .first()
    )
    if not user_game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Jogo não encontrado na sua biblioteca.",
        )
    return user_game


@router.get("/", response_model=list[schemas.UserGameOut])
def get_my_games(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Busca apenas os jogos do usuário logado, já com capa, gênero e avaliação carregados."""
    return (
        db.query(models.UserGame)
        .options(joinedload(models.UserGame.game), joinedload(models.UserGame.rating))
        .filter(models.UserGame.user_id == current_user.id)
        .order_by(models.UserGame.created_at.desc())
        .all()
    )


@router.post("/", response_model=schemas.UserGameOut, status_code=status.HTTP_201_CREATED)
async def add_game(
    payload: schemas.UserGameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Adiciona um jogo (encontrado via /games/search) à biblioteca do usuário logado."""
    game, plataforma_sugerida = await _get_or_create_game(db, payload.external_id)
    plataforma_final = payload.platform or plataforma_sugerida

    user_game = models.UserGame(
        user_id=current_user.id,
        game_id=game.id,
        platform=plataforma_final,
    )
    db.add(user_game)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este jogo já está na sua biblioteca nessa plataforma.",
        )

    db.refresh(user_game)
    # Recarrega com os relacionamentos para a resposta serializar corretamente (com a capa)
    return _get_owned_user_game(db, user_game.id, current_user)


@router.patch("/{user_game_id}", response_model=schemas.UserGameOut)
def update_game(
    user_game_id: int,
    payload: schemas.UserGameUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Atualiza plataforma, datas de progresso, favorito e/ou avaliação por categoria."""
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    data = payload.model_dump(exclude_unset=True)

    if "platform" in data:
        user_game.platform = data["platform"]
    if "start_date" in data:
        user_game.start_date = data["start_date"]
    if "end_date" in data:
        user_game.end_date = data["end_date"]
    if "is_favorite" in data:
        user_game.is_favorite = data["is_favorite"]

    # O status (em andamento / finalizado) é sempre derivado das datas.
    user_game.refresh_status()

    rating_fields = {"graphics_score", "sound_score", "gameplay_score", "difficulty_score"}
    if rating_fields & data.keys():
        if user_game.rating is None:
            user_game.rating = models.Rating(user_game_id=user_game.id)
            db.add(user_game.rating)
        for field in rating_fields:
            if field in data:
                setattr(user_game.rating, field, data[field])

    db.commit()
    return _get_owned_user_game(db, user_game_id, current_user)


@router.delete("/{user_game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_game(
    user_game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Remove um jogo da biblioteca do usuário logado."""
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    db.delete(user_game)
    db.commit()
    return None
