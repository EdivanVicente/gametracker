# GameTracker Pro — terceira rodada: conta, redes sociais, HUD clicável

Tudo abaixo foi testado de verdade (backend rodando, cadastro, confirmação
de e-mail, troca de e-mail, troca de senha, exclusão de conta, perfil
completo salvo e recarregado) antes de ser entregue.

## Como rodar
Mesma coisa de sempre:
```bash
cd gametracker-backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
A migração automática cuida de adicionar todas as colunas novas no seu
`gametracker.db` existente — não precisa apagar nada.

---

## O que foi feito, ponto a ponto

**1. "Jogos no catálogo" → "Meus Jogos".**
Renomeado no HUD do topo do dashboard.

**2. HUD clicável.**
Cada número do topo (Meus Jogos / Em andamento / Finalizados / Favoritos)
agora é um link. Clicar leva pro `dashboard.html` já com o filtro certo
aplicado (usa `?filtro=playing`, `?filtro=finished`, `?filtro=favoritos`
ou `?filtro=todos` na URL).

**3 e 4. Nome + foto na navbar, com menu Minha conta / Games / Configurações.**
A navbar agora mostra o avatar (ou um ícone padrão, se você não tiver
foto) junto com o nome de exibição. Clicando, abre um menu com:
- **Minha conta** → `account.html`
- **Games** → `games.html`
- **Configurações** → `settings.html`
- **Sair**

**5. Página "Minha conta" (`account.html`) completa.**
Além do que já existia (foto, nome, e-mail, membro desde), agora tem:
- Frase de status (até 30 caracteres, com contador ao vivo)
- País (258 opções, com a bandeira aparecendo automaticamente — sem
  precisar de nenhuma imagem, é gerado via emoji Unicode a partir do
  código do país) e Estado (campo de texto livre, sem bandeira)
- Gênero: Masculino / Feminino / Outro / Privado
- Todos os campos de rede social e friend code que você pediu: 3DS,
  EA App, Nintendo Network, Nintendo Switch, PSN, Steam, Twitch (com a
  observação sobre lives), Ubisoft Connect, Wii, Xbox Live, Discord,
  Instagram e X
- Privacidade do perfil: Aberto a todos / Somente amigos / Privado
- Botões de Salvar e Cancelar (Cancelar restaura os valores salvos, sem
  precisar recarregar a página)

**6. Página "Games" (`games.html`).**
Mostra dois cards: o jogo que você está jogando agora (o mais recente
com status "em andamento") e o último jogo que você finalizou (pelo
`end_date` mais recente), além de um botão "Ver todos os meus jogos"
que leva pro catálogo completo.

**7. Página "Configurações" (`settings.html`).**
- **Trocar e-mail**: pede a senha atual, manda um link de confirmação
  pro *novo* endereço — o e-mail só muda de fato depois que você clica
  no link (evita erro de digitação te trancando pra fora da conta).
- **Trocar senha**: pede a senha atual + a nova (com confirmação).
- **Excluir conta**: pede a senha atual, manda um link de confirmação
  por e-mail — a conta (e todos os jogos catalogados) só é apagada de
  verdade depois que você clica no link. Isso é permanente.
- **Privacidade**: mesmo campo Aberto a todos / Somente amigos / Privado
  também disponível aqui (é o mesmo dado da página Minha conta, só que
  editável dos dois lugares por conveniência).

**8. Modal do jogo (clique no card) enriquecido.**
Agora mostra, além do formulário de tracking que já existia:
- Capa do jogo
- Gênero logo abaixo do nome
- Descrição resumida (até 50 palavras, cortada automaticamente)
- Badges com as plataformas onde o jogo está disponível
- Se é single-player, multiplayer, ou os dois (quando a RAWG tem essa
  informação — nem todo jogo tem)
- Um vídeo de gameplay/trailer do YouTube embutido (buscado na hora que
  você abre o modal)

Segui a ideia geral do print que você mandou (informações do jogo bem
visíveis, several badges, vídeo), mas com o visual próprio do
GameTracker Pro (cores, tipografia e cards que já existiam no projeto)
em vez de copiar o layout do HowLongToBeat.

---

## Detalhes técnicos que vale saber

- **Plataformas e modo single/multiplayer** só ficam disponíveis para
  jogos adicionados *depois* dessa atualização — são capturados da RAWG
  no momento em que você adiciona o jogo à biblioteca pela primeira vez.
  Jogos que você já tinha adicionado antes vão mostrar essa parte vazia
  até você removê-los e adicionar de novo (não dá pra "completar" dados
  de um jogo que já foi salvo sem re-buscar na RAWG).
- **Vídeo do YouTube no modal** depende da `YOUTUBE_API_KEY` estar
  configurada no `.env` do backend — sem ela, o modal mostra as outras
  informações normalmente e só a parte do vídeo fica vazia (não quebra
  nada).
- A bandeira do país é gerada por código, não é uma imagem — funciona
  offline e não depende de nenhum serviço externo.
- Removido um resto de código morto que tinha sobrado no `security.py`
  (import do `passlib` que não era mais usado desde a correção do bug de
  hash de senha).
