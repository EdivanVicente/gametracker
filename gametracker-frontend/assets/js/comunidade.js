const API_BASE = 'http://127.0.0.1:8000';

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

function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

function avatarOuIcone(avatarData, size = 36) {
    if (avatarData) {
        return `<img src="${avatarData}" alt="" style="width:100%;height:100%;object-fit:cover;">`;
    }
    return `<i class="bi bi-person text-white-50" style="font-size:${size * 0.5}px;"></i>`;
}

// ============================================================
// FEED — "O que os membros estão jogando"
// ============================================================
async function carregarFeed() {
    const container = document.getElementById('community-feed');
    try {
        const response = await authFetch('/social/feed');
        if (!response.ok) throw new Error('erro');
        const itens = await response.json();

        if (itens.length === 0) {
            container.innerHTML = `<p class="text-white-50 small text-center py-4 mb-0">${GT_I18N.t('community.feedEmpty')}</p>`;
            return;
        }

        container.innerHTML = itens.map(item => {
            const acao = item.action === 'started' ? GT_I18N.t('community.feedStarted') : GT_I18N.t('community.feedFinished');
            const dataFmt = new Date(`${item.at}T00:00:00`).toLocaleDateString();
            const nome = escapeHtml(item.display_name || GT_I18N.t('community.anonymous'));
            return `
                <div class="gt-feed-item">
                    <div class="gt-feed-avatar" data-user-id="${item.user_id}" role="button">${avatarOuIcone(item.avatar_data)}</div>
                    <div class="flex-fill">
                        <p class="mb-0 small">
                            <strong class="gt-feed-user" data-user-id="${item.user_id}" role="button" style="cursor:pointer;">${nome}</strong>
                            ${acao} <strong>${escapeHtml(item.game_title)}</strong>
                        </p>
                        <p class="text-white-50 mb-0" style="font-size: 0.72rem;">${dataFmt}</p>
                    </div>
                    ${item.cover_url ? `<img src="${item.cover_url}" class="gt-feed-cover" alt="">` : ''}
                </div>`;
        }).join('');

        container.querySelectorAll('[data-user-id]').forEach(el => {
            el.addEventListener('click', () => abrirPerfilPublico(el.getAttribute('data-user-id')));
        });
    } catch (error) {
        container.innerHTML = `<p class="text-danger small text-center py-4 mb-0">${GT_I18N.t('community.loadError')}</p>`;
    }
}

// ============================================================
// RANKING — usuários com mais jogos
// ============================================================
async function carregarRanking() {
    const container = document.getElementById('community-ranking');
    try {
        const response = await authFetch('/social/ranking');
        if (!response.ok) throw new Error('erro');
        const itens = await response.json();

        if (itens.length === 0) {
            container.innerHTML = `<p class="text-white-50 small text-center py-4 mb-0">${GT_I18N.t('community.rankingEmpty')}</p>`;
            return;
        }

        container.innerHTML = itens.map((item, idx) => `
            <div class="gt-rank-row" data-user-id="${item.user_id}">
                <span class="gt-mono text-white-50" style="width: 22px;">${idx + 1}º</span>
                <div class="gt-rank-avatar">${avatarOuIcone(item.avatar_data)}</div>
                <span class="flex-fill small fw-semibold">${escapeHtml(item.display_name || GT_I18N.t('community.anonymous'))}</span>
                <span class="gt-mono small text-white-50">${item.games_count} <i class="bi bi-controller"></i></span>
            </div>`).join('');

        container.querySelectorAll('[data-user-id]').forEach(el => {
            el.addEventListener('click', () => abrirPerfilPublico(el.getAttribute('data-user-id')));
        });
    } catch (error) {
        container.innerHTML = `<p class="text-danger small text-center py-4 mb-0">${GT_I18N.t('community.loadError')}</p>`;
    }
}

// ============================================================
// BUSCA GLOBAL — jogos (com nº de jogadores) e usuários
// ============================================================
let _buscaTimeout = null;

function setupBuscaGlobal() {
    const input = document.getElementById('community-search-input');
    input.addEventListener('input', () => {
        clearTimeout(_buscaTimeout);
        const termo = input.value.trim();
        const resultsBox = document.getElementById('community-search-results');
        if (termo.length < 2) {
            resultsBox.classList.add('d-none');
            return;
        }
        _buscaTimeout = setTimeout(() => executarBuscaGlobal(termo), 350);
    });
}

