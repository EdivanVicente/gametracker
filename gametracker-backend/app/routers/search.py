"""
Barra de pesquisa global: busca por jogos (com contagem de jogadores) e por
usuários (nome de exibição ou e-mail), com resultados categorizados.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.deps import get_current_user
from app import models, schemas

router = APIRouter(prefix="/search", tags=["Busca global"])


@router.get("/", response_model=schemas.GlobalSearchOut)
def busca_global(
    q: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    termo = (q or "").strip()
    if len(termo) < 2:
        return schemas.GlobalSearchOut(games=[], users=[])

    like = f"%{termo}%"

    # --- Jogos (com contagem de quantos usuários já têm esse jogo) ---
    linhas_jogos = (
        db.query(
            models.Game.external_id,
            models.Game.title,
            models.Game.cover_url,
            func.count(models.UserGame.id).label("players_count"),
        )
        .outerjoin(models.UserGame, models.UserGame.game_id == models.Game.id)
        .filter(models.Game.title.ilike(like))
        .group_by(models.Game.id)
        .order_by(func.count(models.UserGame.id).desc())
        .limit(10)
        .all()
    )
    games = [
        schemas.GameSearchHitOut(
            external_id=g.external_id, title=g.title, cover_url=g.cover_url, players_count=g.players_count,
        )
        for g in linhas_jogos
    ]

    # --- Usuários (nome de exibição OU e-mail — mas o e-mail nunca é exposto na resposta) ---
    linhas_usuarios = (
        db.query(models.User)
        .filter(
            models.User.profile_visibility != "private",
            models.User.id != current_user.id,
            or_(models.User.display_name.ilike(like), models.User.email.ilike(like)),
        )
        .limit(10)
        .all()
    )
    users = [
        schemas.UserSearchHitOut(
            id=u.id, display_name=u.display_name, avatar_data=u.avatar_data,
            email_match=(u.display_name is None or termo.lower() not in (u.display_name or "").lower()),
        )
        for u in linhas_usuarios
    ]

    return schemas.GlobalSearchOut(games=games, users=users)


@router.get("/game/{external_id}/players", response_model=list[schemas.UserSearchHitOut])
def quem_jogou(
    external_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Lista os usuários (perfis não-privados) que têm esse jogo na biblioteca."""
    jogo = db.query(models.Game).filter(models.Game.external_id == external_id).first()
    if not jogo:
        return []

    usuarios = (
        db.query(models.User)
        .join(models.UserGame, models.UserGame.user_id == models.User.id)
        .filter(models.UserGame.game_id == jogo.id, models.User.profile_visibility != "private")
        .distinct()
        .limit(50)
        .all()
    )
    return [
        schemas.UserSearchHitOut(id=u.id, display_name=u.display_name, avatar_data=u.avatar_data)
        for u in usuarios
    ]
