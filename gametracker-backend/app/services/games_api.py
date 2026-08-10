"""
Service responsável pela comunicação com a RAWG Video Games Database API.

Documentação de referência: https://api.rawg.io/docs/
Nota: se preferir usar a IGDB (Twitch) no lugar da RAWG, a estrutura é a mesma —
troque apenas a URL base, os parâmetros de auth e o mapeamento de campos em
`_map_rawg_result_to_dict`.
"""

import logging

import httpx
from fastapi import HTTPException, status
from deep_translator import GoogleTranslator

from app.core.config import settings
from app.services.igdb_service import igdb_service

logger = logging.getLogger("gametracker.games_api")

# Limite de caracteres por chamada ao Google Translate (via deep-translator).
# Textos maiores são cortados em pedaços para não estourar o limite do serviço.
_TAMANHO_MAX_TRADUCAO = 4500


def _traduzir_texto(texto: str, idioma_destino: str = "pt") -> str | None:
    """
    Traduz um texto (descrição de jogo, vinda da RAWG normalmente em inglês) para
    o idioma pedido. Se a tradução falhar por qualquer motivo (sem internet,
    serviço fora do ar, texto vazio etc.), devolve None — IMPORTANTE: não
    devolve o texto original aqui, pra quem chama conseguir diferenciar
    "traduziu com sucesso" de "falhou" e decidir se vale a pena cachear o
    resultado ou tentar de novo na próxima vez (ver `_descricao_no_idioma`
    em app/routers/games.py — cachear uma falha faria o app ficar "preso"
    mostrando o texto errado pra sempre, mesmo depois do serviço voltar).
    """
    if not texto:
        return texto

    try:
        if len(texto) <= _TAMANHO_MAX_TRADUCAO:
            return GoogleTranslator(source="auto", target=idioma_destino).translate(texto)

        # Textos longos: traduz em pedaços e junta de novo, quebrando em frases
        # para não cortar uma tradução no meio de uma palavra.
        partes = []
        pedaco_atual = ""
        for frase in texto.split(". "):
            if len(pedaco_atual) + len(frase) + 2 > _TAMANHO_MAX_TRADUCAO:
                partes.append(pedaco_atual)
                pedaco_atual = frase
            else:
                pedaco_atual = f"{pedaco_atual}. {frase}" if pedaco_atual else frase
        if pedaco_atual:
            partes.append(pedaco_atual)

        traduzido = [GoogleTranslator(source="auto", target=idioma_destino).translate(p) for p in partes]
        return " ".join(traduzido)
    except Exception as exc:
        logger.warning("Falha ao traduzir texto pra '%s' (%s) — não será cacheado.", idioma_destino, exc)
        return None