async function executarBuscaGlobal(termo) {
    const resultsBox = document.getElementById('community-search-results');
    resultsBox.classList.remove('d-none');
    resultsBox.innerHTML = `<p class="text-white-50 small mb-0">${GT_I18N.t('common.loading')}</p>`;

    try {
        const response = await authFetch(`/search/?q=${encodeURIComponent(termo)}`);
        if (!response.ok) throw new Error('erro');
        const data = await response.json();

        if (data.games.length === 0 && data.users.length === 0) {
            resultsBox.innerHTML = `<p class="text-white-50 small mb-0">${GT_I18N.t('community.searchEmpty')}</p>`;
            return;
        }

        let html = '';
        if (data.games.length > 0) {
            html += `<p class="small text-white-50 text-uppercase mb-2" style="letter-spacing:0.05em;">${GT_I18N.t('community.searchGames')}</p>`;
            html += data.games.map(g => `
                <div class="gt-search-hit" data-game-players="${g.external_id}">
                    ${g.cover_url ? `<img src="${g.cover_url}" class="gt-feed-cover" alt="">` : '<div class="gt-feed-cover"></div>'}
                    <span class="flex-fill small">${escapeHtml(g.title)}</span>
                    <span class="small text-white-50">${g.players_count} ${GT_I18N.t('community.playersCount')}</span>
                </div>`).join('');
        }
        if (data.users.length > 0) {
            html += `<p class="small text-white-50 text-uppercase mb-2 mt-3" style="letter-spacing:0.05em;">${GT_I18N.t('community.searchUsers')}</p>`;
            html += data.users.map(u => `
                <div class="gt-search-hit" data-user-id="${u.id}">
                    <div class="gt-search-avatar">${avatarOuIcone(u.avatar_data, 30)}</div>
                    <span class="flex-fill small">${escapeHtml(u.display_name || GT_I18N.t('community.anonymous'))}</span>
                    <i class="bi bi-chevron-right text-white-50 small"></i>
                </div>`).join('');
        }
        resultsBox.innerHTML = html;

        resultsBox.querySelectorAll('[data-user-id]').forEach(el => {
            el.addEventListener('click', () => abrirPerfilPublico(el.getAttribute('data-user-id')));
        });
        resultsBox.querySelectorAll('[data-game-players]').forEach(el => {
            el.addEventListener('click', () => mostrarJogadores(el.getAttribute('data-game-players'), el));
        });
    } catch (error) {
        resultsBox.innerHTML = `<p class="text-danger small mb-0">${GT_I18N.t('community.loadError')}</p>`;
    }
}

async function mostrarJogadores(externalId, elementoClicado) {
    let painel = elementoClicado.nextElementSibling;
    if (painel && painel.classList.contains('gt-players-panel')) {
        painel.remove();
        return;
    }
    painel = document.createElement('div');
    painel.className = 'gt-players-panel ps-4 pb-2';
    painel.innerHTML = `<p class="text-white-50 small mb-0">${GT_I18N.t('common.loading')}</p>`;
    elementoClicado.insertAdjacentElement('afterend', painel);

    try {
        const response = await authFetch(`/search/game/${encodeURIComponent(externalId)}/players`);
        const jogadores = await response.json();
        if (jogadores.length === 0) {
            painel.innerHTML = `<p class="text-white-50 small mb-0">${GT_I18N.t('community.noPlayersYet')}</p>`;
            return;
        }
        painel.innerHTML = jogadores.map(u => `
            <span class="badge rounded-pill text-bg-secondary me-1 mb-1" data-user-id="${u.id}" role="button">
                ${escapeHtml(u.display_name || GT_I18N.t('community.anonymous'))}
            </span>`).join('');
        painel.querySelectorAll('[data-user-id]').forEach(el => {
            el.addEventListener('click', () => abrirPerfilPublico(el.getAttribute('data-user-id')));
        });
    } catch (error) {
        painel.innerHTML = `<p class="text-danger small mb-0">${GT_I18N.t('community.loadError')}</p>`;
    }
}

// ============================================================
// PERFIL PÚBLICO (modal somente leitura + seguir/deixar de seguir)
// ============================================================
async function abrirPerfilPublico(userId) {
    const modalEl = document.getElementById('modalPublicProfile');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    const body = document.getElementById('public-profile-body');
    body.innerHTML = `<p class="text-white-50 small text-center py-4 mb-0">${GT_I18N.t('common.loading')}</p>`;
    modal.show();

    try {
        const response = await authFetch(`/social/profile/${userId}`);
        if (response.status === 403) {
            body.innerHTML = `<p class="text-white-50 text-center py-4 mb-0"><i class="bi bi-lock fs-2 d-block mb-2"></i>${GT_I18N.t('community.privateProfile')}</p>`;
            return;
        }
        if (!response.ok) throw new Error('erro');
        const p = await response.json();
        renderizarPerfilPublico(p);
    } catch (error) {
        body.innerHTML = `<p class="text-danger text-center py-4 mb-0">${GT_I18N.t('community.loadError')}</p>`;
    }
}

