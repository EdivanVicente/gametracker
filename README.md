# GameTracker Pro — quinta rodada: mobile, player de vídeo, esqueci senha

Onze pedidos desta vez — mobile (portrait), player de vídeo com fallback
automático, e recuperação de senha por e-mail. Tudo testado com
**navegador real automatizado**, incluindo em viewport de celular
(390×844), com screenshots para conferência visual.

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
