"""
Rotas de descoberta / integração com APIs externas.

- /games/search      -> busca de metadados de jogos (RAWG), usado no CRUD do catálogo
- /explore/gameplay   -> busca de vídeo de gameplay (YouTube), usado no módulo "Explorar"

Ambas exigem usuário autenticado, evitando consumo indevido de quota das APIs externas
por requisições anônimas.
"""

from fastapi import APIRouter, Depends, Query, HTTPException

from app.core.deps import get_current_user
from app import models
from app.services.games_api import games_api_service
from app.services.youtube_api import youtube_api_service

router = APIRouter(dependencies=[Depends(get_current_user)], tags=["Descoberta"])


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
    traduzida = games_api_service.translate_description(original, lang)
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
            traduzida = games_api_service.translate_description(original, lang)
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
