# Deploy do GameTracker Pro (Vercel + backend)

## Por que o site "subiu" no Vercel mas não funciona

O Vercel hospedou o **frontend** direitinho (é só HTML/CSS/JS estático, ele lida bem com isso).
O problema é que até agora, todo o JavaScript do site tinha a URL do backend **hardcoded** como
`http://127.0.0.1:8000` — que só existe na sua própria máquina. Quando alguém acessa o site pelo
Vercel, o navegador dela tenta falar com `127.0.0.1:8000` **dela mesma**, não com o seu computador,
e não tem nada rodando lá — por isso nada funciona (login, jogos, busca, tudo trava).

Isso já foi corrigido: agora existe um único arquivo, `assets/js/config.js`, que decide
automaticamente qual URL usar (local ou produção). Falta só você preencher a URL de produção nele.

**Importante:** o Vercel não é indicado para hospedar o *backend* (FastAPI + banco SQLite) — ele é
serverless, ou seja, cada requisição pode rodar num container novo e descartável, então o banco
SQLite não se mantém salvo entre uma chamada e outra. O backend precisa de um serviço que rode o
processo continuamente. Por isso a divisão abaixo: **frontend no Vercel, backend em outro lugar**.

---

## Passo 1 — Colocar o backend no ar

Recomendado: **[Render](https://render.com)** (tem plano gratuito, é o mais simples pra um projeto
FastAPI + SQLite). Railway ou Fly.io também funcionam de forma parecida.

1. Crie uma conta no Render e clique em **New > Web Service**.
2. Conecte o repositório (ou faça upload manual da pasta `gametracker-backend`).
3. Configure:
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment:** Python 3
4. Em **Environment Variables**, adicione as mesmas chaves do seu `.env` local:
   - `SECRET_KEY` (gere uma nova, não reuse a de desenvolvimento)
   - `RAWG_API_KEY`
   - `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` (se configurado)
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (pra e-mails funcionarem de verdade em produção — sem isso, os links de confirmação só aparecem no log do servidor, ninguém recebe e-mail)
   - `FRONTEND_BASE_URL` → a URL que o Vercel vai te dar (passo 2)
   - `CORS_ALLOWED_ORIGINS` → a mesma URL do Vercel
5. Sobre o banco de dados: o **plano gratuito do Render não garante disco persistente** — o arquivo
   `gametracker.db` pode ser apagado a cada novo deploy. Pra produção de verdade, troque
   `DATABASE_URL` por um Postgres gratuito (ex: [Neon](https://neon.tech) ou [Supabase](https://supabase.com))
   — a aplicação já usa SQLAlchemy, então basta trocar a URL, nenhum código muda.
6. Depois do deploy, copie a URL pública que o Render te der (ex: `https://gametracker-api.onrender.com`).

## Passo 2 — Configurar o frontend com a URL do backend

1. Abra `gametracker-frontend/assets/js/config.js`.
2. Troque esta linha:
   ```js
   const PRODUCTION_API_BASE = 'https://SEU-BACKEND-AQUI.onrender.com';
   ```
   pela URL real que você copiou do Render no passo anterior.
3. Suba essa pasta pro Vercel de novo (novo deploy) — ou, se o Vercel já está conectado ao seu
   repositório Git, é só dar commit + push dessa alteração que ele redeploya sozinho.

## Passo 3 — Fechar o círculo

1. Copie a URL que o Vercel te deu (ex: `https://gametracker-pro.vercel.app`).
2. Volte no Render (ou onde subiu o backend) e preencha `FRONTEND_BASE_URL` e
   `CORS_ALLOWED_ORIGINS` com essa URL exata.
3. Reinicie o backend (o Render faz isso sozinho ao salvar as variáveis de ambiente).

## Checklist final

- [ ] Backend no ar (Render/Railway/Fly.io), com todas as variáveis de ambiente preenchidas
- [ ] `PRODUCTION_API_BASE` em `config.js` apontando pro backend
- [ ] `FRONTEND_BASE_URL` e `CORS_ALLOWED_ORIGINS` no backend apontando pro Vercel
- [ ] Banco de dados em algo persistente (Postgres gratuito, se for usar por mais que alguns dias)
- [ ] SMTP configurado (senão os e-mails de confirmação/redefinição de senha não chegam a ninguém)
- [ ] Testar cadastro → confirmação de e-mail → login → adicionar jogo, tudo pela URL pública

Se qualquer passo desses ficar sem preencher, o site vai continuar "subido mas quebrado" — geralmente
o sintoma é a tela de login carregar normalmente (porque é só HTML/CSS) mas login, busca e qualquer
ação que fale com o backend dar "Erro de conexão com o servidor".
