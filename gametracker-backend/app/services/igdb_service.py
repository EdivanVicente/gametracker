"""
Service responsável pela comunicação com a IGDB (Internet Game Database), via
API da Twitch — usado como PROVEDOR RESERVA quando a RAWG está fora do ar.

Documentação: https://api-docs.igdb.com/

Autenticação: IGDB usa OAuth2 "client credentials" da própria Twitch. Você
precisa criar um app em https://dev.twitch.tv/console/apps (gratuito) pra
gerar um Client ID + Client Secret, e configurar no .env:
    IGDB_CLIENT_ID=...
    IGDB_CLIENT_SECRET=...

Se essas variáveis não estiverem configuradas, esse serviço simplesmente fica
inativo (retorna listas vazias / None) — o app continua funcionando só com a
RAWG, sem quebrar nada.
"""

import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger("gametracker.igdb")

_TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
_IGDB_BASE_URL = "https://api.igdb.com/v4"

_CAMPOS = "name,cover.url,genres.name,platforms.name,summary,first_release_date,game_modes.name"


class IGDBService:
    def __init__(self):
        self.client_id = settings.IGDB_CLIENT_ID
        self.client_secret = settings.IGDB_CLIENT_SECRET
        self._token: str | None = None
        self._token_expira_em: float = 0
        self.timeout = 10.0

    @property
    def configurado(self) -> bool:
        return bool(self.client_id and self.client_secret)

    async def _get_access_token(self, client: httpx.AsyncClient) -> str | None:
        if self._token and time.time() < self._token_expira_em:
            return self._token

        resp = await client.post(_TWITCH_TOKEN_URL, params={
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
        })
        resp.raise_for_status()
        dados = resp.json()
        self._token = dados["access_token"]
        # Renova um pouco antes de expirar de verdade, por segurança.
        self._token_expira_em = time.time() + dados.get("expires_in", 3600) - 60
        return self._token

    async def search_games(self, query: str, page_size: int = 8) -> list[dict]:
        if not self.configurado:
            logger.warning(
                "IGDB: IGDB_CLIENT_ID/IGDB_CLIENT_SECRET não configurados no .env — "
                "fallback desativado, só a RAWG está ativa."
            )
            return []

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                token = await self._get_access_token(client)
                headers = {
                    "Client-ID": self.client_id,
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                }
                corpo = f'search "{query}"; fields {_CAMPOS}; limit {page_size};'
                resp = await client.post(f"{_IGDB_BASE_URL}/games", headers=headers, content=corpo)
                resp.raise_for_status()
                resultados = [self._map_igdb_result_to_dict(item) for item in resp.json()]
                logger.info("IGDB: busca por '%s' devolveu %s resultado(s).", query, len(resultados))
                return resultados
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "IGDB: erro HTTP %s ao buscar '%s' — resposta: %s",
                exc.response.status_code, query, exc.response.text[:300],
            )
            return []
        except Exception as exc:
            logger.warning("IGDB: falha inesperada ao buscar '%s' (%s)", query, exc)
            return []

    async def get_game_details(self, external_id: str) -> dict | None:
        if not self.configurado:
            return None

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                token = await self._get_access_token(client)
                headers = {
                    "Client-ID": self.client_id,
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                }
                corpo = f"fields {_CAMPOS}; where id = {external_id};"
                resp = await client.post(f"{_IGDB_BASE_URL}/games", headers=headers, content=corpo)
                resp.raise_for_status()
                resultados = resp.json()
                if not resultados:
                    return None
                return self._map_igdb_result_to_dict(resultados[0])
        except Exception as exc:
            logger.warning("IGDB: falha ao buscar detalhes de '%s' (%s)", external_id, exc)
            return None

    @staticmethod
    def _map_igdb_result_to_dict(item: dict) -> dict:
        """Normaliza o payload da IGDB para o MESMO formato interno usado pra RAWG."""
        capa = None
        if item.get("cover", {}).get("url"):
            # A IGDB devolve URL relativa tipo "//images.igdb.com/.../t_thumb/xyz.jpg";
            # trocamos pra t_cover_big (melhor resolução) e adicionamos o "https:".
            capa = "https:" + item["cover"]["url"].replace("t_thumb", "t_cover_big")

        genres = [g["name"] for g in item.get("genres", []) or []]
        platforms = [p["name"] for p in item.get("platforms", []) or []]
        modos = [m["name"] for m in item.get("game_modes", []) or []]

        release_date = None
        if item.get("first_release_date"):
            release_date = time.strftime("%Y-%m-%d", time.gmtime(item["first_release_date"]))

        return {
            # Prefixo "igdb-" identifica o provedor, pra buscar detalhes no lugar certo depois.
            "external_id": f"igdb-{item.get('id')}",
            "title": item.get("name"),
            "cover_url": capa,
            "description": item.get("summary"),
            "platforms": platforms,
            "genre": ", ".join(genres) if genres else None,
            "release_date": release_date,
            "multiplayer_info": ", ".join(modos) if modos else None,
        }


igdb_service = IGDBService()
