"""
Rotas da aba "Comunidade": perfil público, seguir/deixar de seguir (com
aprovação prévia de quem é seguido), pedidos de amizade, notificações,
feed de atividades e ranking de usuários por quantidade de jogos.
"""

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.deps import get_current_user
from app import models, schemas

router = APIRouter(prefix="/social", tags=["Comunidade"])


def _status_do_vinculo(db: Session, follower_id: int, followee_id: int) -> str:
    """Devolve 'none' | 'pending' | 'accepted' (uma relação REJECTED também conta como 'none' — dá pra pedir de novo)."""
    vinculo = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == follower_id, models.Follow.followee_id == followee_id)
        .first()
    )
    if not vinculo or vinculo.status == models.FollowStatus.REJECTED:
        return "none"
    return vinculo.status.value


def _pode_ver_perfil(alvo: models.User, visitante_id: int, segue_aceito: bool) -> bool:
    if alvo.id == visitante_id:
        return True
    if alvo.profile_visibility == "private":
        return False
    if alvo.profile_visibility == "friends":
        return segue_aceito
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

    follow_status = _status_do_vinculo(db, current_user.id, user_id)
    segue_aceito = follow_status == "accepted"

    if not _pode_ver_perfil(alvo, current_user.id, segue_aceito):
        raise HTTPException(status_code=403, detail="Este perfil é privado.")

    vinculo_atual = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == current_user.id, models.Follow.followee_id == user_id)
        .first()
    )
    is_favorite_friend = bool(vinculo_atual and vinculo_atual.is_favorite_friend)

    followers_count = (
        db.query(models.Follow)
        .filter(models.Follow.followee_id == user_id, models.Follow.status == models.FollowStatus.ACCEPTED)
        .count()
    )
    following_count = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == user_id, models.Follow.status == models.FollowStatus.ACCEPTED)
        .count()
    )
    games_count = db.query(models.UserGame).filter(models.UserGame.user_id == user_id).count()

    jogos = (
        db.query(models.UserGame)
        .options(joinedload(models.UserGame.game))
        .filter(models.UserGame.user_id == user_id)
        .order_by(models.UserGame.created_at.desc())
        .all()
    )

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
        is_following=segue_aceito,
        follow_status=follow_status,
        is_favorite_friend=is_favorite_friend,
        is_self=(alvo.id == current_user.id),
        games=[
            schemas.PublicGameEntryOut(
                id=j.id, external_id=j.game.external_id,
                title=j.game.title, cover_url=j.game.cover_url, genre=j.game.genre,
                platform=j.platform, status=j.status.value,
            ) for j in jogos
        ],
    )


