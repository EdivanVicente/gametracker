"""
Script simples pra testar se as credenciais da IGDB (Twitch) estão certas,
sem precisar rodar o site inteiro.

Como rodar (de dentro da pasta gametracker-backend, com o venv ativado):

    python test_igdb.py

Se der certo, mostra alguns jogos encontrados. Se der errado, mostra
exatamente qual foi o problema (credenciais vazias, credenciais erradas,
sem internet, etc.).
"""

import asyncio
from app.services.igdb_service import igdb_service


async def main():
    print("Client ID configurado:", bool(igdb_service.client_id))
    print("Client Secret configurado:", bool(igdb_service.client_secret))

    if not igdb_service.configurado:
        print("\n❌ IGDB_CLIENT_ID e/ou IGDB_CLIENT_SECRET estão vazios no .env.")
        print("Preencha os dois no arquivo .env (dentro de gametracker-backend) e rode de novo.")
        return

    print("\nBuscando 'zelda' na IGDB...")
    resultados = await igdb_service.search_games("zelda", page_size=3)

    if not resultados:
        print("\n❌ A busca não retornou nada. Motivos mais comuns:")
        print("  - Client ID/Secret incorretos (confira se copiou certinho, sem espaços)")
        print("  - O app criado na Twitch não está com a categoria certa")
        print("  - Sem internet / firewall bloqueando id.twitch.tv ou api.igdb.com")
        print("Veja a mensagem de warning acima (se apareceu) pra mais detalhes.")
        return

    print(f"\n✅ Sucesso! {len(resultados)} jogo(s) encontrado(s):")
    for jogo in resultados:
        print(f"  - {jogo['title']} ({jogo['external_id']})")


if __name__ == "__main__":
    asyncio.run(main())
