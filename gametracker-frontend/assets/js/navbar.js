/**
 * Carrega nome e avatar do usuário logado na navbar. Usado em todas as
 * páginas internas (dashboard, explorar, relatórios, conta, games, configurações).
 *
 * Espera encontrar na página:
 *   #navbar-avatar-btn  -> botão/imagem do avatar
 *   #navbar-user-name   -> texto com o nome de exibição
 */

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

        carregarEstatisticasNavbar(user.id, token);
    } catch (error) {
        // Silencioso: a navbar simplesmente mantém os valores padrão.
    }
}

// Games/seguidores/seguindo no dropdown do perfil (abaixo do e-mail). Clicar em
// "Seguidores"/"Seguindo" leva pro perfil público (aba Comunidade), onde dá
// pra ver a lista completa de quem segue/é seguido, igual Instagram.
async function carregarEstatisticasNavbar(userId, token) {
    const gamesEl = document.getElementById('dropdown-games-count');
    const followersEl = document.getElementById('dropdown-followers-count');
    const followingEl = document.getElementById('dropdown-following-count');

    try {
        const response = await fetch(`${GT_API_BASE}/social/profile/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const p = response.ok ? await response.json() : {};

        if (gamesEl) gamesEl.textContent = p.games_count ?? 0;
        if (followersEl) followersEl.textContent = p.followers_count ?? 0;
        if (followingEl) followingEl.textContent = p.following_count ?? 0;

        document.getElementById('dropdown-followers-trigger')?.addEventListener('click', () => {
            window.location.href = `comunidade.html?profile=${userId}`;
        });
        document.getElementById('dropdown-following-trigger')?.addEventListener('click', () => {
            window.location.href = `comunidade.html?profile=${userId}`;
        });
    } catch (error) {
        // Mesmo se der erro de rede, mostra 0 em vez de deixar "—" pra sempre.
        if (gamesEl) gamesEl.textContent = 0;
        if (followersEl) followersEl.textContent = 0;
        if (followingEl) followingEl.textContent = 0;
    }
}

document.addEventListener('DOMContentLoaded', carregarNavbarUsuario);
