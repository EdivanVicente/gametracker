const API_BASE = 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', carregarResumoDeJogos);

async function authFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = Object.assign({ 'Authorization': `Bearer ${token}` }, options.headers || {});
    const response = await fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));

    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
        throw new Error('Sessão expirada.');
    }
    return response;
}

function escapeHtml(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function carregarResumoDeJogos() {
    try {
        const response = await authFetch('/games/');
        if (!response.ok) return;

        const jogos = await response.json();

        document.getElementById('games-summary-loading').classList.add('d-none');
        document.getElementById('games-summary-content').classList.remove('d-none');

        // "Jogando agora": entre os jogos com status playing, o mais recentemente criado/tocado.
        const jogando = jogos
            .filter(j => j.status === 'playing')
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

        // "Último finalizado": entre os finalizados, o de end_date mais recente.
        const finalizados = jogos
            .filter(j => j.status === 'finished' && j.end_date)
            .sort((a, b) => new Date(b.end_date) - new Date(a.end_date))[0];

        renderCard('games-current-card', jogando, 'Nenhum jogo em andamento no momento.');
        renderCard('games-last-finished-card', finalizados, 'Você ainda não finalizou nenhum jogo.');
    } catch (error) {
        console.error('Erro ao carregar resumo de jogos:', error);
    }
}

function renderCard(containerId, item, mensagemVazio) {
    const container = document.getElementById(containerId);

    if (!item) {
        container.innerHTML = `
            <div class="gt-panel p-4 text-center">
                <i class="bi bi-controller fs-2 text-white-50 d-block mb-2"></i>
                <p class="text-white-50 small mb-0">${mensagemVazio}</p>
            </div>
        `;
        return;
    }

    const jogo = item.game;

    container.innerHTML = `
        <div class="gt-panel p-3 d-flex gap-3 align-items-center">
            <div class="gt-detail-cover" style="width: 90px; flex-shrink: 0; aspect-ratio: 3/4;">
                ${jogo.cover_url
                    ? `<img src="${jogo.cover_url}" alt="${escapeHtml(jogo.title)}" style="width:100%;height:100%;object-fit:contain;background-color:var(--gt-void);border-radius:0.5rem;">`
                    : '<i class="bi bi-controller"></i>'}
            </div>
            <div>
                <h5 class="mb-1">${escapeHtml(jogo.title)}</h5>
                <p class="small text-white-50 mb-1">${escapeHtml(jogo.genre || '—')}</p>
                <p class="small text-white-50 mb-0">${escapeHtml(item.platform || '—')}</p>
            </div>
        </div>
    `;
}
