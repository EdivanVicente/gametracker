"""
Rotas de descoberta / integração com APIs externas.

- /games/search      -> busca de metadados de jogos (RAWG), usado no CRUD do catálogo
- /games/recommendations -> motor de recomendação (histórico do usuário + busca por estilo)
- /explore/gameplay   -> busca de vídeo de gameplay (YouTube), usado no módulo "Explorar"

Todas exigem usuário autenticado, evitando consumo indevido de quota das APIs externas
por requisições anônimas.
"""

from collections import Counter
import asyncio

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user
from app.database import get_db
from app import models
from app.services.games_api import games_api_service
from app.services.youtube_api import youtube_api_service

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["Descoberta"])

# Mapa de afinidade entre estilos/gêneros — quando o usuário busca um termo,
# também incluímos os estilos "parecidos" na busca. Ex: pesquisar "luta" também
# traz jogos de metroidvania/beat 'em up, que têm uma pegada correlata,
# em vez de devolver só correspondências exatas da palavra "luta".
# As chaves cobrem português e inglês (a pessoa pode digitar em qualquer um).
_AFINIDADES_DE_ESTILO: dict[str, list[str]] = {
    "luta": ["fighting", "beat 'em up"],
    "fighting": ["luta", "beat 'em up"],
    "briga": ["fighting", "beat 'em up"],
    "metroidvania": ["castlevania", "metroid", "hollow knight"],
    "castlevania": ["metroidvania", "gothic action"],
    "souls": ["souls-like", "dark souls", "elden ring"],
    "soulslike": ["souls-like", "dark souls"],
    "souls-like": ["dark souls", "elden ring", "metroidvania"],
    "roguelike": ["rogue-lite", "procedural dungeon"],
    "roguelite": ["roguelike", "procedural dungeon"],
    "rpg": ["jrpg", "role-playing", "action rpg"],
    "jrpg": ["rpg", "turn-based rpg"],
    "shooter": ["fps", "third-person shooter"],
    "fps": ["shooter", "tactical shooter"],
    "tiro": ["shooter", "fps"],
    "plataforma": ["platformer", "metroidvania"],
    "platformer": ["plataforma", "metroidvania"],
    "terror": ["horror", "survival horror"],
    "horror": ["terror", "survival horror"],
    "aventura": ["adventure", "action-adventure"],
    "adventure": ["aventura", "action-adventure"],
    "estrategia": ["strategy", "tactics"],
    "estratégia": ["strategy", "tactics"],
    "strategy": ["estratégia", "tactics"],
    "puzzle": ["quebra-cabeça", "logic puzzle"],
    "sobrevivencia": ["survival", "crafting"],
    "sobrevivência": ["survival", "crafting"],
    "survival": ["sobrevivência", "crafting"],
    "mundo aberto": ["open world", "sandbox"],
    "open world": ["mundo aberto", "sandbox"],
    "hack and slash": ["hack n slash", "beat em up", "musou"],
    "simulacao": ["simulation", "sim"],
    "simulação": ["simulation", "sim"],
    "corrida": ["racing"],
    "racing": ["corrida"],
    "esporte": ["sports"],
    "sports": ["esporte"],
    "moba": ["multiplayer online battle arena"],
    "battle royale": ["shooter", "survival"],
    "indie": ["indie", "pixel art"],
    "acao": ["action", "hack and slash"],
    "ação": ["action", "hack and slash"],
}


def _expandir_termos_de_busca(consulta: str) -> list[str]:
    """Devolve a consulta original + termos de estilos correlatos (se houver algum reconhecido)."""
    termos = [consulta]
    chave = consulta.strip().lower()
    if chave in _AFINIDADES_DE_ESTILO:
        termos.extend(_AFINIDADES_DE_ESTILO[chave])
    else:
        # Também tenta achar o termo como PARTE de uma frase maior
        # (ex: "jogos de luta 2d" -> reconhece "luta" dentro da frase).
        for chave_conhecida, relacionados in _AFINIDADES_DE_ESTILO.items():
            if chave_conhecida in chave:
                termos.extend(relacionados)
                break
    # Remove duplicatas mantendo a ordem (a consulta original sempre primeiro).
    vistos = set()
    unicos = []
    for t in termos:
        if t.lower() not in vistos:
            vistos.add(t.lower())
            unicos.append(t)
    return unicos


def _generos_predominantes_do_usuario(db: Session, user_id: int, limite: int = 3) -> list[str]:
    """
    Varre os jogos salvos pelo usuário (priorizando finalizados/em andamento sobre
    a wishlist) e devolve os gêneros mais frequentes — usado quando a pessoa não
    digita nenhum termo de busca, pra sugerir com base no histórico dela mesma.
    """
    jogos = (
        db.query(models.UserGame)
        .options(joinedload(models.UserGame.game))
        .filter(models.UserGame.user_id == user_id)
        .order_by(models.UserGame.created_at.desc())
        .limit(30)
        .all()
    )
    contador = Counter()
    for ug in jogos:
        peso = 2 if ug.status in (models.GameStatus.FINISHED, models.GameStatus.PLAYING) else 1
        for genero in (ug.game.genre or "").split(","):
            genero = genero.strip()
            if genero:
                contador[genero] += peso
    return [g for g, _ in contador.most_common(limite)]


