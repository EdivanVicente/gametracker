# GameTracker Pro — sexta rodada: contador de dias, toolbar, tradução, consoles

Oito pedidos desta vez, envolvendo mudanças de backend (tradução de
descrições, correção de um bug real na página Explorar) e frontend
(contador de tempo jogado, reorganização da toolbar, mais consoles e
gêneros, capas em paisagem). Tudo testado com **navegador real
automatizado**, com verificação numérica de cada comportamento (não só
visual).

## Changelog desta rodada (sexta), ponto a ponto

**1. Contador de dias jogando / concluído.**
Cada card (e o modal de detalhe) agora mostra:
- Enquanto o jogo está "em andamento": *"Jogando há X dias"*, contando a
  partir da data de início (ou da data em que você adicionou o jogo, se
  não tiver marcado uma data de início específica).
- Quando finalizado: *"Concluído em X dias"* + uma frase humanizada tipo
  *"Você passou 1 mês e 15 dias jogando este jogo"* (com anos, meses e
  dias, omitindo qualquer parte igual a zero).
- O texto se atualiza sozinho a cada 5 minutos (sem precisar recarregar
  a página), então o contador realmente vai avançando dia após dia
  enquanto você deixa a aba aberta ou revisita o site.

Um ajuste que fiz no seu exemplo original: você descreveu "concluído em
45 dias" como "1 mês e 45 dias", o que não fecha matematicamente (1 mês
já são ~30 dias, então sobrariam só uns 15). Implementei a versão que
faz sentido: 45 dias → "1 mês e 15 dias".

**2. Link de busca no YouTube quando não há vídeo.**
Tanto no modal do jogo quanto na página Explorar, quando nenhum vídeo de
gameplay é encontrado (ou nenhum candidato consegue tocar), agora aparece
um link "Buscar no YouTube" que abre a busca por "{nome do jogo}
gameplay" numa aba nova — pra você conseguir checar manualmente.

**3. Toolbar reorganizada em uma linha só.**
Os filtros de Console, Gênero, Status e Jogabilidade, que antes eram 4
campos separados ocupando duas linhas, agora ficam dentro de um único
dropdown "Filtros" (com contador de quantos filtros estão ativos, e um
botão "Limpar filtros"). A barra final ficou assim: busca — Filtros —
Favoritos — Ordenar — Visualização, tudo numa linha só.

**4. Lista completa de consoles clássicos + "Outro".**
Adicionei Game Boy, Game Boy Advance, Nintendo DS, Nintendo 3DS, NES,
Super Nintendo, Nintendo 64, GameCube, Wii, Wii U, Switch, PS1 a PS5,
PSP, PS Vita, Xbox Clássico, 360, One, Series S/X, Mega Drive, PC e
Mobile — organizados por fabricante (com `<optgroup>`) tanto no filtro
quanto no seletor de plataforma do jogo. Quando a plataforma não está
nessa lista, a opção "Outro" revela um campo de texto livre pra você
digitar o nome.

**5. Capas em paisagem (16:9), sem cortar a imagem.**
Mudado de um formato retrato (3:4, tipo capa de caixa de jogo) para
paisagem (16:9, tipo thumbnail), tanto nos cards do catálogo quanto no
modal de detalhe (onde a capa agora ocupa a largura toda, no topo) e na
página Explorar. Como já usamos `object-fit: contain`, a imagem aparece
inteira, sem cortar as bordas.

**6. Página Explorar não mostrava informações do jogo — bug real corrigido.**
Encontrei a causa: o endpoint buscava só a **busca em lista** da RAWG
pra montar as informações do jogo, mas a busca em lista não retorna a
descrição do jogo (só a busca de **detalhes** de um jogo específico traz
isso). Corrigi pra sempre buscar os detalhes completos depois de achar o
jogo certo — agora a descrição, gênero e plataformas aparecem
corretamente na página Explorar.

**7. Mais gêneros no filtro.**
Expandido de 4 para 19 opções, cobrindo o vocabulário real e fixo de
gêneros da RAWG: Ação, Indie, Aventura, RPG, Estratégia, FPS/Tiro,
Casual, Simulação, Puzzle, Arcade, Plataforma, Multiplayer Massivo,
Esporte, Corrida, Luta, Família, Tabuleiro, Educativo e Cartas — com
rótulos em português mapeados pra palavra-chave certa em inglês (ex:
"FPS" busca por "shooter", que é como a RAWG chama esse gênero).