@router.get("/profile/{user_id}/games/{user_game_id}", response_model=schemas.PublicGameDetailOut)
def get_friend_game_detail(
    user_id: int,
    user_game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Detalhe de UM jogo específico da biblioteca de outra pessoa (item 4.2):
    notas por categoria, quantas vezes jogou, tempo de cada jogada e tempo
    total. Respeita a mesma regra de privacidade do perfil.
    """
    alvo = db.query(models.User).filter(models.User.id == user_id).first()
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    follow_status = _status_do_vinculo(db, current_user.id, user_id)
    if not _pode_ver_perfil(alvo, current_user.id, follow_status == "accepted"):
        raise HTTPException(status_code=403, detail="Este perfil é privado.")

    entrada = (
        db.query(models.UserGame)
        .options(joinedload(models.UserGame.game), joinedload(models.UserGame.rating), joinedload(models.UserGame.sessions))
        .filter(models.UserGame.id == user_game_id, models.UserGame.user_id == user_id)
        .first()
    )
    if not entrada:
        raise HTTPException(status_code=404, detail="Jogo não encontrado na biblioteca dessa pessoa.")

    rating = entrada.rating
    return schemas.PublicGameDetailOut(
        external_id=entrada.game.external_id,
        title=entrada.game.title,
        cover_url=entrada.game.cover_url,
        genre=entrada.game.genre,
        platform=entrada.platform,
        status=entrada.status.value,
        hours_played=(entrada.hours_played / 60) if entrada.hours_played is not None else None,
        play_count=entrada.play_count,
        graphics_score=rating.graphics_score if rating else None,
        sound_score=rating.sound_score if rating else None,
        gameplay_score=rating.gameplay_score if rating else None,
        difficulty_score=rating.difficulty_score if rating else None,
        sessions=[
            schemas.PublicSessionOut(started_at=s.started_at, finished_at=s.finished_at, duration_minutes=s.duration_minutes)
            for s in sorted(entrada.sessions, key=lambda s: s.started_at, reverse=True)
        ],
    )


@router.post("/follow/{user_id}/favorite", response_model=schemas.FollowActionOut)
def favorite_friend(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Marca um amigo já seguido como favorito — fixa as atividades dele no topo do feed (item 4.1)."""
    vinculo = (
        db.query(models.Follow)
        .filter(
            models.Follow.follower_id == current_user.id, models.Follow.followee_id == user_id,
            models.Follow.status == models.FollowStatus.ACCEPTED,
        )
        .first()
    )
    if not vinculo:
        raise HTTPException(status_code=400, detail="Você só pode favoritar quem já está seguindo de verdade.")
    vinculo.is_favorite_friend = True
    db.commit()
    followers_count = (
        db.query(models.Follow)
        .filter(models.Follow.followee_id == user_id, models.Follow.status == models.FollowStatus.ACCEPTED)
        .count()
    )
    return schemas.FollowActionOut(following=True, followers_count=followers_count, follow_status="accepted")


@router.delete("/follow/{user_id}/favorite", response_model=schemas.FollowActionOut)
def unfavorite_friend(
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
        vinculo.is_favorite_friend = False
        db.commit()
    followers_count = (
        db.query(models.Follow)
        .filter(models.Follow.followee_id == user_id, models.Follow.status == models.FollowStatus.ACCEPTED)
        .count()
    )
    return schemas.FollowActionOut(following=True, followers_count=followers_count, follow_status="accepted")


@router.post("/follow/{user_id}", response_model=schemas.FollowActionOut)
def follow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Envia um PEDIDO pra seguir — não segue na hora. A pessoa segue de verdade
    só depois de aceitar (ver /follow-requests/{id}/accept). Uma notificação
    é criada pro alvo saber que tem um pedido esperando.
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Você não pode seguir a si mesmo.")
    alvo = db.query(models.User).filter(models.User.id == user_id).first()
    if not alvo:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    vinculo = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == current_user.id, models.Follow.followee_id == user_id)
        .first()
    )
    if not vinculo:
        db.add(models.Follow(
            follower_id=current_user.id, followee_id=user_id, status=models.FollowStatus.PENDING,
        ))
        db.add(models.Notification(
            user_id=user_id, type=models.NotificationType.FOLLOW_REQUEST, actor_id=current_user.id,
        ))
        db.commit()
    elif vinculo.status == models.FollowStatus.REJECTED:
        # Pedido recusado antes — deixa pedir de novo.
        vinculo.status = models.FollowStatus.PENDING
        vinculo.responded_at = None
        db.add(models.Notification(
            user_id=user_id, type=models.NotificationType.FOLLOW_REQUEST, actor_id=current_user.id,
        ))
        db.commit()
    # Se já está PENDING ou ACCEPTED, não faz nada (idempotente).

    follow_status = _status_do_vinculo(db, current_user.id, user_id)
    followers_count = (
        db.query(models.Follow)
        .filter(models.Follow.followee_id == user_id, models.Follow.status == models.FollowStatus.ACCEPTED)
        .count()
    )
    return schemas.FollowActionOut(
        following=(follow_status == "accepted"), followers_count=followers_count, follow_status=follow_status,
    )


@router.delete("/follow/{user_id}", response_model=schemas.FollowActionOut)
def unfollow_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Deixa de seguir — também serve pra CANCELAR um pedido ainda pendente (mesma ação, mesmo endpoint)."""
    vinculo = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == current_user.id, models.Follow.followee_id == user_id)
        .first()
    )
    if vinculo:
        db.delete(vinculo)
        db.commit()

    followers_count = (
        db.query(models.Follow)
        .filter(models.Follow.followee_id == user_id, models.Follow.status == models.FollowStatus.ACCEPTED)
        .count()
    )
    return schemas.FollowActionOut(following=False, followers_count=followers_count, follow_status="none")


@router.get("/follow-requests", response_model=list[schemas.FollowRequestOut])
def get_follow_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Pedidos pendentes pra seguir o usuário logado — a lista que alimenta a central de notificações/aprovação."""
    pedidos = (
        db.query(models.Follow)
        .options(joinedload(models.Follow.follower))
        .filter(models.Follow.followee_id == current_user.id, models.Follow.status == models.FollowStatus.PENDING)
        .order_by(models.Follow.created_at.desc())
        .all()
    )
    return [
        schemas.FollowRequestOut(
            follower_id=p.follower_id,
            display_name=p.follower.display_name,
            avatar_data=p.follower.avatar_data,
            requested_at=p.created_at,
        ) for p in pedidos
    ]


