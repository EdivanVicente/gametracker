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
            window.location.href = `comunidade?profile=${userId}`;
        });
        document.getElementById('dropdown-following-trigger')?.addEventListener('click', () => {
            window.location.href = `comunidade?profile=${userId}`;
        });
    } catch (error) {
        // Mesmo se der erro de rede, mostra 0 em vez de deixar "—" pra sempre.
        if (gamesEl) gamesEl.textContent = 0;
        if (followersEl) followersEl.textContent = 0;
        if (followingEl) followingEl.textContent = 0;
    }
}

document.addEventListener('DOMContentLoaded', carregarNavbarUsuario);
document.addEventListener('DOMContentLoaded', inicializarSinoNotificacoes);

// --- Sino de notificações (pedidos de seguir + aceites) ---
// Carrega quando a página abre e sempre que o dropdown é aberto de novo —
// como combinado, não precisa ser "tempo real", só atualizado a cada
// carregamento/interação (evita a complexidade de WebSocket por enquanto).
function inicializarSinoNotificacoes() {
    const token = localStorage.getItem('token');
    if (!token || !document.getElementById('notif-bell-btn')) return;

    atualizarBadgeNotificacoes();

    document.getElementById('notif-bell-btn')?.addEventListener('show.bs.dropdown', carregarListaNotificacoes);
    document.getElementById('notif-mark-all-read')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch(`${GT_API_BASE}/social/notifications/read-all`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        carregarListaNotificacoes();
        atualizarBadgeNotificacoes();
    });
}

async function atualizarBadgeNotificacoes() {
    const token = localStorage.getItem('token');
    const badge = document.getElementById('notif-badge');
    if (!token || !badge) return;
    try {
        const r = await fetch(`${GT_API_BASE}/social/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!r.ok) return;
        const data = await r.json();
        if (data.unread_count > 0) {
            badge.textContent = data.unread_count > 9 ? '9+' : data.unread_count;
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    } catch (error) {
        // Silencioso — o sino simplesmente não mostra contagem se a rede falhar.
    }
}

function _iconePorTipoNotificacao(tipo) {
    if (tipo === 'follow_request') return 'bi-person-plus';
    if (tipo === 'follow_accepted') return 'bi-person-check';
    return 'bi-bell';
}

function _textoNotificacao(n) {
    const nome = n.actor_display_name || (window.GT_I18N ? GT_I18N.t('notif.someone') : 'Alguém');
    if (n.type === 'follow_request') return (window.GT_I18N ? GT_I18N.t('notif.followRequest', { name: nome }) : `${nome} quer te seguir`);
    if (n.type === 'follow_accepted') return (window.GT_I18N ? GT_I18N.t('notif.followAccepted', { name: nome }) : `${nome} aceitou seu pedido para seguir`);
    return '';
}

async function carregarListaNotificacoes() {
    const token = localStorage.getItem('token');
    const lista = document.getElementById('notif-list');
    const vazio = document.getElementById('notif-empty');
    const btnMarcarTodas = document.getElementById('notif-mark-all-read');
    if (!token || !lista) return;

    try {
        const [respNotif, respPedidos] = await Promise.all([
            fetch(`${GT_API_BASE}/social/notifications`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${GT_API_BASE}/social/follow-requests`, { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);
        const notificacoes = respNotif.ok ? await respNotif.json() : [];
        const pedidosPendentes = respPedidos.ok ? await respPedidos.json() : [];
        const idsComPedidoAtivo = new Set(pedidosPendentes.map(p => p.follower_id));

        if (notificacoes.length === 0) {
            vazio.classList.remove('d-none');
            lista.innerHTML = '';
            btnMarcarTodas.classList.add('d-none');
            return;
        }
        vazio.classList.add('d-none');
        const temNaoLida = notificacoes.some(n => !n.is_read);
        btnMarcarTodas.classList.toggle('d-none', !temNaoLida);

        lista.innerHTML = notificacoes.map(n => {
            const avatar = n.actor_avatar_data
                ? `<img src="${n.actor_avatar_data}" alt="">`
                : `<i class="bi bi-person text-white-50"></i>`;
            // Pedido de seguir ainda pendente -> mostra os botões de aceitar/recusar direto aqui.
            const mostrarAcoes = n.type === 'follow_request' && idsComPedidoAtivo.has(n.actor_id);
            const acoes = mostrarAcoes ? `
                <div class="gt-notif-request-actions">
                  <button type="button" class="btn btn-gt-primary btn-sm py-0 px-2" onclick="event.stopPropagation(); responderPedidoDeSeguir(${n.actor_id}, true, this)">
                    <i class="bi bi-check-lg"></i>
                  </button>
                  <button type="button" class="btn btn-gt-outline btn-sm py-0 px-2" onclick="event.stopPropagation(); responderPedidoDeSeguir(${n.actor_id}, false, this)">
                    <i class="bi bi-x-lg"></i>
                  </button>
                </div>` : '';

            return `
            <li class="gt-notif-item ${n.is_read ? '' : 'is-unread'}" data-notif-id="${n.id}" data-actor-id="${n.actor_id ?? ''}">
                <div class="gt-notif-avatar">${avatar}</div>
                <div class="flex-fill" style="min-width: 0;">
                    <p class="small mb-0">${escapeHtmlNotif(_textoNotificacao(n))}</p>
                    <p class="text-white-50 mb-0" style="font-size: 0.7rem;">${new Date(n.created_at).toLocaleDateString()}</p>
                    ${acoes}
                </div>
            </li>`;
        }).join('');
        if (window.GT_I18N) GT_I18N.apply(lista);

        lista.querySelectorAll('.gt-notif-item').forEach((item) => {
            item.addEventListener('click', async () => {
                const notifId = item.dataset.notifId;
                const actorId = item.dataset.actorId;
                await fetch(`${GT_API_BASE}/social/notifications/${notifId}/read`, {
                    method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
                });
                item.classList.remove('is-unread');
                atualizarBadgeNotificacoes();
                if (actorId) window.location.href = `comunidade?profile=${actorId}`;
            });
        });
    } catch (error) {
        // Silencioso — o dropdown só fica vazio se a rede falhar.
    }
}

async function responderPedidoDeSeguir(followerId, aceitar, btnElement) {
    const token = localStorage.getItem('token');
    const item = btnElement.closest('.gt-notif-item');
    btnElement.disabled = true;
    try {
        const url = aceitar
            ? `${GT_API_BASE}/social/follow-requests/${followerId}/accept`
            : `${GT_API_BASE}/social/follow-requests/${followerId}/reject`;
        const r = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
        if (r.ok && item) {
            item.querySelector('.gt-notif-request-actions').innerHTML = `<span class="small text-white-50">${aceitar ? '✓' : '✕'}</span>`;
        }
    } catch (error) {
        btnElement.disabled = false;
    }
}

function escapeHtmlNotif(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
