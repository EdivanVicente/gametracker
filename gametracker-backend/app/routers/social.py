"""
Rotas da aba "Comunidade": perfil público, seguir/deixar de seguir,
feed de atividades e ranking de usuários por quantidade de jogos.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.deps import get_current_user
from app import models, schemas

router = APIRouter(prefix="/social", tags=["Comunidade"])


def _pode_ver_perfil(alvo: models.User, visitante_id: int, segue: bool) -> bool:
    if alvo.id == visitante_id:
        return True
    if alvo.profile_visibility == "private":
        return False
    if alvo.profile_visibility == "friends":
        return segue
    return True  # "public"


@router.get("/profile/{user_id}", response_model=schemas.PublicProfileOut)
def get_public_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Visualização pública (somente leitura) do perfil de qualquer membro."""
    alvo = db.query(models.User).filter(models.User.id == user_id).first()
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    segue = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == current_user.id, models.Follow.followee_id == user_id)
        .first()
        is not None
    )

    if not _pode_ver_perfil(alvo, current_user.id, segue):
        raise HTTPException(status_code=403, detail="Este perfil é privado.")

    followers_count = db.query(models.Follow).filter(models.Follow.followee_id == user_id).count()
    following_count = db.query(models.Follow).filter(models.Follow.follower_id == user_id).count()
    games_count = db.query(models.UserGame).filter(models.UserGame.user_id == user_id).count()

    jogos = (
        db.query(models.UserGame)
        .options(joinedload(models.UserGame.game))
        .filter(models.UserGame.user_id == user_id)
        .order_by(models.UserGame.created_at.desc())
        .all()
    )
    jogando_agora = [j for j in jogos if j.status == models.GameStatus.PLAYING][:6]
    finalizados = [j for j in jogos if j.status == models.GameStatus.FINISHED][:6]

    return schemas.PublicProfileOut(
        id=alvo.id,
        display_name=alvo.display_name,
        avatar_data=alvo.avatar_data,
        bio=alvo.bio,
        country=alvo.country,
        friend_code_3ds=alvo.friend_code_3ds,
        ea_app_id=alvo.ea_app_id,
        nintendo_network_id=alvo.nintendo_network_id,
        nintendo_switch_id=alvo.nintendo_switch_id,
        psn_id=alvo.psn_id,
        steam_id=alvo.steam_id,
        twitch=alvo.twitch,
        ubisoft_connect=alvo.ubisoft_connect,
        wii_friend_code=alvo.wii_friend_code,
        xbox_gamertag=alvo.xbox_gamertag,
        discord=alvo.discord,
        instagram=alvo.instagram,
        x_handle=alvo.x_handle,
        followers_count=followers_count,
        following_count=following_count,
        games_count=games_count,
        is_following=segue,
        is_self=(alvo.id == current_user.id),
        currently_playing=[
            schemas.PublicGameEntryOut(
                title=j.game.title, cover_url=j.game.cover_url, platform=j.platform, status=j.status.value,
            ) for j in jogando_agora
        ],
        recently_finished=[
            schemas.PublicGameEntryOut(
                title=j.game.title, cover_url=j.game.cover_url, platform=j.platform, status=j.status.value,
            ) for j in finalizados
        ],
    )


@router.post("/follow/{user_id}", response_model=schemas.FollowActionOut)
def follow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode seguir a si mesmo.")
    alvo = db.query(models.User).filter(models.User.id == user_id).first()
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    ja_segue = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == current_user.id, models.Follow.followee_id == user_id)
        .first()
    )
    if not ja_segue:
        db.add(models.Follow(follower_id=current_user.id, followee_id=user_id))
        db.commit()

    followers_count = db.query(models.Follow).filter(models.Follow.followee_id == user_id).count()
    return schemas.FollowActionOut(following=True, followers_count=followers_count)


@router.delete("/follow/{user_id}", response_model=schemas.FollowActionOut)
def unfollow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    vinculo = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == current_user.id, models.Follow.followee_id == user_id)
        .first()
    )
    if vinculo:
        db.delete(vinculo)
        db.commit()

    followers_count = db.query(models.Follow).filter(models.Follow.followee_id == user_id).count()
    return schemas.FollowActionOut(following=False, followers_count=followers_count)


