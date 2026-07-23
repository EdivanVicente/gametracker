"""
Script para popular o banco com uma conta de demonstração já verificada e
alguns jogos de exemplo, para você conseguir testar o site inteiro sem
precisar passar pelo fluxo de cadastro/confirmação de e-mail.

Como rodar (de dentro da pasta gametracker-backend, com o venv ativado):

    python seed_demo.py

É seguro rodar mais de uma vez — se a conta demo já existir, o script não
duplica nada, só avisa e sai sem alterar o banco.

Credenciais da conta demo:
    E-mail: demo@gametracker.com
    Senha:  Demo123!
"""

from datetime import date, timedelta

from app.database import Base, engine, SessionLocal
from app import models
from app.core.security import hash_password

DEMO_EMAIL = "demo@gametracker.com"
DEMO_PASSWORD = "Demo123!"

# Capas hospedadas na CDN pública da Steam (estáveis e sem necessidade de chave de API).
JOGOS_EXEMPLO = [
    {
        "external_id": "demo-1",
        "title": "Hollow Knight",
        "cover_url": "https://cdn.cloudflare.steamstatic.com/steam/apps/367520/header.jpg",
        "description": (
            "Um metroidvania desenhado à mão, ambientado num reino subterrâneo em ruínas "
            "habitado por insetos. Explore cavernas vastas, enfrente criaturas corrompidas "
            "e descubra os segredos de Hallownest."
        ),
        "genre": "Action, Adventure, Indie",
        "platforms": "PC, Nintendo Switch, PlayStation 4, Xbox One",
        "multiplayer_info": "Single-player",
        "platform_jogador": "PC",
        "status": "playing",
        "favorito": True,
        "notas": {"graphics_score": 5, "sound_score": 5, "gameplay_score": 5, "difficulty_score": 4},
        "dias_desde_inicio": 12,
        "dias_desde_fim": None,
    },
    {
        "external_id": "demo-2",
        "title": "Stardew Valley",
        "cover_url": "https://cdn.cloudflare.steamstatic.com/steam/apps/413150/header.jpg",
        "description": (
            "Você herda a velha fazenda do seu avô. Plante, colha, pesque, minere e construa "
            "relações com os moradores da cidade nesse simulador de vida relaxante."
        ),
        "genre": "Simulation, RPG, Indie",
        "platforms": "PC, Nintendo Switch, PlayStation 4, Xbox One, Mobile",
        "multiplayer_info": "Single-player, Multiplayer",
        "platform_jogador": "Nintendo Switch",
        "status": "finished",
        "favorito": True,
        "notas": {"graphics_score": 4, "sound_score": 5, "gameplay_score": 5, "difficulty_score": 2},
        "dias_desde_inicio": 90,
        "dias_desde_fim": 20,
    },
    {
        "external_id": "demo-3",
        "title": "Elden Ring",
        "cover_url": "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg",
        "description": (
            "Um RPG de ação em mundo aberto criado pela FromSoftware. Explore as Terras "
            "Intermédias, enfrente semideuses corrompidos e reconstrua o Anel Prístino."
        ),
        "genre": "RPG, Action",
        "platforms": "PC, PlayStation 5, Xbox Series S/X, PlayStation 4, Xbox One",
        "multiplayer_info": "Single-player, Multiplayer",
        "platform_jogador": "PlayStation 5",
        "status": "playing",
        "favorito": False,
        "notas": {"graphics_score": 5, "sound_score": 4, "gameplay_score": 5, "difficulty_score": 5},
        "dias_desde_inicio": 5,
        "dias_desde_fim": None,
    },
    {
        "external_id": "demo-4",
        "title": "Celeste",
        "cover_url": "https://cdn.cloudflare.steamstatic.com/steam/apps/504230/header.jpg",
        "description": (
            "Ajude Madeline a escalar a Montanha Celeste, num jogo de plataforma desafiador "
            "sobre ansiedade, autoaceitação e superação pessoal."
        ),
        "genre": "Platformer, Indie",
        "platforms": "PC, Nintendo Switch, PlayStation 4, Xbox One",
        "multiplayer_info": "Single-player",
        "platform_jogador": "PC",
        "status": "finished",
        "favorito": False,
        "notas": {"graphics_score": 5, "sound_score": 5, "gameplay_score": 4, "difficulty_score": 5},
        "dias_desde_inicio": 45,
        "dias_desde_fim": 40,
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        usuario_existente = db.query(models.User).filter(models.User.email == DEMO_EMAIL).first()
        if usuario_existente:
            print(f"A conta demo já existe ({DEMO_EMAIL}). Nada foi alterado.")
            print("Se quiser recriar do zero, apague o usuário e os jogos dele antes de rodar de novo.")
            return

        usuario = models.User(
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            is_verified=True,  # já vem confirmada, sem precisar clicar em link de e-mail
            display_name="Convidado Demo",
            bio="Só de passagem, testando tudo",
            country="BR",
            state="São Paulo",
            gender="private",
            profile_visibility="public",
            steam_id="convidadodemo",
            discord="demo#0001",
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)

        for item in JOGOS_EXEMPLO:
            jogo = models.Game(
                external_id=item["external_id"],
                title=item["title"],
                cover_url=item["cover_url"],
                description=item["description"],
                genre=item["genre"],
                platforms=item["platforms"],
                multiplayer_info=item["multiplayer_info"],
            )
            db.add(jogo)
            db.commit()
            db.refresh(jogo)

            start_date = date.today() - timedelta(days=item["dias_desde_inicio"])
            end_date = date.today() - timedelta(days=item["dias_desde_fim"]) if item["dias_desde_fim"] else None

            user_game = models.UserGame(
                user_id=usuario.id,
                game_id=jogo.id,
                platform=item["platform_jogador"],
                start_date=start_date,
                end_date=end_date,
                status=models.GameStatus(item["status"]),
                is_favorite=item["favorito"],
            )
            db.add(user_game)
            db.commit()
            db.refresh(user_game)

            rating = models.Rating(user_game_id=user_game.id, **item["notas"])
            db.add(rating)
            db.commit()

        print("Conta demo criada com sucesso!\n")
        print(f"  E-mail: {DEMO_EMAIL}")
        print(f"  Senha:  {DEMO_PASSWORD}\n")
        print(f"{len(JOGOS_EXEMPLO)} jogos de exemplo adicionados à biblioteca da conta demo.")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