@router.post("/follow-requests/{follower_id}/accept", response_model=schemas.FollowActionOut)
def accept_follow_request(
    follower_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    vinculo = (
        db.query(models.Follow)
        .filter(
            models.Follow.follower_id == follower_id,
            models.Follow.followee_id == current_user.id,
            models.Follow.status == models.FollowStatus.PENDING,
        )
        .first()
    )
    if not vinculo:
        raise HTTPException(status_code=404, detail="Pedido não encontrado (já pode ter sido respondido).")

    vinculo.status = models.FollowStatus.ACCEPTED
    vinculo.responded_at = datetime.utcnow()
    db.add(models.Notification(
        user_id=follower_id, type=models.NotificationType.FOLLOW_ACCEPTED, actor_id=current_user.id,
    ))
    db.commit()

    followers_count = (
        db.query(models.Follow)
        .filter(models.Follow.followee_id == current_user.id, models.Follow.status == models.FollowStatus.ACCEPTED)
        .count()
    )
    return schemas.FollowActionOut(following=True, followers_count=followers_count, follow_status="accepted")


@router.post("/follow-requests/{follower_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_follow_request(
    follower_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    vinculo = (
        db.query(models.Follow)
        .filter(
            models.Follow.follower_id == follower_id,
            models.Follow.followee_id == current_user.id,
            models.Follow.status == models.FollowStatus.PENDING,
        )
        .first()
    )
    if vinculo:
        db.delete(vinculo)  # remove de vez — a pessoa pode tentar pedir de novo depois, sem "cicatriz"
        db.commit()


@router.get("/notifications", response_model=list[schemas.NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Últimas notificações (pedidos de seguir + aceites) — carregadas quando o sino é aberto/a página recarrega."""
    notificacoes = (
        db.query(models.Notification)
        .options(joinedload(models.Notification.actor))
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(30)
        .all()
    )
    return [
        schemas.NotificationOut(
            id=n.id,
            type=n.type.value,
            actor_id=n.actor_id,
            actor_display_name=n.actor.display_name if n.actor else None,
            actor_avatar_data=n.actor.avatar_data if n.actor else None,
            is_read=n.is_read,
            created_at=n.created_at,
        ) for n in notificacoes
    ]


@router.get("/notifications/unread-count", response_model=schemas.UnreadCountOut)
def get_unread_notifications_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Só o número, pro badge do sino — bem mais leve que carregar a lista inteira a cada poucos segundos."""
    total = (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id, models.Notification.is_read == False)  # noqa: E712
        .count()
    )
    return schemas.UnreadCountOut(unread_count=total)


@router.post("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notificacao = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id, models.Notification.user_id == current_user.id)
        .first()
    )
    if notificacao and not notificacao.is_read:
        notificacao.is_read = True
        db.commit()


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id, models.Notification.is_read == False)  # noqa: E712
        .update({"is_read": True})
    )
    db.commit()


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
        return _status_do_vinculo(db, visitante_id, alvo_id) == "accepted"
    return True


@router.get("/followers/{user_id}", response_model=list[schemas.UserSearchHitOut])
def get_followers(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Lista quem segue esse usuário — só relações já ACEITAS (não mostra pedidos ainda pendentes)."""
    if not _pode_ver_lista(db, user_id, current_user.id):
        raise HTTPException(status_code=403, detail="Este perfil é privado.")

    seguidores = (
        db.query(models.User)
        .join(models.Follow, models.Follow.follower_id == models.User.id)
        .filter(models.Follow.followee_id == user_id, models.Follow.status == models.FollowStatus.ACCEPTED)
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
    """Lista quem esse usuário está seguindo — só relações já ACEITAS."""
    if not _pode_ver_lista(db, user_id, current_user.id):
        raise HTTPException(status_code=403, detail="Este perfil é privado.")

    seguindo = (
        db.query(models.User)
        .join(models.Follow, models.Follow.followee_id == models.User.id)
        .filter(models.Follow.follower_id == user_id, models.Follow.status == models.FollowStatus.ACCEPTED)
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
    que o usuário segue (só quem já ACEITOU o pedido — não vaza atividade de
    quem ainda nem aprovou). Amigos marcados como favoritos (item 4.1) vêm
    sempre primeiro, antes de qualquer outra atividade, independente da data.
    Se ele ainda não segue ninguém, mostra a atividade pública recente de
    toda a comunidade (assim a aba não fica vazia).
    """
    vinculos_aceitos = (
        db.query(models.Follow)
        .filter(models.Follow.follower_id == current_user.id, models.Follow.status == models.FollowStatus.ACCEPTED)
        .all()
    )
    seguindo_ids = [f.followee_id for f in vinculos_aceitos]
    favoritos_ids = {f.followee_id for f in vinculos_aceitos if f.is_favorite_friend}

    consulta = (
        db.query(models.PlaySession, models.UserGame, models.User, models.Game)
        .join(models.UserGame, models.PlaySession.user_game_id == models.UserGame.id)
        .join(models.User, models.UserGame.user_id == models.User.id)
        .join(models.Game, models.UserGame.game_id == models.Game.id)
        .filter(models.PlaySession.started_at >= date.today() - timedelta(days=30))
    )
    if seguindo_ids:
        # Perfil "público" sempre entra; perfil "só amigos" também entra se o
        # usuário logado já for um seguidor ACEITO dessa pessoa (sem essa
        # segunda condição, seguir alguém com perfil "só amigos" nunca
        # mostraria a atividade dela no feed, mesmo já sendo amigo de verdade).
        consulta = consulta.filter(
            or_(models.User.profile_visibility == "public", models.User.id.in_(seguindo_ids))
        )
    else:
        consulta = consulta.filter(models.User.profile_visibility == "public")

    linhas = consulta.order_by(models.PlaySession.started_at.desc()).limit(60).all()

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

    # Favoritos sempre no topo (independente da data), depois o resto por
    # recência — dentro de cada grupo, também ordenado do mais recente pro mais antigo.
    itens.sort(key=lambda i: (i.user_id not in favoritos_ids, -i.at.toordinal()))
    return itens[:40]