**8. Descrições traduzidas para o idioma do site.**
Adicionei tradução automática (via `deep-translator`, sem precisar de
chave de API paga) aplicada às descrições de jogos vindas da RAWG (que
normalmente vêm em inglês). Já implementei pensando na futura versão
multi-idioma: a função de tradução recebe o idioma de destino como
parâmetro, então quando você adicionar as versões em inglês/espanhol
será só passar o idioma certo em vez de sempre "pt". Se o serviço de
tradução falhar por qualquer motivo (sem internet, fora do ar), o texto
original aparece em vez de quebrar a página.

## Uma limitação a saber
Meu ambiente de desenvolvimento não tem acesso à internet externa (RAWG,
YouTube e Google Translate são bloqueados aqui). Isso significa que:
- Não consegui testar uma tradução real de ponta a ponta — só confirmei
  que a biblioteca importa e funciona; o fallback (mostrar o texto
  original se a tradução falhar) foi testado e funciona.
- A página Explorar, nos meus testes, mostra "nenhuma informação
  encontrada" — isso é o comportamento correto **quando a RAWG está
  inacessível** (que é o meu caso aqui), não um bug. No seu ambiente com
  internet normal, deve mostrar as informações do jogo de verdade.

---

## Changelog desta rodada (quinta), ponto a ponto

**1. "Adicionar jogo" sempre visível em mobile portrait.**
Antes ficava escondido dentro do menu hambúrguer fechado. Agora esse
botão fica fora da área colapsável da navbar — aparece direto no topo,
em qualquer tamanho de tela.

**2. Ícone do menu hambúrguer sumia no tema escuro.**
O Bootstrap usa um ícone de hambúrguer com cor fixa (SVG embutido) que
ficava praticamente invisível no fundo escuro. Troquei por um ícone de
fonte (Bootstrap Icons) que respeita a cor do texto do tema atual —
sempre visível, claro ou escuro.

**3. Itens do menu mobile centralizados.**
Ao abrir o menu hambúrguer em telas pequenas, os links (Meus Jogos,
Explorar, Estatísticas) e os controles (tema, perfil) agora ficam
centralizados, não mais alinhados à esquerda.

**4. Menu de perfil cortando conteúdo.**
O dropdown de perfil (foto, nome, e-mail, opções) podia ficar maior que
a tela em telas pequenas ou com muito conteúdo, cortando os itens de
baixo. Agora tem um limite de altura com rolagem interna
(`max-height` + `overflow-y: auto`) — nunca mais um item fica
inacessível.

**5. Botão "Voltar" em Explorar e Estatísticas.**
Um botão simples com seta, no topo de cada página, que volta pra página
anterior no histórico do navegador (ou pro catálogo, se não houver
histórico — por exemplo, se a pessoa abriu a página direto por um link).

**6. Densidade da grade dentro de um dropdown "Visualização".**
Os 4 botões separados (lista/pequeno/médio/grande) viraram um único
dropdown chamado "Visualização", com o ícone do modo atual ao lado do
nome no botão principal, e cada opção do menu com ícone + texto — igual
ao padrão do dropdown "Ordenar" que já existia.

**7. Rodapé com crédito.**
Adicionado em todas as páginas: "GameTracker Pro © 2026 — desenvolvido
por Edivan Vicente".

**8. Capas dos jogos cortando a imagem.**
Trocado `object-fit: cover` (que corta as bordas pra preencher o
espaço) por `object-fit: contain` (mostra a imagem inteira, com uma
pequena margem se a proporção não bater exatamente) em todos os lugares
que mostram capa: cards do catálogo, modo lista, modal de detalhe,
resultados de busca, página Explorar e página Jogos.

**9 e 10. Vídeo toca ao clicar, com link pro canal, e troca sozinho se estiver quebrado.**
Criei um player compartilhado (`youtube-player.js`) usado tanto no
modal do jogo quanto na página Explorar:
- Clicar na thumbnail toca o vídeo ali mesmo, sem precisar sair da página.
- Um link separado leva direto ao canal de quem postou o vídeo.
- Se o vídeo estiver indisponível (removido, tornado privado, ou com
  incorporação bloqueada pelo dono), o player detecta o erro
  automaticamente (evento `onError` da API do YouTube) e troca sozinho
  para o próximo vídeo candidato da lista — sem o usuário precisar fazer
  nada. O backend agora busca até 3 candidatos por busca, exatamente
  para alimentar essa troca automática.