@router.get("/games/recommendations")
async def get_recommendations(
    q: str | None = Query(None, min_length=2, description="Termo de estilo/gênero opcional (ex: 'luta', 'RPG')"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Motor de recomendação:
      - Com `q`: busca o termo digitado E estilos correlatos (ex: "luta" também
        traz metroidvania/beat em up), cruzando com o catálogo externo.
      - Sem `q`: usa os gêneros predominantes no histórico do próprio usuário
        (jogos finalizados/em andamento pesam mais que a wishlist).
      - Em ambos os casos, jogos que a pessoa já tem na biblioteca são excluídos
        do resultado (não faz sentido "recomendar" o que ela já catalogou).
    """
    ja_na_biblioteca = {
        g.external_id for g in
        db.query(models.Game.external_id)
        .join(models.UserGame, models.UserGame.game_id == models.Game.id)
        .filter(models.UserGame.user_id == current_user.id)
        .all()
    }

    if q and q.strip():
        termos_de_busca = _expandir_termos_de_busca(q.strip())
        baseado_em = "busca"
    else:
        generos = _generos_predominantes_do_usuario(db, current_user.id)
        if not generos:
            return {"baseado_em": "sem_historico", "generos_usados": [], "resultados": []}
        termos_de_busca = generos
        baseado_em = "historico"

    resultados_por_id: dict[str, dict] = {}
    for termo in termos_de_busca[:4]:  # limita chamadas externas — no máx. 4 buscas por requisição
        try:
            achados = await games_api_service.search_games(query=termo, page_size=8)
        except HTTPException:
            continue
        for jogo in achados:
            if jogo["external_id"] in ja_na_biblioteca or jogo["external_id"] in resultados_por_id:
                continue
            resultados_por_id[jogo["external_id"]] = jogo

    return {
        "baseado_em": baseado_em,
        "generos_usados": termos_de_busca,
        "resultados": list(resultados_por_id.values())[:24],
    }


@router.get("/games/search")
async def search_games(
    q: str = Query(..., min_length=2, description="Nome do jogo a ser pesquisado"),
    page_size: int = Query(20, ge=1, le=40, description="Quantidade de resultados"),
):
    """
    Busca flexível (partial match) de jogos por nome — usada tanto na etapa 1 do
    fluxo de catalogação quanto na página Explorar, que agora mostra TODAS as
    variações encontradas (ex: buscar "Zelda" traz vários títulos e plataformas
    diferentes, em vez de só o primeiro resultado).
    """
    try:
        return await games_api_service.search_games(query=q, page_size=page_size)
    except HTTPException:
        raise
    except Exception:
        # Rede de segurança final: nenhuma falha inesperada aqui deve virar um
        # 500 cru pro usuário — melhor um erro claro (503) do que a tela travar.
        raise HTTPException(
            status_code=503,
            detail="O serviço de busca de jogos está instável no momento. Tente novamente em instantes.",
        )


@router.get("/games/{external_id}")
async def get_game_details(external_id: str, lang: str = "pt"):
    """Detalhes completos de um jogo específico, usado ao confirmar a seleção no modal."""
    detalhes = await games_api_service.get_game_details(external_id=external_id)
    original = detalhes.get("description")
    # A tradução usa uma biblioteca SÍNCRONA (chamada de rede bloqueante).
    # Chamá-la direto aqui travaria o loop de eventos inteiro — ou seja,
    # travaria o site pra TODO MUNDO, não só pra quem pediu esse jogo —
    # pelo tempo que o Google Tradutor demorar a responder. `asyncio.to_thread`
    # joga essa espera pra uma thread separada, sem bloquear mais ninguém.
    traduzida = await asyncio.to_thread(games_api_service.translate_description, original, lang)
    detalhes["description"] = traduzida if traduzida is not None else original
    return detalhes


@router.get("/explore/gameplay")
async def explore_gameplay(
    title: str = Query(..., min_length=2, description="Nome do jogo para buscar gameplay"),
    external_id: str | None = Query(None, description="Se informado, busca os detalhes EXATOS desse jogo (não faz nova busca por nome)"),
    lang: str = "pt",
):
    """
    Módulo 'Explorar': retorna metadados do jogo (RAWG/IGDB) + vídeo de gameplay
    (YouTube) para exibição no modal "Saiba mais".

    Se `external_id` for informado (usuário clicou num resultado específico da
    lista de busca), buscamos os detalhes EXATOS daquele jogo — evita o problema
    de re-buscar por nome e cair num título diferente (ex: outra versão/plataforma).
    Sem `external_id` (uso legado/compatibilidade), faz o comportamento antigo:
    pega o primeiro resultado da busca por nome.

    Se a YOUTUBE_API_KEY não estiver configurada, ou a RAWG/IGDB falharem, os
    campos correspondentes vêm como `None`/lista vazia em vez de quebrar a rota inteira.
    """
    game_data = None
    try:
        if external_id:
            game_data = await games_api_service.get_game_details(external_id=external_id)
        else:
            resultados_busca = await games_api_service.search_games(query=title, page_size=1)
            if resultados_busca:
                game_data = await games_api_service.get_game_details(external_id=resultados_busca[0]["external_id"])
        if game_data:
            original = game_data.get("description")
            # Mesmo motivo do endpoint /games/{external_id}: sem o to_thread,
            # essa chamada bloqueante travaria o servidor inteiro enquanto
            # espera o Google Tradutor responder — e esse endpoint em
            # particular é chamado toda vez que alguém abre um jogo no
            # Explorar ou no perfil de um amigo, então é o ponto que mais
            # sofria com isso.
            traduzida = await asyncio.to_thread(games_api_service.translate_description, original, lang)
            game_data["description"] = traduzida if traduzida is not None else original
    except HTTPException:
        game_data = None

    try:
        videos = await youtube_api_service.search_gameplay_video(game_title=title, max_results=3)
    except HTTPException:
        videos = []

    return {
        "game": game_data,
        "video": videos[0] if videos else None,
        # Candidatos extras: se o primeiro vídeo estiver indisponível/removido,
        # o frontend tenta o próximo desta lista automaticamente.
        "videos": videos,
    }
