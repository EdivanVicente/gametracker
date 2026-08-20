// Verifica se o token existe ao carregar a página
const token = localStorage.getItem('token');

// Descobre em qual página o usuário está no momento
const currentPage = window.location.pathname.split('/').pop();

// A página de login vive na raiz ("/"). Com cleanUrls, o pathname pode vir
// como "" (raiz), "index" (se alguém acessar /index direto) ou "index.html"
// (link antigo/cache) — cobrimos os três casos.
const isLoginPage = currentPage === '' || currentPage === 'index' || currentPage === 'index.html';

// 1. Se NÃO tem token e NÃO está na página de login, manda pro login
if (!token && !isLoginPage) {
    window.location.href = '/';
}
// 2. Se JÁ TEM token e está tentando acessar a página de login, manda direto pro dashboard
else if (token && isLoginPage) {
    window.location.href = 'dashboard';
}