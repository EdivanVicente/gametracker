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
    para exibição lado a lado no frontend (card + iframe embutido).

    Se a YOUTUBE_API_KEY não estiver configurada, o vídeo vem como `None` em vez de
    quebrar a rota inteira — o usuário ainda vê os dados do jogo.
    """
    try:
        game_metadata = await games_api_service.search_games(query=title, page_size=1)
    except HTTPException:
        game_metadata = []

    try:
        videos = await youtube_api_service.search_gameplay_video(game_title=title)
    except HTTPException:
        videos = []

    return {
        "game": game_metadata[0] if game_metadata else None,
        "video": videos[0] if videos else None,
    }