def _pode_ver_lista(db: Session, alvo_id: int, visitante_id: int) -> bool:
    """Mesma regra de privacidade do perfil: só pode ver seguidores/seguindo de quem o perfil permite ver."""
    if alvo_id == visitante_id:
        return True
    alvo = db.query(models.User).filter(models.User.id == alvo_id).first()
    if not alvo:
        return False
    if alvo.profile_visibility == "private":
        return False
    if alvo.profile_visibility == "friends":
        segue = (
            db.query(models.Follow)
            .filter(models.Follow.follower_id == visitante_id, models.Follow.followee_id == alvo_id)
            .first()
        )
        return segue is not None
    return True


@router.get("/followers/{user_id}", response_model=list[schemas.UserSearchHitOut])
def get_followers(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Lista quem segue esse usuário (igual à lista de 'seguidores' do Instagram)."""
    if not _pode_ver_lista(db, user_id, current_user.id):
        raise HTTPException(status_code=403, detail="Este perfil é privado.")

    seguidores = (
        db.query(models.User)
        .join(models.Follow, models.Follow.follower_id == models.User.id)
        .filter(models.Follow.followee_id == user_id)
        .all()
    )
    return [
        schemas.UserSearchHitOut(id=u.id, display_name=u.display_name, avatar_data=u.avatar_data)
        for u in seguidores
    ]


@router.get("/following/{user_id}", response_model=list[schemas.UserSearchHitOut])
def get_following(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Lista quem esse usuário está seguindo (igual à lista de 'seguindo' do Instagram)."""
    if not _pode_ver_lista(db, user_id, current_user.id):
        raise HTTPException(status_code=403, detail="Este perfil é privado.")

    seguindo = (
        db.query(models.User)
        .join(models.Follow, models.Follow.followee_id == models.User.id)
        .filter(models.Follow.follower_id == user_id)
        .all()
    )
    return [
        schemas.UserSearchHitOut(id=u.id, display_name=u.display_name, avatar_data=u.avatar_data)
        for u in seguindo
    ]


@router.get("/ranking", response_model=list[schemas.RankingEntryOut])
def get_ranking(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Top 20 usuários com mais jogos catalogados (só perfis públicos ou o próprio usuário)."""
    linhas = (
        db.query(
            models.User.id,
            models.User.display_name,
            models.User.avatar_data,
            func.count(models.UserGame.id).label("games_count"),
        )
        .join(models.UserGame, models.UserGame.user_id == models.User.id)
        .filter(models.User.profile_visibility != "private")
        .group_by(models.User.id)
        .order_by(func.count(models.UserGame.id).desc())
        .limit(20)
        .all()
    )
    return [
        schemas.RankingEntryOut(
            user_id=r.id, display_name=r.display_name, avatar_data=r.avatar_data, games_count=r.games_count,
        )
        for r in linhas
    ]


@router.get("/feed", response_model=list[schemas.FeedItemOut])
def get_feed(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Feed de atividades: jogos iniciados/finalizados recentemente pelas pessoas
    que o usuário segue. Se ele ainda não segue ninguém, mostra a atividade
    pública recente de toda a comunidade (assim a aba não fica vazia).
    """
    seguindo_ids = [
        f.followee_id for f in
        db.query(models.Follow).filter(models.Follow.follower_id == current_user.id).all()
    ]

    consulta = (
        db.query(models.PlaySession, models.UserGame, models.User, models.Game)
        .join(models.UserGame, models.PlaySession.user_game_id == models.UserGame.id)
        .join(models.User, models.UserGame.user_id == models.User.id)
        .join(models.Game, models.UserGame.game_id == models.Game.id)
        .filter(models.User.profile_visibility == "public")
        .filter(models.PlaySession.started_at >= date.today() - timedelta(days=30))
    )
    if seguindo_ids:
        consulta = consulta.filter(models.User.id.in_(seguindo_ids))

    linhas = consulta.order_by(models.PlaySession.started_at.desc()).limit(40).all()

    itens: list[schemas.FeedItemOut] = []
    for sessao, user_game, usuario, jogo in linhas:
        itens.append(schemas.FeedItemOut(
            user_id=usuario.id, display_name=usuario.display_name, avatar_data=usuario.avatar_data,
            game_title=jogo.title, cover_url=jogo.cover_url, action="started", at=sessao.started_at,
        ))
        if sessao.finished_at and sessao.finished_at != sessao.started_at:
            itens.append(schemas.FeedItemOut(
                user_id=usuario.id, display_name=usuario.display_name, avatar_data=usuario.avatar_data,
                game_title=jogo.title, cover_url=jogo.cover_url, action="finished", at=sessao.finished_at,
            ))

    itens.sort(key=lambda i: i.at, reverse=True)
    return itens[:40]
