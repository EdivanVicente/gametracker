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
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.core.deps import get_current_user
from app import models, schemas
from app.services.games_api import games_api_service, _parece_erro_de_traducao
from app.services.igdb_service import igdb_service
from app.services.hltb_service import hltb_service

import logging

logger = logging.getLogger("gametracker.games")

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

    # A RAWG não tem um campo de "capa" de verdade — o "background_image" dela
    # costuma ser um screenshot ou arte promocional, não a capa/boxart oficial.
    # A IGDB tem capas de verdade (cover.url), então, quando o resultado veio
    # da RAWG, tentamos trocar só a capa por uma da IGDB (mantendo o resto dos
    # dados da RAWG) — melhor esforço, nunca bloqueia o cadastro se falhar.
    if external_id.startswith("rawg-"):
        await _tentar_melhorar_capa(details)

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


async def _tentar_melhorar_capa(details: dict) -> None:
    """Busca a mesma capa na IGDB (que tem capas de verdade) e troca, se achar uma correspondência exata."""
    if not details.get("title") or not igdb_service.configurado:
        return
    try:
        candidatos = await igdb_service.search_games(details["title"], page_size=5)
    except Exception:
        logger.warning("Não foi possível consultar a IGDB pra melhorar a capa de '%s'.", details.get("title"))
        return

    titulo_normalizado = details["title"].strip().lower()
    correspondencia = next(
        (c for c in candidatos if (c.get("title") or "").strip().lower() == titulo_normalizado and c.get("cover_url")),
        None,
    )
    if correspondencia:
        details["cover_url"] = correspondencia["cover_url"]


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


def _traducao_cacheada_ou_original(db: Session, jogo: models.Game, lang: str) -> tuple[str | None, bool]:
    """
    Só olha o cache (sem chamar o tradutor pela rede). Devolve
    (texto, precisa_traduzir) — se precisa_traduzir=True, o texto devolvido
    ainda é o original (inglês), esperando a tradução de verdade ser feita
    depois (ver _traduzir_em_lote, chamado em paralelo pra quem tiver mais de
    um jogo faltando tradução).
    """
    if lang == "en" or not jogo.description:
        return jogo.description, False

    cache = (
        db.query(models.GameTranslation)
        .filter(models.GameTranslation.game_id == jogo.id, models.GameTranslation.lang == lang)
        .first()
    )
    if cache:
        if _parece_erro_de_traducao(cache.description):
            # Autocura: essa tradução foi cacheada por engano numa hora em que
            # o Google devolveu uma página de erro em vez de traduzir de
            # verdade (bug já corrigido — isso aqui limpa o que ficou de
            # antes). Apaga o cache ruim e cai pro fluxo normal, que tenta
            # traduzir de novo.
            logger.warning(
                "Tradução cacheada de '%s' (%s) era uma página de erro disfarçada — descartando e tentando de novo.",
                jogo.title, lang,
            )
            db.delete(cache)
            db.commit()
        else:
            return cache.description, False

    return jogo.description, True


def _traduzir_em_lote(db: Session, jogos: list[models.Game], lang: str) -> None:
    """
    Traduz vários jogos de uma vez, EM PARALELO (thread pool) — cada chamada
    ao serviço de tradução é uma requisição de rede bloqueante (pode levar
    1-2+ segundos), então traduzir jogo por jogo em sequência multiplicava
    esse tempo pelo número de jogos sem cache (ex: 10 jogos sem tradução
    cacheada = até 10x o tempo de espera, numa tela que deveria ser rápida).
    Rodando em paralelo, o tempo total fica perto do tempo de UMA única
    tradução, não da soma de todas.

    IMPORTANTE: as chamadas de tradução em si (rede, sem acesso ao banco)
    rodam nas threads paralelas; a gravação do resultado no cache volta a ser
    sequencial na sessão principal do banco depois — sessões do SQLAlchemy
    não são seguras pra usar de várias threads ao mesmo tempo.
    """
    if not jogos:
        return

    with ThreadPoolExecutor(max_workers=min(8, len(jogos))) as executor:
        traducoes = list(executor.map(
            lambda jogo: games_api_service.translate_description(jogo.description, lang), jogos,
        ))

    for jogo, traduzida in zip(jogos, traducoes):
        if traduzida is None:
            continue  # falhou agora — mantém o original, tenta nas próximas cargas
        jogo.description = traduzida
        try:
            db.add(models.GameTranslation(game_id=jogo.id, lang=lang, description=traduzida))
            db.commit()
        except IntegrityError:
            # Duas requisições simultâneas traduziram o mesmo jogo/idioma ao
            # mesmo tempo (ex: duas abas abertas) — só descarta essa gravação,
            # a outra já cacheou primeiro.
            db.rollback()