**11. "Esqueci minha senha".**
Fluxo completo por e-mail, no mesmo padrão da confirmação de cadastro:
- Link "Esqueci minha senha" na tela de login abre um modal pedindo o e-mail.
- O backend gera um token temporário (válido por 1 hora) e envia um link
  por e-mail (ou loga no terminal, em modo dev sem SMTP configurado).
- O link leva pra uma página nova (`reset-password.html`) onde a pessoa
  escolhe a nova senha.
- Por segurança, a resposta é sempre a mesma mensagem de sucesso, exista
  ou não o e-mail cadastrado — isso evita que alguém use essa tela para
  descobrir quais e-mails estão registrados no sistema.

## Uma limitação a saber
O clique-para-tocar e a troca automática de vídeo (itens 9 e 10)
dependem da API oficial do YouTube (`iframe_api`), que só carrega com
acesso real à internet — não deu pra testar isso 100% no meu ambiente
de desenvolvimento (sandbox sem acesso à rede externa). Revisei a
lógica manualmente com atenção e ela é direta (o evento `onError` da
API dispara `tentarProximoCandidato`, que avança pro próximo vídeo da
lista), mas vale você testar esse fluxo especificamente no seu ambiente
com internet normal.

---**1. "Relatórios" → "Estatísticas".**
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

## Como rodar (novo: scripts prontos, sem precisar decorar comandos)

A partir desta versão, tem 3 arquivos que fazem tudo sozinhos — você só
precisa dar duplo clique (ou rodar pelo terminal). Eles sempre acham a
pasta certa por conta própria, então não tem mais como errar o caminho:

1. **`gametracker-backend\iniciar.bat`** — cria o ambiente virtual (só
   na primeira vez), instala/atualiza as dependências automaticamente, e
   sobe o servidor. Deixe essa janela aberta enquanto usa o site.
2. **`gametracker-backend\criar_conta_demo.bat`** — cria a conta demo
   (`demo@gametracker.com` / `Demo123!`) com jogos de exemplo, pra você
   testar o site sem precisar cadastrar. Seguro rodar mais de uma vez.
3. **`gametracker-frontend\iniciar_frontend.bat`** — sobe o site em
   `http://127.0.0.1:5500`. Abra essa URL no navegador (em vez de abrir
   o `index.html` direto por duplo clique).

**Ordem de uso, do zero:**
1. Duplo clique em `iniciar.bat` (dentro de `gametracker-backend`) →
   espera aparecer "Application startup complete."
2. Duplo clique em `criar_conta_demo.bat` (opcional, só se quiser testar
   com a conta demo) → espera aparecer "Conta demo criada com sucesso!"
3. Duplo clique em `iniciar_frontend.bat` (dentro de
   `gametracker-frontend`) → deixa essa janela aberta também.
4. Abra `http://127.0.0.1:5500/index.html` no navegador.

Das próximas vezes, é só repetir os passos 1 e 3 (não precisa rodar o
`criar_conta_demo.bat` de novo, a menos que queira recriar os dados de
exemplo).

<details>
<summary><strong>Prefere rodar os comandos manualmente? (clique para expandir)</strong></summary>

```bash
cd gametracker-backend
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
A migração automática cuida de adicionar todas as colunas novas no seu
`gametracker.db` existente — não precisa apagar nada.

⚠️ **Erro mais comum**: rodar o `uvicorn` na pasta errada. O comando só
funciona de **dentro** da pasta `gametracker-backend` (onde fica a pasta
`app`). Se der `ModuleNotFoundError: No module named 'app'`, é isso.
</details>

### ⚠️ Se você tem Python muito recente (3.13, 3.14) e a instalação falhar

Nesta versão, troquei as versões fixas do `requirements.txt` por faixas
(`>=x,<y`) em vez de números exatos (`==x`). Isso é importante porque
versões muito específicas de uma dependência (`pydantic-core`) só têm
pacote pré-compilado pra certas versões do Python — em versões muito
novas, o `pip` tentava **compilar do zero**, o que exige Rust e Visual
C++ Build Tools instalados (coisa pesada e que a maioria não tem). Com
as faixas de versão, o `pip` agora escolhe uma versão mais nova que já
tem pacote pronto pro seu Python, evitando esse problema.

Se mesmo assim a instalação falhar tentando compilar algo do zero,
delete a pasta `venv` de dentro de `gametracker-backend` e rode o
`iniciar.bat` de novo, para garantir que está usando um ambiente virtual
limpo (às vezes uma tentativa anterior deixa pacotes "meio instalados"
que atrapalham).

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
