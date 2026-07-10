"""
Rotas de gestão do catálogo pessoal do usuário (UserGame + Rating).

- POST   /catalog/games            -> adiciona um jogo ao catálogo do usuário
- GET    /catalog/games            -> lista com filtros (console, gênero, status, notas, mês/ano)
- GET    /catalog/games/{id}       -> detalhe de um item do catálogo
- PATCH  /catalog/games/{id}       -> atualiza datas, favorito, plataforma e/ou nota
- DELETE /catalog/games/{id}       -> remove do catálogo
- GET    /catalog/summary          -> resumo para o HUD do dashboard
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import extract
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.deps import get_current_user
from app import models, schemas

router = APIRouter(
    prefix="/catalog",
    tags=["Catálogo"],
    dependencies=[Depends(get_current_user)],
)


def _get_or_create_game(db: Session, payload: schemas.UserGameCreate) -> models.Game:
    """Evita duplicar o cache de metadados: reaproveita o Game se o external_id já existir."""
    game = db.query(models.Game).filter(models.Game.external_id == payload.external_id).first()
    if game:
        return game

    game = models.Game(
        external_id=payload.external_id,
        title=payload.title,
        cover_url=payload.cover_url,
        description=payload.description,
        genre=payload.genre,
    )
    db.add(game)
    db.flush()  # garante o game.id sem precisar commitar ainda
    return game


@router.post("/games", response_model=schemas.UserGameOut, status_code=status.HTTP_201_CREATED)
def add_game_to_catalog(
    payload: schemas.UserGameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    game = _get_or_create_game(db, payload)

    existing = (
        db.query(models.UserGame)
        .filter(
            models.UserGame.user_id == current_user.id,
            models.UserGame.game_id == game.id,
            models.UserGame.platform == payload.platform,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este jogo já está no seu catálogo para essa plataforma.",
        )

    user_game = models.UserGame(
        user_id=current_user.id,
        game_id=game.id,
        platform=payload.platform,
        start_date=payload.start_date,
        end_date=payload.end_date,
        is_favorite=payload.is_favorite,
    )
    user_game.refresh_status()
    db.add(user_game)
    db.commit()
    db.refresh(user_game)
    return user_game


@router.get("/games", response_model=list[schemas.UserGameOut])
def list_catalog(
    console: str | None = Query(None, description="Filtra por plataforma/console"),
    genre: str | None = Query(None, description="Filtra por gênero"),
    status_filter: str | None = Query(None, alias="status", description="playing | finished"),
    favorite: bool | None = Query(None, description="Somente favoritos se true"),
    month: int | None = Query(None, ge=1, le=12, description="Mês de conclusão (end_date)"),
    year: int | None = Query(None, description="Ano de conclusão (end_date)"),
    min_graphics: int | None = Query(None, ge=1, le=5),
    min_sound: int | None = Query(None, ge=1, le=5),
    min_gameplay: int | None = Query(None, ge=1, le=5),
    min_difficulty: int | None = Query(None, ge=1, le=5),
    search: str | None = Query(None, description="Busca por título dentro do catálogo"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Requisito crítico da spec: filtros incluem notas por categoria
    (ex: "Jogabilidade = 5" ou "Dificuldade >= 4").
    """
    query = (
        db.query(models.UserGame)
        .options(joinedload(models.UserGame.game), joinedload(models.UserGame.rating))
        .join(models.Game)
        .outerjoin(models.Rating)
        .filter(models.UserGame.user_id == current_user.id)
    )

    if console:
        query = query.filter(models.UserGame.platform.ilike(f"%{console}%"))
    if genre:
        query = query.filter(models.Game.genre.ilike(f"%{genre}%"))
    if status_filter:
        query = query.filter(models.UserGame.status == status_filter)
    if favorite is not None:
        query = query.filter(models.UserGame.is_favorite == favorite)
    if month:
        query = query.filter(extract("month", models.UserGame.end_date) == month)
    if year:
        query = query.filter(extract("year", models.UserGame.end_date) == year)
    if min_graphics:
        query = query.filter(models.Rating.graphics_score >= min_graphics)
    if min_sound:
        query = query.filter(models.Rating.sound_score >= min_sound)
    if min_gameplay:
        query = query.filter(models.Rating.gameplay_score >= min_gameplay)
    if min_difficulty:
        query = query.filter(models.Rating.difficulty_score >= min_difficulty)
    if search:
        query = query.filter(models.Game.title.ilike(f"%{search}%"))

    return query.order_by(models.UserGame.created_at.desc()).all()


@router.get("/summary", response_model=schemas.CatalogSummary)
def get_catalog_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Alimenta o HUD status strip do dashboard."""
    base = db.query(models.UserGame).filter(models.UserGame.user_id == current_user.id)

    total = base.count()
    playing = base.filter(models.UserGame.status == models.GameStatus.PLAYING).count()
    finished = base.filter(models.UserGame.status == models.GameStatus.FINISHED).count()
    favorites = base.filter(models.UserGame.is_favorite == True).count()  # noqa: E712

    return schemas.CatalogSummary(
        total=total, playing=playing, finished=finished, favorites=favorites
    )


def _get_owned_user_game(db: Session, user_game_id: int, user: models.User) -> models.UserGame:
    user_game = (
        db.query(models.UserGame)
        .options(joinedload(models.UserGame.game), joinedload(models.UserGame.rating))
        .filter(models.UserGame.id == user_game_id, models.UserGame.user_id == user.id)
        .first()
    )
    if not user_game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item não encontrado no seu catálogo.",
        )
    return user_game


@router.get("/games/{user_game_id}", response_model=schemas.UserGameOut)
def get_catalog_item(
    user_game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return _get_owned_user_game(db, user_game_id, current_user)


@router.patch("/games/{user_game_id}", response_model=schemas.UserGameOut)
def update_catalog_item(
    user_game_id: int,
    payload: schemas.UserGameUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user_game = _get_owned_user_game(db, user_game_id, current_user)

    if payload.platform is not None:
        user_game.platform = payload.platform
    if payload.start_date is not None:
        user_game.start_date = payload.start_date
    if payload.end_date is not None:
        user_game.end_date = payload.end_date
    if payload.is_favorite is not None:
        user_game.is_favorite = payload.is_favorite

    # end_date pode ter sido explicitamente limpo; refresh_status cobre os dois casos
    user_game.refresh_status()

    if payload.rating is not None:
        if user_game.rating is None:
            user_game.rating = models.Rating(user_game_id=user_game.id)
            db.add(user_game.rating)
        for field, value in payload.rating.model_dump(exclude_unset=True).items():
            setattr(user_game.rating, field, value)

    db.commit()
    db.refresh(user_game)
    return user_game


@router.delete("/games/{user_game_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_catalog_item(
    user_game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    db.delete(user_game)
    db.commit()
    return None