def _descricao_no_idioma(db: Session, jogo: models.Game, lang: str) -> str | None:
    """
    Devolve a descrição do jogo no idioma pedido (pt/en/es), usando a tabela de
    cache de traduções pra não chamar o tradutor de novo a cada carregamento.
    Usada nos endpoints de UM jogo só (aqui a tradução direta ainda é rápida
    o bastante) — pra LISTAS de vários jogos, ver _traducao_cacheada_ou_original
    + _traduzir_em_lote acima, que paralelizam.
    """
    texto, precisa_traduzir = _traducao_cacheada_ou_original(db, jogo, lang)
    if not precisa_traduzir:
        return texto

    traduzida = games_api_service.translate_description(jogo.description, lang)
    if traduzida is None:
        # A tradução falhou agora (ex: serviço de tradução instável) — devolve
        # a descrição original SEM gravar nada no cache, pra tentar de novo
        # na próxima vez em vez de ficar "preso" mostrando texto vazio pra sempre.
        return jogo.description

    try:
        db.add(models.GameTranslation(game_id=jogo.id, lang=lang, description=traduzida))
        db.commit()
    except IntegrityError:
        # Duas requisições simultâneas traduziram o mesmo jogo/idioma ao mesmo
        # tempo (ex: duas abas abertas) — a outra já gravou primeiro, então só
        # descarta essa tentativa e usa o que já foi cacheado por ela.
        db.rollback()
        cache = (
            db.query(models.GameTranslation)
            .filter(models.GameTranslation.game_id == jogo.id, models.GameTranslation.lang == lang)
            .first()
        )
        if cache:
            return cache.description
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
    # Auto-cura de dados antigos: jogos que já tinham sessões com tempo
    # registrado ANTES da soma automática existir nunca tiveram "horas
    # jogadas" recalculado (só quem criava/editava uma sessão NOVA disparava
    # o recálculo). Recalculando aqui também, toda vez que a lista é
    # carregada, esses jogos antigos se autocorrigem sem precisar de nenhuma
    # migração manual nem de mexer em mais nada — só abrir a tela já resolve.
    precisa_commit = False
    for user_game in jogos:
        antes = user_game.hours_played
        user_game.refresh_from_sessions()
        if user_game.hours_played != antes:
            precisa_commit = True
    if precisa_commit:
        db.commit()

    # Um mesmo Game pode ser compartilhado por vários UserGame (ex: o mesmo
    # jogo adicionado em plataformas diferentes) — o SQLAlchemy devolve a
    # MESMA instância Python nesses casos (identity map). Sem controlar isso,
    # a 2ª vez que tentamos expunge() nesse Game já repetido, ele já não está
    # mais na sessão e a chamada explode com InvalidRequestError, derrubando
    # a tela inteira de "Meus Jogos" pra quem tem o mesmo jogo 2x.
    games_ja_processados: set[int] = set()
    jogos_para_traduzir: list[models.Game] = []
    for user_game in jogos:
        if user_game.game.id not in games_ja_processados:
            games_ja_processados.add(user_game.game.id)
            db.expunge(user_game.game)  # evita que a tradução "vaze" de volta pro banco por engano
            texto, precisa_traduzir = _traducao_cacheada_ou_original(db, user_game.game, lang)
            user_game.game.description = texto
            if precisa_traduzir:
                jogos_para_traduzir.append(user_game.game)

    # Só quem realmente não tinha tradução em cache dispara uma chamada de
    # rede — e todas elas em paralelo (ver _traduzir_em_lote), não uma atrás
    # da outra. Isso é o que evita a tela demorar multiplicado pelo número de
    # jogos sem tradução ainda.
    _traduzir_em_lote(db, jogos_para_traduzir, lang)

    return jogos


