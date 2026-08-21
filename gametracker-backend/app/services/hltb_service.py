"""
Service de busca automática de duração estimada no HowLongToBeat (HLTB).

HLTB não tem uma API pública/oficial — o site é consumido internamente via um
endpoint de busca (usado pelo próprio site). Pra descobrir a "chave" desse
endpoint, a gente busca a página inicial, acha o bundle JS principal (Next.js)
e procura o padrão de concatenação que o próprio site usa pra montar a URL da
busca (technique usada pela comunidade, ex: lib howlongtobeatpy).

Como o HLTB muda esse bundle a cada deploy (e às vezes muda o próprio padrão
de ofuscação), essa busca é sempre "melhor esforço": se falhar por qualquer
motivo, devolvemos None e logamos o motivo — o app nunca trava por causa
disso, e o usuário sempre pode preencher a duração na mão.
"""

import logging
import re

import httpx

logger = logging.getLogger("gametracker.hltb")

_HLTB_BASE = "https://howlongtobeat.com"
_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Referer": f"{_HLTB_BASE}/",
    "Origin": _HLTB_BASE,
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
}

# Padrões conhecidos usados pelo HLTB pra ofuscar a URL do endpoint de busca
# dentro do bundle JS (eles concatenam "/api/seek/" com uma chave em runtime,
# em vez de deixar a URL completa visível no código-fonte). O HLTB muda esse
# esquema de tempos em tempos, então mantemos vários padrões conhecidos —
# se algum dia TODOS pararem de bater, é sinal de que o site mudou de novo
# e essa lista precisa de um padrão novo (fica registrado no log).
_PADROES_API_KEY = [
    r'/api/seek/"\.concat\("([a-fA-F0-9]+)"\)',
    r'"/api/seek/"\s*\+\s*"([a-fA-F0-9]+)"',
    r'api/seek/([a-fA-F0-9]{32,64})',
    r'fetch\("/api/seek/"\.concat\("([a-fA-F0-9]+)"\)',
    r'seek/"\)\.concat\("([a-fA-F0-9]+)"\)',
    r'"([a-fA-F0-9]{40,64})"\s*\)\s*\}\s*\}\s*,\s*"/api/seek/"',
]


class HLTBService:
    def __init__(self):
        self._api_key_cache: str | None = None

    async def _descobrir_api_key(self, client: httpx.AsyncClient, forcar_nova: bool = False) -> str | None:
        if self._api_key_cache and not forcar_nova:
            return self._api_key_cache

        try:
            home = await client.get(_HLTB_BASE, timeout=8)
        except Exception as exc:
            logger.warning("HLTB: falha ao abrir a página inicial (%s)", exc)
            return None

        scripts = re.findall(r'src="(/_next/static/chunks/pages/_app[^"]+\.js)"', home.text)
        if not scripts:
            scripts = re.findall(r'"(/_next/static/chunks/[^"]*_app[^"]+\.js)"', home.text)
        if not scripts:
            # Fallback mais amplo: se o esquema de nomes dos chunks do Next.js
            # mudou (não tem mais "_app" no nome), tenta TODOS os chunks JS
            # referenciados na página inicial — mais lento, mas mais resiliente.
            scripts = re.findall(r'"(/_next/static/chunks/[^"]+\.js)"', home.text)
        if not scripts:
            logger.warning("HLTB: não achei nenhum bundle JS na página inicial (site pode ter mudado a estrutura).")
            return None

        for script_path in scripts:
            try:
                js = await client.get(f"{_HLTB_BASE}{script_path}", timeout=8)
            except Exception as exc:
                logger.warning("HLTB: falha ao baixar bundle %s (%s)", script_path, exc)
                continue

            for padrao in _PADROES_API_KEY:
                match = re.search(padrao, js.text)
                if match:
                    self._api_key_cache = match.group(1)
                    logger.info("HLTB: api key encontrada com sucesso.")
                    return self._api_key_cache

        logger.warning("HLTB: nenhum padrão conhecido bateu no(s) bundle(s) JS — o site provavelmente mudou a ofuscação.")
        return None

    async def buscar_duracao(self, titulo: str) -> dict | None:
        """
        Busca a duração estimada (missão principal / 100%) para o título dado.
        Retorna {"main_story_minutes": int, "completionist_minutes": int} ou None.
        """
        if not titulo:
            return None

        payload = {
            "searchType": "games",
            "searchTerms": titulo.split(),
            "searchPage": 1,
            "size": 5,
            "searchOptions": {
                "games": {
                    "userId": 0, "platform": "", "sortCategory": "popular",
                    "rangeCategory": "main", "rangeTime": {"min": 0, "max": 0},
                    "gameplay": {"perspective": "", "flow": "", "genre": ""},
                    "modifier": "",
                },
                "users": {"sortCategory": "postcount"},
                "filter": "", "sort": 0, "randomizer": 0,
            },
        }

        try:
            async with httpx.AsyncClient(headers=_HEADERS) as client:
                api_key = await self._descobrir_api_key(client)
                if not api_key:
                    return None

                resp = await client.post(f"{_HLTB_BASE}/api/seek/{api_key}", json=payload, timeout=10)

                if resp.status_code in (403, 404):
                    # A chave que tínhamos em cache pode ter ficado velha (o HLTB
                    # roda essa chave de tempos em tempos) — sem isso, uma vez
                    # que a chave cacheada expira, TODA busca seguinte falharia
                    # pra sempre nesse processo, mesmo com o site funcionando
                    # normalmente. Descobre uma chave nova e tenta mais uma vez.
                    logger.info("HLTB: chave da API pode estar desatualizada (status %s) — buscando uma nova.", resp.status_code)
                    api_key = await self._descobrir_api_key(client, forcar_nova=True)
                    if not api_key:
                        return None
                    resp = await client.post(f"{_HLTB_BASE}/api/seek/{api_key}", json=payload, timeout=10)

                if resp.status_code != 200:
                    logger.warning("HLTB: busca por '%s' devolveu status %s.", titulo, resp.status_code)
                    return None

                dados = resp.json()
                jogos = dados.get("data") or []
                if not jogos:
                    logger.info("HLTB: nenhum resultado encontrado para '%s'.", titulo)
                    return None

                # Prioriza correspondência exata (ignorando maiúsculas/acentos triviais)
                # antes de cair pra heurística de "nome de tamanho parecido" — evita
                # pegar um jogo errado por coincidência de tamanho do nome
                # (ex: buscar "Zelda" e acabar pegando outro título qualquer).
                titulo_normalizado = titulo.strip().lower()
                exato = next(
                    (g for g in jogos if (g.get("game_name") or "").strip().lower() == titulo_normalizado),
                    None,
                )
                melhor = exato or min(jogos, key=lambda g: abs(len(g.get("game_name", "")) - len(titulo)))

                main_seg = melhor.get("comp_main") or 0
                comp_seg = melhor.get("comp_100") or melhor.get("comp_plus") or 0

                resultado = {}
                if main_seg:
                    resultado["main_story_minutes"] = round(main_seg / 60)
                if comp_seg:
                    resultado["completionist_minutes"] = round(comp_seg / 60)

                if not resultado:
                    logger.info("HLTB: '%s' encontrado, mas sem tempos cadastrados no site.", titulo)
                    return None

                logger.info("HLTB: duração encontrada para '%s' -> %s", titulo, resultado)
                return resultado
        except Exception as exc:
            logger.warning("HLTB: falha inesperada buscando '%s' (%s)", titulo, exc)
            return None


hltb_service = HLTBService()
