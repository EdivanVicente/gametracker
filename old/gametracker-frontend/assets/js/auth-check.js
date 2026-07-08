// Verifica se o token existe ao carregar a página
const token = localStorage.getItem('token');

if (!token) {
    // Se não houver token, manda de volta pro login
    window.location.href = 'index.html';
}