@router.post("/", response_model=schemas.UserGameOut, status_code=status.HTTP_201_CREATED)
async def add_game(
    payload: schemas.UserGameCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Adiciona um jogo (encontrado via /games/search) à biblioteca do usuário logado.

    O comportamento depende do `status` escolhido no momento de adicionar:
      - "wish_to_play": entra só na lista de desejos, sem nenhuma sessão/data.
      - "playing": cria a 1ª jogada em andamento (com a data de início).
      - "finished": cria a 1ª jogada já com início E fim registrados.

    Replay: se o usuário já tem esse mesmo jogo cadastrado na mesma plataforma
    (e ele já tinha pelo menos uma jogada, ou seja, não estava só na wishlist),
    NÃO criamos um card duplicado — abrimos uma nova jogada e incrementamos
    `play_count`. Se o jogo já existente ainda estava na wishlist (0 jogadas),
    isso é tratado como "começar a jogar" — não um replay.
    """
    game, plataforma_sugerida = await _get_or_create_game(db, payload.external_id)
    plataforma_final = payload.platform or plataforma_sugerida
    data_inicio = payload.started_at or date.today()

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
        if payload.status == "wish_to_play":
            # Já está na biblioteca (nem que seja só na wishlist) — não faz
            # sentido "adicionar de novo" como desejo; devolve como está.
            return _get_owned_user_game(db, existente.id, current_user)

        db.add(models.PlaySession(
            user_game_id=existente.id,
            played_at=data_inicio,
            started_at=data_inicio,
            finished_at=payload.finished_at,
            duration_minutes=round(payload.hours_played * 60) if payload.hours_played is not None else None,
        ))
        db.flush()
        db.refresh(existente)
        existente.refresh_from_sessions()
        db.commit()
        return _get_owned_user_game(db, existente.id, current_user)

    if payload.status == "wish_to_play":
        user_game = models.UserGame(
            user_id=current_user.id,
            game_id=game.id,
            platform=plataforma_final,
            status=models.GameStatus.WISH_TO_PLAY,
            play_count=0,  # ainda não foi jogado nenhuma vez
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
        # Duração estimada (HowLongToBeat) é útil até pra quem ainda não começou.
        await _preencher_duracao_automatica(db, user_game)
        return _get_owned_user_game(db, user_game.id, current_user)

    user_game = models.UserGame(
        user_id=current_user.id,
        game_id=game.id,
        platform=plataforma_final,
        start_date=data_inicio,
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
    # A primeira jogada (data de criação do card) também entra no histórico —
    # já finalizada se o status escolhido foi "finished", em andamento se foi "playing".
    db.add(models.PlaySession(
        user_game_id=user_game.id,
        played_at=data_inicio,
        started_at=data_inicio,
        finished_at=payload.finished_at,  # None quando status == "playing"
        duration_minutes=round(payload.hours_played * 60) if payload.hours_played is not None else None,
    ))
    db.flush()
    db.refresh(user_game)
    user_game.refresh_from_sessions()
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

    A data de início pode ser retroativa (controle de jogos já jogados no
    passado), mas nunca no futuro — isso já é validado no schema.
    """
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    inicio = payload.started_at or date.today()
    db.add(models.PlaySession(
        user_game_id=user_game.id,
        played_at=inicio,
        started_at=inicio,
        finished_at=None,
        note=payload.note,
    ))
    db.flush()
    db.refresh(user_game)
    user_game.refresh_from_sessions()
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
    Marca a data de término (e, opcionalmente, o tempo gasto — útil pra
    registros estilo speedrun) de uma jogada específica. Se for a jogada em
    andamento mais recente, o card volta para "Finalizado" — mas o histórico
    de todas as jogadas anteriores (com suas datas) continua preservado.
    """
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    sessao = next((s for s in user_game.sessions if s.id == session_id), None)
    if not sessao:
        raise HTTPException(status_code=404, detail="Jogada não encontrada.")

    finalizacao = payload.finished_at or date.today()
    if finalizacao < sessao.started_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A data de finalização não pode ser anterior à data de início dessa jogada.",
        )
    sessao.finished_at = finalizacao
    if payload.duration_minutes is not None:
        sessao.duration_minutes = payload.duration_minutes

    user_game.refresh_from_sessions()
    db.commit()
    return _get_owned_user_game(db, user_game_id, current_user)


@router.put(
    "/{user_game_id}/sessions/{session_id}",
    response_model=schemas.UserGameOut,
)
def edit_play_session(
    user_game_id: int,
    session_id: int,
    payload: schemas.PlaySessionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Edita uma jogada já registrada — pra corrigir uma data digitada errada,
    apagar/ajustar o término, ou preencher o tempo (speedrun) depois.
    Diferente do PATCH acima (que só finaliza), este permite mudar QUALQUER
    campo da sessão, inclusive "reabrir" uma jogada limpando a data de fim.
    """
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    sessao = next((s for s in user_game.sessions if s.id == session_id), None)
    if not sessao:
        raise HTTPException(status_code=404, detail="Jogada não encontrada.")

    data = payload.model_dump(exclude_unset=True)
    novo_inicio = data.get("started_at", sessao.started_at)
    novo_fim = data["finished_at"] if "finished_at" in data else sessao.finished_at

    if novo_fim is not None and novo_inicio is not None and novo_fim < novo_inicio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A data de finalização não pode ser anterior à data de início.",
        )

    if "started_at" in data:
        sessao.started_at = data["started_at"]
        sessao.played_at = data["started_at"]
    if "finished_at" in data:
        sessao.finished_at = data["finished_at"]
    if "note" in data:
        sessao.note = data["note"]
    if "duration_minutes" in data:
        sessao.duration_minutes = data["duration_minutes"]

    user_game.refresh_from_sessions()
    db.commit()
    return _get_owned_user_game(db, user_game_id, current_user)


