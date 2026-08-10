"""
Rotas da "Minha Biblioteca" (CRUD do catálogo pessoal do usuário).

- GET    /games/            -> lista os jogos do usuário logado (com capa, notas, etc.)
- POST   /games/            -> adiciona um jogo (encontrado via /games/search) à biblioteca
- PATCH  /games/{id}        -> atualiza tracking (datas/plataforma/favorito) e avaliação
- DELETE /games/{id}        -> remove um jogo da biblioteca

Todas as rotas exigem usuário autenticado e operam apenas sobre registros
pertencentes ao usuário logado (isolamento por user_id).
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.deps import get_current_user
from app import models, schemas
from app.services.games_api import games_api_service
from app.services.hltb_service import hltb_service

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
        .options(
            joinedload(models.UserGame.game),
            joinedload(models.UserGame.rating),
            joinedload(models.UserGame.sessions),
        )
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


async def _preencher_duracao_automatica(db: Session, user_game: models.UserGame) -> None:
    """
    Tenta buscar automaticamente a duração estimada (missão principal / 100%) no
    HowLongToBeat na primeira vez que o jogo é adicionado. Melhor esforço: se a
    busca falhar ou não achar nada, simplesmente não preenche — o usuário pode
    editar manualmente depois, sem quebrar o fluxo de adicionar jogo.
    """
    if user_game.time_to_beat_main is not None:
        return  # já tem valor (editado manualmente ou já buscado antes)
    try:
        resultado = await hltb_service.buscar_duracao(user_game.game.title)
    except Exception:
        resultado = None
    if not resultado:
        return
    if resultado.get("main_story_minutes"):
        user_game.time_to_beat_main = resultado["main_story_minutes"]
    if resultado.get("completionist_minutes"):
        user_game.time_to_beat_completionist = resultado["completionist_minutes"]
    db.commit()


def _descricao_no_idioma(db: Session, jogo: models.Game, lang: str) -> str | None:
    """
    Devolve a descrição do jogo no idioma pedido (pt/en/es), usando a tabela de
    cache de traduções pra não chamar o tradutor de novo a cada carregamento.
    """
    if lang == "en" or not jogo.description:
        return jogo.description

    cache = (
        db.query(models.GameTranslation)
        .filter(models.GameTranslation.game_id == jogo.id, models.GameTranslation.lang == lang)
        .first()
    )
    if cache:
        return cache.description

    traduzida = games_api_service.translate_description(jogo.description, lang)
    if traduzida is None:
        # A tradução falhou agora (ex: serviço de tradução instável) — devolve
        # a descrição original SEM gravar nada no cache, pra tentar de novo
        # na próxima vez em vez de ficar "preso" mostrando texto vazio pra sempre.
        return jogo.description

    db.add(models.GameTranslation(game_id=jogo.id, lang=lang, description=traduzida))
    db.commit()
    return traduzida


@router.get("/", response_model=list[schemas.UserGameOut])
def get_my_games(
    lang: str = "pt",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Busca apenas os jogos do usuário logado, já com capa, gênero e avaliação carregados."""
    jogos = (
        db.query(models.UserGame)
        .options(
            joinedload(models.UserGame.game),
            joinedload(models.UserGame.rating),
            joinedload(models.UserGame.sessions),
        )
        .filter(models.UserGame.user_id == current_user.id)
        .order_by(models.UserGame.created_at.desc())
        .all()
    )
    for user_game in jogos:
        db.expunge(user_game.game)  # evita que a tradução "vaze" de volta pro banco por engano
        user_game.game.description = _descricao_no_idioma(db, user_game.game, lang)
    return jogos


