"""
Service responsável pela comunicação com a RAWG Video Games Database API.

Documentação de referência: https://api.rawg.io/docs/
Nota: se preferir usar a IGDB (Twitch) no lugar da RAWG, a estrutura é a mesma —
troque apenas a URL base, os parâmetros de auth e o mapeamento de campos em
`_map_rawg_result_to_dict`.
"""

import httpx
from fastapi import HTTPException, status
from deep_translator import GoogleTranslator

from app.core.config import settings

# Limite de caracteres por chamada ao Google Translate (via deep-translator).
# Textos maiores são cortados em pedaços para não estourar o limite do serviço.
_TAMANHO_MAX_TRADUCAO = 4500


def _traduzir_texto(texto: str, idioma_destino: str = "pt") -> str:
    """
    Traduz um texto (descrição de jogo, vinda da RAWG normalmente em inglês) para
    o idioma pedido. Se a tradução falhar por qualquer motivo (sem internet,
    serviço fora do ar, texto vazio etc.), devolve o texto original em vez de
    quebrar a requisição — a descrição em inglês é melhor do que nenhuma descrição.

    `idioma_destino` já vem parametrizado pensando na futura versão multi-idioma
    do site (pt/en/es) — hoje sempre chamado com "pt", mas pronto para receber
    o idioma escolhido pelo usuário quando essa opção existir.
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
    except Exception:
        # Qualquer falha do serviço de tradução: devolve o texto original.
        return texto


class GamesApiService:
    """Encapsula as chamadas HTTP à API de jogos, isolando o resto do sistema do provedor externo."""

    def __init__(self):
        self.base_url = settings.RAWG_BASE_URL
        self.api_key = settings.RAWG_API_KEY
        self.timeout = 10.0

    async def search_games(self, query: str, page_size: int = 8) -> list[dict]:
        """
        Busca jogos por nome. Usado no fluxo de "o usuário digita, o sistema sugere".

        Retorna uma lista simplificada, já mapeada para o formato que o frontend consome.
        """
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

    async def get_game_details(self, external_id: str) -> dict:
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
        descricao_traduzida = _traduzir_texto(descricao_original, idioma_destino="pt") if descricao_original else None

        return {
            "external_id": str(item.get("id")),
            "title": item.get("name"),
            "cover_url": item.get("background_image"),
            "description": descricao_traduzida,
            "platforms": platforms,
            "genre": ", ".join(genres) if genres else None,
            "release_date": item.get("released"),
            "multiplayer_info": ", ".join(modos) if modos else None,
        }


games_api_service = GamesApiService()