@router.delete("/{user_game_id}/sessions/{session_id}", response_model=schemas.UserGameOut)
def delete_play_session(
    user_game_id: int,
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Apaga uma jogada registrada por engano (ex: cliques duplicados em "Jogar
    novamente"). Mantém sempre pelo menos 1 jogada no histórico — se for a
    única, pede pra editá-la em vez de apagar (apagar o jogo inteiro da
    biblioteca é uma ação separada, no botão "Excluir" do card).
    """
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    sessao = next((s for s in user_game.sessions if s.id == session_id), None)
    if not sessao:
        raise HTTPException(status_code=404, detail="Jogada não encontrada.")

    if len(user_game.sessions) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível excluir a única jogada registrada. Edite-a ou remova o jogo da biblioteca.",
        )

    db.delete(sessao)
    db.flush()
    db.refresh(user_game)
    user_game.refresh_from_sessions()
    db.commit()
    return _get_owned_user_game(db, user_game_id, current_user)


@router.patch("/{user_game_id}", response_model=schemas.UserGameOut)
def update_game(
    user_game_id: int,
    payload: schemas.UserGameUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Atualiza plataforma, favorito, horas jogadas e/ou avaliação por categoria.

    Datas de início/fim NÃO são editadas por aqui — elas são sempre derivadas
    do histórico de jogadas (ver .../sessions/{id}). Duração estimada
    (HowLongToBeat) também não é editável por aqui — só via fetch-duration.
    """
    user_game = _get_owned_user_game(db, user_game_id, current_user)
    data = payload.model_dump(exclude_unset=True)

    if "platform" in data:
        user_game.platform = data["platform"]
    if "is_favorite" in data:
        user_game.is_favorite = data["is_favorite"]

    # Horas jogadas (float, em horas) -> convertido para minutos (int) no banco.
    if "hours_played" in data:
        valor = data["hours_played"]
        user_game.hours_played = round(valor * 60) if valor is not None else None

    rating_fields = {"graphics_score", "sound_score", "gameplay_score", "difficulty_score"}
    if rating_fields & data.keys():
        if user_game.rating is None:
            user_game.rating = models.Rating(user_game_id=user_game.id)
            db.add(user_game.rating)
        for field in rating_fields:
            if field in data:
                setattr(user_game.rating, field, data[field])

    # IMPORTANTE: se existir alguma jogada no histórico com tempo (duration_minutes)
    # preenchido, a SOMA dessas jogadas é sempre a fonte da verdade pra "horas
    # jogadas" — sobrepõe um valor manual enviado aqui. Isso existe porque a tela
    # de detalhe só atualiza esse campo quando o modal é reaberto; sem essa
    # reafirmação, um valor antigo (de antes de editar uma sessão) poderia ser
    # salvo por cima da soma correta ao clicar em "Salvar" logo após editar uma
    # jogada. Quando NENHUMA sessão tem tempo registrado, o valor manual acima
    # é respeitado normalmente (refresh_from_sessions não mexe nele nesse caso).
    user_game.refresh_from_sessions()

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
