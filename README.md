# GameTracker Pro — quarta rodada: nomes, densidade da grade, correções de UX

Nove pedidos desta vez, todos testados com **navegador real automatizado**
(login, navegação entre todas as páginas, cliques em botões, verificação
visual por screenshot) antes de entregar.

## Changelog desta rodada, ponto a ponto

**1. "Relatórios" → "Estatísticas".**
O nome antigo não dizia muito sobre o que a página mostra (distribuição
por gênero/plataforma, notas médias, top jogos). Renomeei para
"Estatísticas" — arquivo também renomeado (`reports.html` →
`estatisticas.html`) e todos os links atualizados.

**2. Página "Explorar" mais convidativa.**
Adicionei um título, uma frase explicando o que a página faz, e uma fileira
de "sugestões" (5 jogos populares) que já disparam a busca com um clique —
antes era só uma barra de busca sem contexto nenhum.

**3. Vídeo do jogo: thumbnail + link, em vez de vídeo incorporado.**
Trocei o `<iframe>` que carregava o vídeo automaticamente por um card
com a miniatura do YouTube e um botão de play — clicar abre o vídeo numa
aba nova. Isso vale tanto no modal do jogo (dashboard) quanto na página
Explorar. Mais leve e não força o carregamento do player do YouTube
sem você pedir.

**4. Todos os textos em português.**
Troquei os últimos textos em inglês que tinham sobrado: o item de menu
"Games" virou "Jogos", e os títulos das abas do navegador ("Dashboard" e
"Games") também foram traduzidos. Conferi o site inteiro (HTML, JS,
placeholders, alertas) — o resto já estava em português.

**5. Placeholder da busca.**
Mudei para "Buscar nos meus jogos", como pedido.

**6. Menu de perfil com foto grande.**
Agora, ao clicar no menu (Minha conta / Jogos / Configurações), aparece
no topo do dropdown a foto redonda do perfil, o nome e o e-mail, antes
da lista de opções — em todas as páginas do site.

**7. Botão "Cancelar" da Minha Conta.**
Agora leva de volta para o catálogo (`dashboard.html`) sem salvar as
alterações, em vez de só limpar os campos do formulário (que era o
comportamento antigo e não parecia "fechar" nada).

**8. Botão de ordenação, que não tinha função nenhuma.**
O botão "Ordenar" existia visualmente mas nunca teve um `id` nem
JavaScript ligado a ele — agora é um dropdown funcional com 4 opções:
adicionado recentemente, nome A-Z, nome Z-A, nota mais alta. De brinde,
encontrei e corrigi outro bug relacionado: o botão de "somente
favoritos" já funcionava por trás dos panos, mas não tinha **nenhum**
estilo visual pro estado "ativado" — clicar nele não parecia fazer nada
mesmo filtrando corretamente. Também descobri que o menu dropdown inteiro
estava com fundo branco (padrão do Bootstrap, nunca sobrescrito) —
destoando do resto do tema escuro; corrigido junto.

**9. Densidade da grade (Lista / Pequeno / Médio / Grande), como o Google Drive.**
Adicionei 4 botões na barra de ferramentas. "Médio" é o visual que já
existia; "Pequeno" e "Grande" ajustam quantos jogos cabem por linha;
"Lista" troca pra um formato de linha horizontal compacta (capa pequena,
título, plataforma, notas e favorito tudo numa linha só). A escolha fica
salva no navegador — se você trocar pra Lista, da próxima vez que abrir
o site ele já abre em Lista.

## 🎮 Conta demo (pra testar sem precisar cadastrar)

Se você só quer testar o site rapidinho, sem passar pelo cadastro e
confirmação de e-mail:

```bash
cd gametracker-backend
python seed_demo.py
```

Isso cria uma conta já confirmada, com 4 jogos de exemplo (com notas,
datas, favoritos etc. já preenchidos) só para você navegar pelo site.
Credenciais:
```
E-mail: demo@gametracker.com
Senha:  Demo123!
```

Na tela de login tem um botão **"Entrar como visitante (conta demo)"**
que já preenche e envia essas credenciais sozinho — não precisa nem
digitar. É seguro rodar o `seed_demo.py` mais de uma vez: se a conta já
existir, ele não duplica nada.

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

⚠️ **Erro mais comum**: rodar o `uvicorn` na pasta errada. O comando
`uvicorn app.main:app --reload` só funciona de **dentro** da pasta
`gametracker-backend` (onde fica a pasta `app`). Se der
`ModuleNotFoundError: No module named 'app'`, é isso — faça `cd
gametracker-backend` antes.

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
- As capas dos jogos de exemplo da conta demo vêm da CDN pública da Steam
  (`cdn.cloudflare.steamstatic.com`) — é bem estável, mas se sua rede
  bloquear esse domínio por algum motivo, as capas não vão aparecer (o
  resto do site funciona normalmente mesmo assim).
