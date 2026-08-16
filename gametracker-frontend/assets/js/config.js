/**
 * config.js — ÚNICO lugar do frontend onde a URL do backend é definida.
 *
 * Antes, cada arquivo .js tinha sua própria linha "const API_BASE = 'http://127.0.0.1:8000'"
 * copiada e colada — o que funciona rodando local, mas QUEBRA em produção (ex: Vercel),
 * porque o navegador de quem visita o site não tem nada rodando em 127.0.0.1:8000.
 *
 * Como configurar para produção (Vercel, Netlify, etc.):
 *   1. Suba o backend em algum serviço que rode Python continuamente — Render,
 *      Railway ou Fly.io funcionam bem no plano gratuito (Vercel NÃO é indicado
 *      para o backend: é serverless, não guarda o banco SQLite entre execuções).
 *   2. Copie a URL pública que esse serviço te der (ex: https://gametracker-api.onrender.com)
 *   3. Cole essa URL na constante PRODUCTION_API_BASE abaixo.
 *   4. Suba o conteúdo desta pasta (gametracker-frontend) no Vercel normalmente.
 *
 * Localmente (127.0.0.1 / localhost) isso continua funcionando sem precisar mexer
 * em nada — a detecção abaixo é automática.
 */

const PRODUCTION_API_BASE = 'https://gametracker-lf9z.onrender.com';

const _gtEhAmbienteLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const API_BASE = _gtEhAmbienteLocal ? 'http://127.0.0.1:8000' : PRODUCTION_API_BASE;

// Mantido por compatibilidade — navbar.js historicamente usa esse nome.
const GT_API_BASE = API_BASE;

if (!_gtEhAmbienteLocal && PRODUCTION_API_BASE.includes('SEU-BACKEND-AQUI')) {
    console.warn(
        '[GameTracker Pro] PRODUCTION_API_BASE ainda não foi configurado em assets/js/config.js — ' +
        'o site não vai conseguir falar com o backend até essa URL ser preenchida com o endereço real.'
    );
}
