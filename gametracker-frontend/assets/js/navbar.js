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
        const dropdownAvatar = document.getElementById('dropdown-avatar');
        const dropdownName = document.getElementById('dropdown-user-name');
        const dropdownEmail = document.getElementById('dropdown-user-email');
        const nomeExibido = user.display_name || user.email.split('@')[0];

        if (nameEl) {
            nameEl.textContent = nomeExibido;
        }
        if (dropdownName) {
            dropdownName.textContent = nomeExibido;
        }
        if (dropdownEmail) {
            dropdownEmail.textContent = user.email;
        }

        if (user.avatar_data) {
            if (avatarBtn) {
                avatarBtn.innerHTML = `<img src="${user.avatar_data}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`;
            }
            if (dropdownAvatar) {
                dropdownAvatar.innerHTML = `<img src="${user.avatar_data}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`;
            }
        }
    } catch (error) {
        // Silencioso: a navbar simplesmente mantém os valores padrão.
    }
}

document.addEventListener('DOMContentLoaded', carregarNavbarUsuario);