@router.post("/", response_model=schemas.UserGameOut, status_code=status.HTTP_201_CREATED)
async def add_game(
    payload: schemas.UserGameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Adiciona um jogo (encontrado via /games/search) à biblioteca do usuário logado.

    Replay: se o usuário já tem esse mesmo jogo cadastrado na mesma plataforma,
    NÃO criamos um card duplicado — em vez disso abrimos uma nova jogada (sessão
    "em andamento", sem data de término) e incrementamos `play_count`. O status
    do card volta para "Em andamento" até essa jogada ser finalizada.
    """
    game, plataforma_sugerida = await _get_or_create_game(db, payload.external_id)
    plataforma_final = payload.platform or plataforma_sugerida

    existente = (
        db.query(models.UserGame)
        .filter(
            models.UserGame.user_id == current_user.id,
            models.UserGame.game_id == game.id,
            models.UserGame.platform == plataforma_final,
        )
        .first()
    )
    if existente:
        existente.play_count = (existente.play_count or 1) + 1
        existente.status = models.GameStatus.PLAYING
        existente.start_date = date.today()
        existente.end_date = None
        db.add(models.PlaySession(
            user_game_id=existente.id,
            played_at=date.today(),
            started_at=date.today(),
            finished_at=None,
        ))
        db.commit()
        return _get_owned_user_game(db, existente.id, current_user)

    user_game = models.UserGame(
        user_id=current_user.id,
        game_id=game.id,
        platform=plataforma_final,
        start_date=date.today(),
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
    # A primeira jogada (data de criação do card) também entra no histórico, "em andamento".
    db.add(models.PlaySession(
        user_game_id=user_game.id,
        played_at=date.today(),
        started_at=date.today(),
        finished_at=None,
    ))
    db.commit()
    db.refresh(user_game)

    # Melhor esforço: tenta preencher a duração estimada automaticamente (HowLongToBeat).
    await _preencher_duracao_automatica(db, user_game)

    # Recarrega com os relacionamentos para a resposta serializar corretamente (com a capa)
    return _get_owned_user_game(db, user_game.id, current_user)


@router.post("/{user_game_id}/fetch-duration", response_model=schemas.UserGameOut)
async def fetch_duration(
    user_game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Busca (ou tenta buscar de novo) a duração estimada no HowLongToBeat pra um
    jogo que já está na biblioteca — útil pra jogos adicionados antes dessa
    funcionalidade existir, ou quando a busca automática falhou na hora de
    adicionar. Sempre sobrescreve os campos com o que for encontrado.
    """
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    resultado = await hltb_service.buscar_duracao(user_game.game.title)
    if not resultado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Não encontramos duração para esse jogo no HowLongToBeat. Preencha manualmente.",
        )
    if resultado.get("main_story_minutes"):
        user_game.time_to_beat_main = resultado["main_story_minutes"]
    if resultado.get("completionist_minutes"):
        user_game.time_to_beat_completionist = resultado["completionist_minutes"]
    db.commit()
    return _get_owned_user_game(db, user_game_id, current_user)


@router.post(
    "/{user_game_id}/sessions",
    response_model=schemas.UserGameOut,
    status_code=status.HTTP_201_CREATED,
)
def add_play_session(
    user_game_id: int,
    payload: schemas.PlaySessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Registra manualmente uma nova jogada ("Jogar novamente") — abre uma sessão
    com data de início e SEM data de término, e o card volta para "Em andamento"
    automaticamente. Fica assim até o usuário registrar a finalização dessa
    jogada específica (ver PATCH .../sessions/{session_id}).
    """
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    user_game.play_count = (user_game.play_count or 1) + 1
    user_game.status = models.GameStatus.PLAYING
    inicio = payload.started_at or date.today()
    user_game.start_date = inicio
    user_game.end_date = None
    db.add(models.PlaySession(
        user_game_id=user_game.id,
        played_at=inicio,
        started_at=inicio,
        finished_at=None,
        note=payload.note,
    ))
    db.commit()
    return _get_owned_user_game(db, user_game_id, current_user)


@router.patch(
    "/{user_game_id}/sessions/{session_id}",
    response_model=schemas.UserGameOut,
)
def finish_play_session(
    user_game_id: int,
    session_id: int,
    payload: schemas.PlaySessionFinish,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Marca a data de término de uma jogada específica. Se for a jogada em
    andamento mais recente, o card volta para "Finalizado" — mas o histórico
    de todas as jogadas anteriores (com suas datas) continua preservado.
    """
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    sessao = next((s for s in user_game.sessions if s.id == session_id), None)
    if not sessao:
        raise HTTPException(status_code=404, detail="Jogada não encontrada.")

    sessao.finished_at = payload.finished_at or date.today()

    # Se não sobrou nenhuma jogada em aberto, o card fica "Finalizado".
    ainda_jogando = any(s.finished_at is None for s in user_game.sessions)
    if not ainda_jogando:
        user_game.status = models.GameStatus.FINISHED
        user_game.end_date = sessao.finished_at

    db.commit()
    return _get_owned_user_game(db, user_game_id, current_user)


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

    # Campos em horas (float) no schema -> convertidos para minutos (int) no banco.
    for campo in ("hours_played", "time_to_beat_main", "time_to_beat_completionist"):
        if campo in data:
            valor = data[campo]
            setattr(user_game, campo, round(valor * 60) if valor is not None else None)

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
