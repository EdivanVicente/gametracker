# GameTracker Pro — segunda rodada de correções

Todos os 10 pontos que você reportou foram corrigidos e **testados de
verdade** (não é revisão só de leitura de código): rodei o backend, criei
usuário, confirmei e-mail, adicionei jogos, favoritei, avaliei, editei
perfil, testei isolamento entre contas e acesso sem token.

## Como rodar

### Backend
```bash
cd gametracker-backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Na primeira vez que você subir o servidor, ele **migra automaticamente**
o `gametracker.db` existente para o novo formato (adiciona as colunas de
perfil e verificação de e-mail) — não precisa apagar o banco antigo nem
mexer em nada manualmente.

### Frontend
Abra `index.html` no navegador (ou sirva com Live Server / `python -m
http.server`). Já aponta para `http://127.0.0.1:8000`.

### Confirmação de e-mail — modo desenvolvimento
Sem SMTP configurado no `.env`, o e-mail de confirmação **não é enviado
de verdade**: o link aparece no terminal onde o backend está rodando,
assim:
```
[DEV] Link de confirmação de e-mail para voce@email.com: http://127.0.0.1:8000/auth/verify?token=...
```
Copie esse link e abra no navegador para confirmar a conta. Para enviar
e-mails de verdade, preencha no `.env`: `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (com um provedor como Gmail,
SendGrid, Amazon SES etc.).

---

## O que foi corrigido, ponto a ponto

**1. Capa do jogo não aparecia.**
O `GET /games/` do backend não devolvia o campo `cover_url` (só título,
plataforma, gênero e notas), e o card no frontend nunca usava a capa
mesmo quando ela existia — sempre mostrava um ícone genérico. Reescrevi
o endpoint pra devolver o objeto do jogo completo (com `cover_url`) e o
`dashboard.js` agora exibe a imagem real.

**2. Clicar no card não abria nada.**
O modal de detalhe/edição existia no HTML, mas nenhum clique no card
estava ligado a ele — não havia `addEventListener` nenhum. Implementei
a abertura do modal com os dados reais do jogo (datas, plataforma,
favorito, notas por estrela).

**3. Confirmação de cadastro por e-mail.**
Implementei o fluxo completo: `POST /auth/register` cria o usuário como
"não verificado" e envia (ou loga, em modo dev) um link de confirmação;
`POST /auth/login` bloqueia com erro 403 até o e-mail ser confirmado;
`GET /auth/verify?token=...` é a rota que o link aciona; e adicionei um
botão "Reenviar e-mail de confirmação" na tela de login para quando o
usuário não recebe o primeiro e-mail.

**4. Botão "Sair" solto no canto esquerdo da tela.**
Era um botão solto fora da navbar (bug visual — ficava flutuando fora do
layout). Removido; o "Sair" correto continua disponível no menu de
perfil (agora também limpa o token corretamente, o que antes não
acontecia nesse local específico).

**5. Páginas "Explorar" e "Relatórios" não existiam.**
"Explorar" já tinha um endpoint pronto no backend (`/explore/gameplay`)
mas nenhuma página o consumia — criei `explore.html`. "Relatórios" não
tinha nada, nem front nem back — criei `reports.html`, que calcula (a
partir da sua própria biblioteca): distribuição por gênero e por
plataforma, notas médias por categoria, taxa de conclusão e top 5 jogos
mais bem avaliados. Tudo client-side, sem precisar de endpoint novo.

**6. Botões de favoritos não funcionavam.**
O botão existia no card, mas sem nenhum evento de clique associado, e o
backend não tinha uma forma de marcar/desmarcar favorito. Implementei
o clique (com feedback visual imediato) e o backend agora aceita
`PATCH /games/{id}` com `is_favorite`.

**7. Filtros não funcionavam.**
Os campos de busca/console/gênero/status/nota mínima/"somente
favoritos" existiam no HTML, mas nenhum JavaScript os líia. Implementei
a filtragem completa no `dashboard.js`. Também corrigi um problema sutil:
o filtro de console usava valores como "ps5" que nunca dariam match com
o nome real da plataforma salvo ("PlayStation 5") — ajustei os dois lados
para casarem.

**8. Números do catálogo (em andamento, finalizados etc.) inválidos.**
Estavam fixos no HTML (`47`, `6`, `38`, `12` — números de exemplo que
nunca mudavam). Agora são calculados de verdade a partir da sua
biblioteca a cada carregamento.

**9. Página "Meu perfil" vazia.**
Criei `profile.html` com: foto de perfil (upload de imagem, convertida
para base64 e salva no seu próprio usuário — sem precisar de servidor de
arquivos separado), nome de exibição editável, e-mail (somente leitura)
e a data de entrada ("Membro desde"), usando a data de criação da conta
que já existia no banco.

**10. Modo claro e escuro.**
Adicionei um botão de alternância (ícone de sol/lua) em todas as
páginas, que salva a preferência no navegador e aplica antes mesmo da
página desenhar (sem "flash" do tema errado). O tema escuro continua
sendo o padrão, igual já era antes.

---

## Detalhes técnicos extras (não pedidos, mas corrigidos de brinde)
- CORS estava configurado de um jeito que navegadores modernos recusam
  (`allow_origins=["*"]` + `allow_credentials=True`); corrigido.
- `/explore/gameplay` derrubava a página inteira com erro 500 se a
  `YOUTUBE_API_KEY` não estivesse configurada; agora devolve os dados do
  jogo normalmente e só deixa o vídeo vazio.
- Erro de senha fraca no cadastro aparecia como `[object Object]` em vez
  de uma mensagem legível.
- Removido código morto (uma variável de API key sobrescrita sem efeito
  nenhum, deixada por engano em `main.py`).

## O que ainda depende de você
- **YouTube API Key**: sem ela, a página Explorar mostra os dados do
  jogo mas não o vídeo de gameplay. Gere a chave no Google Cloud Console
  (YouTube Data API v3) e coloque no `.env`.
- **SMTP real**: em modo dev, o link de confirmação só aparece no
  terminal. Para enviar e-mails de verdade, configure um provedor SMTP
  no `.env` (veja a seção "Confirmação de e-mail" acima).
- Não toquei no `.git` do seu projeto — os arquivos aqui são só o código
  corrigido; sugiro revisar o diff e commitar você mesmo.
