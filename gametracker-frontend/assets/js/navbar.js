/**
 * Carrega nome e avatar do usuário logado na navbar. Usado em todas as
 * páginas internas (dashboard, explorar, relatórios, conta, games, configurações).
 *
 * Espera encontrar na página:
 *   #navbar-avatar-btn  -> botão/imagem do avatar
 *   #navbar-user-name   -> texto com o nome de exibição
 */
const GT_API_BASE = 'http://127.0.0.1:8000';

async function carregarNavbarUsuario() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${GT_API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) return;
        const user = await response.json();

        const avatarBtn = document.getElementById('navbar-avatar-btn');
        const nameEl = document.getElementById('navbar-user-name');
        const nomeExibido = user.display_name || user.email.split('@')[0];

        if (nameEl) {
            nameEl.textContent = nomeExibido;
        }

        if (avatarBtn && user.avatar_data) {
            avatarBtn.innerHTML = `<img src="${user.avatar_data}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`;
        }
    } catch (error) {
        // Silencioso: a navbar simplesmente mantém os valores padrão.
    }
}

document.addEventListener('DOMContentLoaded', carregarNavbarUsuario);