class GamesApiService:
    """
    Ponto único de acesso a dados de jogos externos. Usa a RAWG como provedor
    principal; se ela falhar (fora do ar, timeout, erro 5xx), tenta
    automaticamente a IGDB como reserva — o resto do sistema nem fica sabendo
    qual das duas respondeu, só recebe o resultado já no mesmo formato.

    Os external_id retornados vêm sempre prefixados ("rawg-123" / "igdb-456")
    pra sabermos depois, ao buscar detalhes, em qual das duas API perguntar.
    IDs antigos salvos ANTES dessa mudança (sem prefixo) continuam funcionando
    — são tratados como RAWG por padrão (compatibilidade com dados antigos).
    """

    def __init__(self):
        self.base_url = settings.RAWG_BASE_URL
        self.api_key = settings.RAWG_API_KEY
        self.timeout = 10.0

    async def search_games(self, query: str, page_size: int = 8) -> list[dict]:
        """Busca jogos por nome. Tenta RAWG primeiro; se falhar, cai pra IGDB automaticamente."""
        try:
            return await self._rawg_search_games(query, page_size)
        except HTTPException as exc_rawg:
            logger.warning("RAWG falhou na busca por '%s' (%s) — tentando IGDB...", query, exc_rawg.detail)
            try:
                resultados_igdb = await igdb_service.search_games(query, page_size)
            except Exception as exc_igdb:
                logger.warning("IGDB também falhou na busca por '%s' (%s).", query, exc_igdb)
                resultados_igdb = []

            if resultados_igdb:
                logger.info("Busca por '%s' respondida pela IGDB (fallback).", query)
                return resultados_igdb

            # Nenhum dos dois provedores respondeu: propaga o erro original da RAWG,
            # que é mais informativo pro usuário/log do que um erro genérico da IGDB.
            raise exc_rawg

    async def get_game_details(self, external_id: str) -> dict:
        """Busca os detalhes completos de um jogo, roteando pro provedor certo pelo prefixo do ID."""
        if external_id.startswith("igdb-"):
            detalhes = await igdb_service.get_game_details(external_id.removeprefix("igdb-"))
            if not detalhes:
                raise HTTPException(status_code=404, detail="Jogo não encontrado na base externa (IGDB).")
            return detalhes

        id_rawg = external_id.removeprefix("rawg-")
        try:
            return await self._rawg_get_game_details(id_rawg)
        except HTTPException as exc_rawg:
            # Fallback: se por algum motivo a RAWG não conseguir servir os
            # detalhes de um jogo que ELA MESMA retornou na busca (ex: caiu
            # entre a busca e o clique), tenta achar o mesmo jogo na IGDB pelo nome.
            logger.warning("RAWG falhou ao buscar detalhes de '%s' — sem fallback direto por ID nesse caso.", external_id)
            raise exc_rawg

    async def _rawg_search_games(self, query: str, page_size: int) -> list[dict]:
        if not self.api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="RAWG_API_KEY não configurada no ambiente.",
            )

        params = {
            "key": self.api_key,
            "search": query,
            "page_size": page_size,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(f"{self.base_url}/games", params=params)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Erro ao consultar a API de jogos: {exc.response.status_code}",
                ) from exc
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Falha de conexão com a API de jogos.",
                ) from exc

        data = response.json()
        results = data.get("results", [])
        return [self._map_rawg_result_to_dict(item) for item in results]

    async def _rawg_get_game_details(self, external_id: str) -> dict:
        """Busca os detalhes completos de um jogo específico pelo ID externo (RAWG)."""
        params = {"key": self.api_key}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.get(f"{self.base_url}/games/{external_id}", params=params)
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Jogo não encontrado na base externa.",
                ) from exc
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Falha de conexão com a API de jogos.",
                ) from exc

        return self._map_rawg_result_to_dict(response.json())

    @staticmethod
    def _map_rawg_result_to_dict(item: dict) -> dict:
        """Normaliza o payload da RAWG para o formato interno do GameTracker Pro."""
        platforms = [
            p["platform"]["name"]
            for p in item.get("platforms", []) or []
            if p.get("platform")
        ]
        genres = [g["name"] for g in item.get("genres", []) or []]

        # A RAWG expõe "tags" com slugs como "singleplayer", "multiplayer", "co-op" etc.
        # Usamos isso pra dar uma ideia (não é 100% garantido, mas cobre a maioria dos jogos).
        tag_slugs = {t.get("slug", "") for t in item.get("tags", []) or []}
        modos = []
        if "singleplayer" in tag_slugs:
            modos.append("Single-player")
        if any(slug in tag_slugs for slug in ("multiplayer", "co-op", "online-co-op", "local-multiplayer")):
            modos.append("Multiplayer")

        descricao_original = item.get("description_raw") or item.get("description")

        return {
            "external_id": f"rawg-{item.get('id')}",
            "title": item.get("name"),
            "cover_url": item.get("background_image"),
            "description": descricao_original,
            "platforms": platforms,
            "genre": ", ".join(genres) if genres else None,
            "release_date": item.get("released"),
            "multiplayer_info": ", ".join(modos) if modos else None,
        }

    @staticmethod
    def translate_description(texto: str | None, idioma_destino: str) -> str | None:
        """
        Ponto único usado pelas rotas pra traduzir uma descrição já buscada,
        pro idioma escolhido pelo usuário (a descrição fica em inglês, como
        vem da RAWG, até esse ponto).

        Devolve None se a tradução falhou de verdade (pra quem chama saber
        que NÃO deve cachear esse resultado como se fosse definitivo).
        """
        if not texto or idioma_destino == "en":
            return texto  # já vem em inglês da RAWG, não precisa traduzir
        return _traduzir_texto(texto, idioma_destino=idioma_destino)


games_api_service = GamesApiService()
