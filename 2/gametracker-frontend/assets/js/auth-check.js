// Verifica se o token existe ao carregar a página
const token = localStorage.getItem('token');

// Descobre em qual página o usuário está no momento
const currentPage = window.location.pathname.split('/').pop();

// 1. Se NÃO tem token e NÃO está na página de login, manda pro login
if (!token && currentPage !== 'index.html' && currentPage !== '') {
    window.location.href = 'index.html';
} 
// 2. Se JÁ TEM token e está tentando acessar a página de login, manda direto pro dashboard
else if (token && (currentPage === 'index.html' || currentPage === '')) {
    window.location.href = 'dashboard.html';
}