function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

// Volta para a página anterior no histórico; se não houver histórico
// (ex: usuário chegou direto por um link), cai no dashboard como padrão.
function voltarPagina() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = 'dashboard.html';
    }
}