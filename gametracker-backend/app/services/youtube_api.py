"""
Service responsável pela comunicação com a YouTube Data API v3.
Usado pelo módulo "Explorar" para trazer gameplays de jogos ainda não catalogados.
"""

import httpx
from fastapi import HTTPException, status

from app.core.config import settings


class YoutubeApiService:
    def __init__(self):
        self.base_url = settings.YOUTUBE_BASE_URL
        self.api_key = settings.YOUTUBE_API_KEY
        self.timeout = 10.0

    async def search_gameplay_video(self, game_title: str, max_results: int = 1) -> list[dict]:
        """
        Busca vídeos de gameplay para um jogo, seguindo o padrão de query
        "[Nome do Jogo] gameplay no commentary" definido na especificação.
        """
        if not self.api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="YOUTUBE_API_KEY não configurada no ambiente.",
            )

        query = f"{game_title} gameplay no commentary"
        params = {
            "key": self.api_key,
            "q": query,
            "part": "snippet",
            "type": "video",
            "maxResults": max_results,
            "videoEmbeddable": "true",
            "relevanceLanguage": "pt",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(f"{self.base_url}/search", params=params)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Erro ao consultar a API do YouTube: {exc.response.status_code}",
                ) from exc
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Falha de conexão com a API do YouTube.",
                ) from exc

        data = response.json()
        return [self._map_video_item(item) for item in data.get("items", [])]

    @staticmethod
    def _map_video_item(item: dict) -> dict:
        video_id = item.get("id", {}).get("videoId")
        snippet = item.get("snippet", {})
        return {
            "video_id": video_id,
            "title": snippet.get("title"),
            "channel_title": snippet.get("channelTitle"),
            "thumbnail_url": snippet.get("thumbnails", {}).get("medium", {}).get("url"),
            # URL pronta para uso no atributo src de um <iframe>
            "embed_url": f"https://www.youtube.com/embed/{video_id}" if video_id else None,
            # Link direto pro YouTube, para abrir em uma nova aba (usado no card de thumbnail)
            "watch_url": f"https://www.youtube.com/watch?v={video_id}" if video_id else None,
        }


youtube_api_service = YoutubeApiService()
