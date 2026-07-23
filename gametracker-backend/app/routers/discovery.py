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
):
    """Etapa 1 do fluxo de catalogação: o usuário digita, o backend consulta a RAWG."""
    return await games_api_service.search_games(query=q)


@router.get("/games/{external_id}")
async def get_game_details(external_id: str):
    """Detalhes completos de um jogo específico, usado ao confirmar a seleção no modal."""
    return await games_api_service.get_game_details(external_id=external_id)


@router.get("/explore/gameplay")
async def explore_gameplay(
    title: str = Query(..., min_length=2, description="Nome do jogo para buscar gameplay"),
):
    """
    Módulo 'Explorar': retorna metadados do jogo (RAWG) + vídeo de gameplay (YouTube)
    para exibição lado a lado no frontend (card + player de vídeo).

    Importante: usamos a busca em lista só para achar o ID do jogo, e depois
    buscamos os DETALHES completos dele (get_game_details) — a busca em lista da
    RAWG não retorna a descrição do jogo, só os detalhes completos retornam.

    Se a YOUTUBE_API_KEY não estiver configurada, ou a RAWG falhar, os campos
    correspondentes vêm como `None`/lista vazia em vez de quebrar a rota inteira.
    """
    game_data = None
    try:
        resultados_busca = await games_api_service.search_games(query=title, page_size=1)
        if resultados_busca:
            game_data = await games_api_service.get_game_details(external_id=resultados_busca[0]["external_id"])
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