function renderizarPerfilPublico(p) {
    const body = document.getElementById('public-profile-body');

    const redes = [
        ['psn_id', 'PSN'], ['steam_id', 'Steam'], ['xbox_gamertag', 'Xbox'],
        ['nintendo_switch_id', 'Switch'], ['discord', 'Discord'],
    ].filter(([campo]) => p[campo]);

    const listaJogos = (jogos, vazio) => jogos.length === 0
        ? `<p class="text-white-50 small mb-0">${vazio}</p>`
        : jogos.map(j => `
            <div class="d-flex align-items-center gap-2 mb-2">
                ${j.cover_url ? `<img src="${j.cover_url}" class="gt-feed-cover" alt="">` : '<div class="gt-feed-cover"></div>'}
                <span class="small">${escapeHtml(j.title)}</span>
                <span class="text-white-50 small ms-auto">${escapeHtml(j.platform || '')}</span>
            </div>`).join('');

    body.innerHTML = `
        <div class="text-center mb-3">
            <div class="rounded-circle mx-auto mb-2 overflow-hidden d-flex align-items-center justify-content-center"
                 style="width: 80px; height: 80px; background-color: var(--gt-surface-raised); border: 2px solid var(--gt-border);">
                ${avatarOuIcone(p.avatar_data, 80)}
            </div>
            <h5 class="gt-display mb-0">${escapeHtml(p.display_name || GT_I18N.t('community.anonymous'))}</h5>
            ${p.country ? `<p class="text-white-50 small mb-2"><i class="bi bi-geo-alt"></i> ${escapeHtml(p.country)}</p>` : ''}
            ${p.bio ? `<p class="small mb-2">${escapeHtml(p.bio)}</p>` : ''}

            <div class="d-flex justify-content-center gap-4 my-3">
                <div><div class="fw-bold">${p.games_count}</div><div class="text-white-50 small">${GT_I18N.t('community.games')}</div></div>
                <div><div class="fw-bold">${p.followers_count}</div><div class="text-white-50 small">${GT_I18N.t('community.followers')}</div></div>
                <div><div class="fw-bold">${p.following_count}</div><div class="text-white-50 small">${GT_I18N.t('community.following')}</div></div>
            </div>

            ${p.is_self ? '' : `
                <button type="button" class="btn ${p.is_following ? 'btn-gt-outline' : 'btn-gt-primary'} btn-sm" id="btn-toggle-follow" data-user-id="${p.id}" data-following="${p.is_following}">
                    <i class="bi ${p.is_following ? 'bi-person-dash' : 'bi-person-plus'} me-1"></i>
                    <span>${p.is_following ? GT_I18N.t('community.unfollow') : GT_I18N.t('community.follow')}</span>
                </button>`}

            ${redes.length > 0 ? `
                <div class="d-flex flex-wrap justify-content-center gap-2 mt-3">
                    ${redes.map(([, label]) => `<span class="badge text-bg-secondary">${label}</span>`).join('')}
                </div>` : ''}
        </div>

        <hr class="border-secondary">

        <div class="row g-3">
            <div class="col-12 col-sm-6">
                <p class="small text-white-50 text-uppercase mb-2" style="letter-spacing:0.05em;">${GT_I18N.t('gamesSummary.nowPlaying')}</p>
                ${listaJogos(p.currently_playing, GT_I18N.t('community.nothingPlaying'))}
            </div>
            <div class="col-12 col-sm-6">
                <p class="small text-white-50 text-uppercase mb-2" style="letter-spacing:0.05em;">${GT_I18N.t('community.recentlyFinished')}</p>
                ${listaJogos(p.recently_finished, GT_I18N.t('community.nothingFinished'))}
            </div>
        </div>
    `;

    const btnFollow = document.getElementById('btn-toggle-follow');
    if (btnFollow) {
        btnFollow.addEventListener('click', () => alternarSeguir(btnFollow));
    }
}

async function alternarSeguir(btn) {
    const userId = btn.getAttribute('data-user-id');
    const seguindo = btn.getAttribute('data-following') === 'true';
    btn.disabled = true;
    try {
        const response = await authFetch(`/social/follow/${userId}`, { method: seguindo ? 'DELETE' : 'POST' });
        if (!response.ok) throw new Error('erro');
        const data = await response.json();
        btn.setAttribute('data-following', data.following);
        btn.className = `btn ${data.following ? 'btn-gt-outline' : 'btn-gt-primary'} btn-sm`;
        btn.innerHTML = `<i class="bi ${data.following ? 'bi-person-dash' : 'bi-person-plus'} me-1"></i>
                          <span>${data.following ? GT_I18N.t('community.unfollow') : GT_I18N.t('community.follow')}</span>`;
        carregarFeed(); // o feed pode mudar dependendo de quem você segue agora
    } catch (error) {
        alert(GT_I18N.t('community.loadError'));
    } finally {
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    carregarFeed();
    carregarRanking();
    setupBuscaGlobal();
});

document.addEventListener('gt:langchange', () => {
    carregarFeed();
    carregarRanking();
});
