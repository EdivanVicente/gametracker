
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

const GT_PLATFORM_ID_FIELDS = [
    ['psn_id', 'PlayStation Network', 'bi-playstation'],
    ['steam_id', 'Steam', 'bi-steam'],
    ['xbox_gamertag', 'Xbox', 'bi-xbox'],
    ['nintendo_switch_id', 'Nintendo Switch', 'bi-nintendo-switch'],
    ['nintendo_network_id', 'Nintendo Network', 'bi-controller'],
    ['friend_code_3ds', '3DS', 'bi-controller'],
    ['wii_friend_code', 'Wii', 'bi-controller'],
    ['ea_app_id', 'EA App', 'bi-controller'],
    ['ubisoft_connect', 'Ubisoft Connect', 'bi-controller'],
    ['discord', 'Discord', 'bi-discord'],
    ['twitch', 'Twitch', 'bi-twitch'],
    ['instagram', 'Instagram', 'bi-instagram'],
    ['x_handle', 'X (Twitter)', 'bi-twitter-x'],
];

let _perfilPublicoAtual = null; // cache do último perfil aberto, usado pelo filtro de jogos

function renderizarPerfilPublico(p) {
    _perfilPublicoAtual = p;
    const body = document.getElementById('public-profile-body');

    const idsPreenchidos = GT_PLATFORM_ID_FIELDS.filter(([campo]) => p[campo]);

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
                <div id="public-followers-trigger" role="button"><div class="fw-bold">${p.followers_count}</div><div class="text-white-50 small">${GT_I18N.t('community.followers')}</div></div>
                <div id="public-following-trigger" role="button"><div class="fw-bold">${p.following_count}</div><div class="text-white-50 small">${GT_I18N.t('community.following')}</div></div>
            </div>

            ${p.is_self ? '' : `
                <button type="button" class="btn ${p.is_following ? 'btn-gt-outline' : 'btn-gt-primary'} btn-sm" id="btn-toggle-follow" data-user-id="${p.id}" data-following="${p.is_following}">
                    <i class="bi ${p.is_following ? 'bi-person-dash' : 'bi-person-plus'} me-1"></i>
                    <span>${p.is_following ? GT_I18N.t('community.unfollow') : GT_I18N.t('community.follow')}</span>
                </button>`}

            ${idsPreenchidos.length > 0 ? `
                <div class="d-flex flex-wrap justify-content-center gap-2 mt-3">
                    ${idsPreenchidos.map(([campo, label, icone]) => `
                        <span class="badge text-bg-secondary d-inline-flex align-items-center gap-1" style="font-weight: 400;">
                            <i class="bi ${icone}"></i> ${label}: ${escapeHtml(p[campo])}
                        </span>`).join('')}
                </div>` : ''}
        </div>

        <hr class="border-secondary">

        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
            <input type="text" class="form-control form-control-sm flex-fill" style="min-width: 160px;" id="public-profile-search"
                   placeholder="${GT_I18N.t('community.searchInLibrary')}">
            <select class="form-select form-select-sm flex-shrink-0" style="max-width: 160px;" id="public-profile-status-filter">
                <option value="">${GT_I18N.t('toolbar.status')}</option>
                <option value="playing">${GT_I18N.t('status.playing')}</option>
                <option value="finished">${GT_I18N.t('status.finished')}</option>
            </select>
            <div class="dropdown flex-shrink-0">
                <button class="btn btn-gt-outline btn-sm d-flex align-items-center gap-2" type="button"
                        id="public-view-mode-btn" data-bs-toggle="dropdown" aria-expanded="false" title="${GT_I18N.t('toolbar.viewMode')}">
                    <i class="bi bi-grid-3x2-gap-fill" id="public-view-mode-icon"></i>
                    <span class="d-none d-sm-inline small">${GT_I18N.t('toolbar.viewMode')}</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li><a class="dropdown-item d-flex align-items-center gap-2" href="#" data-public-view="list"><i class="bi bi-list-ul"></i> ${GT_I18N.t('toolbar.viewList')}</a></li>
                    <li><a class="dropdown-item d-flex align-items-center gap-2" href="#" data-public-view="medium"><i class="bi bi-grid-3x2-gap-fill"></i> ${GT_I18N.t('toolbar.viewMedium')}</a></li>
                    <li><a class="dropdown-item d-flex align-items-center gap-2" href="#" data-public-view="large"><i class="bi bi-grid-1x2-gap-fill"></i> ${GT_I18N.t('toolbar.viewLarge')}</a></li>
                </ul>
            </div>
        </div>

        <div id="public-profile-games-grid" class="row g-3"></div>
    `;

    renderizarGradeJogosPublico(p.games);
    document.getElementById('public-profile-search').addEventListener('input', filtrarJogosPublico);
    document.getElementById('public-profile-status-filter').addEventListener('change', filtrarJogosPublico);
    document.querySelectorAll('[data-public-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            definirModoVisualizacaoPublico(item.getAttribute('data-public-view'));
        });
    });

    const btnFollow = document.getElementById('btn-toggle-follow');
    if (btnFollow) {
        btnFollow.addEventListener('click', () => alternarSeguir(btnFollow));
    }
    document.getElementById('public-followers-trigger')?.addEventListener('click', () => abrirListaSeguidores('followers', p.id));
    document.getElementById('public-following-trigger')?.addEventListener('click', () => abrirListaSeguidores('following', p.id));
}

const CLASSES_POR_MODO_PUBLICO = {
    medium: 'col-6 col-sm-4 col-lg-3',
    large: 'col-12 col-sm-6 col-lg-4',
};
let modoVisualizacaoPublico = localStorage.getItem('gt-view-mode') || 'medium';
if (modoVisualizacaoPublico === 'small') modoVisualizacaoPublico = 'medium';

const ICONE_POR_MODO_PUBLICO = { list: 'bi-list-ul', medium: 'bi-grid-3x2-gap-fill', large: 'bi-grid-1x2-gap-fill' };

function definirModoVisualizacaoPublico(modo) {
    modoVisualizacaoPublico = modo;
    localStorage.setItem('gt-view-mode', modo);
    const icone = document.getElementById('public-view-mode-icon');
    if (icone) icone.className = `bi ${ICONE_POR_MODO_PUBLICO[modo] || ICONE_POR_MODO_PUBLICO.medium}`;
    filtrarJogosPublico();
}

// Grade de jogos SOMENTE LEITURA no perfil público — usa o mesmo seletor de
// visualização (lista/médio/grande) do painel principal. Clicar num jogo abre
// um modal leve e isolado (vídeo, capa, plataforma, resumo) — sem nenhuma
// ação de edição/exclusão/favoritar, sem carregar a complexidade do editor.
function renderizarGradeJogosPublico(jogos) {
    const grid = document.getElementById('public-profile-games-grid');
    if (!grid) return;

    const icone = document.getElementById('public-view-mode-icon');
    if (icone) icone.className = `bi ${ICONE_POR_MODO_PUBLICO[modoVisualizacaoPublico] || ICONE_POR_MODO_PUBLICO.medium}`;

    if (jogos.length === 0) {
        grid.innerHTML = `<p class="text-white-50 small text-center py-4 mb-0">${GT_I18N.t('community.emptyLibrary')}</p>`;
        return;
    }

    if (modoVisualizacaoPublico === 'list') {
        grid.innerHTML = jogos.map((j, idx) => {
            const isPlaying = j.status === 'playing';
            return `
                <div class="col-12">
                    <div class="gt-panel d-flex align-items-center gap-3 p-2" data-game-idx="${idx}" role="button">
                        <div style="width:48px;height:48px;border-radius:6px;overflow:hidden;background-color:var(--gt-surface-raised);flex-shrink:0;">
                            ${j.cover_url ? `<img src="${j.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;">` : ''}
                        </div>
                        <div class="flex-fill min-width-0">
                            <p class="small fw-semibold mb-0 text-truncate">${escapeHtml(j.title)}</p>
                            <p class="text-white-50 mb-0" style="font-size: 0.72rem;">${escapeHtml(j.platform || '—')}</p>
                        </div>
                        <span class="badge ${isPlaying ? 'text-bg-primary' : 'text-bg-success'}" style="font-size: 0.65rem;">
                            ${isPlaying ? GT_I18N.t('status.playing') : GT_I18N.t('status.finished')}
                        </span>
                    </div>
                </div>`;
        }).join('');
    } else {
        const colClass = CLASSES_POR_MODO_PUBLICO[modoVisualizacaoPublico] || CLASSES_POR_MODO_PUBLICO.medium;
        grid.innerHTML = jogos.map((j, idx) => {
            const isPlaying = j.status === 'playing';
            return `
                <div class="${colClass}">
                    <div class="gt-panel h-100 overflow-hidden" style="padding: 0; cursor: pointer;" data-game-idx="${idx}" role="button">
                        <div class="position-relative" style="aspect-ratio: 3/4; background-color: var(--gt-surface-raised);">
                            ${j.cover_url ? `<img src="${j.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;">` : ''}
                            <span class="badge ${isPlaying ? 'text-bg-primary' : 'text-bg-success'} position-absolute top-0 start-0 m-2" style="font-size: 0.65rem;">
                                ${isPlaying ? GT_I18N.t('status.playing') : GT_I18N.t('status.finished')}
                            </span>
                        </div>
                        <div class="p-2">
                            <p class="small fw-semibold mb-1 text-truncate" title="${escapeHtml(j.title)}">${escapeHtml(j.title)}</p>
                            <p class="text-white-50 mb-0" style="font-size: 0.72rem;">
                                ${escapeHtml(j.platform || '—')}${j.genre ? ` · ${escapeHtml(gtTranslateGenre(j.genre))}` : ''}
                            </p>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    grid.querySelectorAll('[data-game-idx]').forEach(el => {
        el.addEventListener('click', () => abrirQuickViewJogo(jogos[parseInt(el.getAttribute('data-game-idx'), 10)]));
    });
}

function filtrarJogosPublico() {
    if (!_perfilPublicoAtual) return;
    const termo = document.getElementById('public-profile-search').value.trim().toLowerCase();
    const status = document.getElementById('public-profile-status-filter').value;

    const filtrados = _perfilPublicoAtual.games.filter(j => {
        const bateNome = !termo || j.title.toLowerCase().includes(termo);
        const bateStatus = !status || j.status === status;
        return bateNome && bateStatus;
    });
    renderizarGradeJogosPublico(filtrados);
}

// Modal estilo Instagram com a lista de seguidores/seguindo de qualquer perfil.
async function abrirListaSeguidores(tipo, userId) {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFollowList'));
    const titulo = document.getElementById('follow-list-title');
    const body = document.getElementById('follow-list-body');

    titulo.textContent = tipo === 'followers' ? GT_I18N.t('community.followers') : GT_I18N.t('community.following');
    body.innerHTML = `<p class="text-white-50 small text-center py-4 mb-0">${GT_I18N.t('common.loading')}</p>`;
    modal.show();

    try {
        const response = await authFetch(`/social/${tipo}/${userId}`);
        if (!response.ok) throw new Error('erro');
        const lista = await response.json();

        if (lista.length === 0) {
            body.innerHTML = `<p class="text-white-50 small text-center py-4 mb-0">${GT_I18N.t('community.emptyFollowList')}</p>`;
            return;
        }

        body.innerHTML = lista.map(u => `
            <div class="d-flex align-items-center gap-2 py-2" data-user-id="${u.id}" role="button">
                <div class="gt-search-avatar">${avatarOuIcone(u.avatar_data, 30)}</div>
                <span class="small">${escapeHtml(u.display_name || GT_I18N.t('community.anonymous'))}</span>
            </div>`).join('');

        body.querySelectorAll('[data-user-id]').forEach(el => {
            el.addEventListener('click', () => {
                bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFollowList')).hide();
                abrirPerfilPublico(el.getAttribute('data-user-id'));
            });
        });
    } catch (error) {
        body.innerHTML = `<p class="text-danger small text-center py-4 mb-0">${GT_I18N.t('community.loadError')}</p>`;
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

// Visualização rápida e leve de um jogo do perfil de terceiros: capa,
// plataforma, resumo da história e vídeo de gameplay. Sem nenhuma ação de
// edição — usa o mesmo endpoint de dados da aba Explorar, mas num modal à parte.
async function abrirQuickViewJogo(jogo) {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalGameQuickView'));
    const titulo = document.getElementById('quickview-title');
    const body = document.getElementById('quickview-body');

    titulo.textContent = jogo.title;
    body.innerHTML = `<p class="text-white-50 small text-center py-4 mb-0">${GT_I18N.t('common.loading')}</p>`;
    modal.show();

    body.innerHTML = `
        <div class="row g-3 mb-3">
            <div class="col-4 col-sm-3">
                <div style="aspect-ratio: 3/4; border-radius: 8px; overflow: hidden; background-color: var(--gt-surface-raised);">
                    ${jogo.cover_url ? `<img src="${jogo.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;">` : ''}
                </div>
            </div>
            <div class="col-8 col-sm-9">
                <p class="small text-white-50 mb-1">${GT_I18N.t('detail.platform')}</p>
                <p class="mb-2">${escapeHtml(jogo.platform || '—')}</p>
                ${jogo.genre ? `<p class="small text-white-50 mb-1">${GT_I18N.t('toolbar.genre')}</p><p class="mb-0">${escapeHtml(gtTranslateGenre(jogo.genre))}</p>` : ''}
            </div>
        </div>
        <p class="small text-white-50 mb-2">${GT_I18N.t('detail.gameplayLabel')}</p>
        <div id="quickview-video-wrapper" class="mb-3">
            <p class="text-white-50 small mb-0">${GT_I18N.t('common.loading')}</p>
        </div>
        <div id="quickview-summary-wrapper" class="d-none">
            <p class="small text-white-50 mb-1">${GT_I18N.t('quickview.summary')}</p>
            <p class="small mb-0" id="quickview-summary"></p>
        </div>
    `;

    try {
        const response = await authFetch(`/explore/gameplay?title=${encodeURIComponent(jogo.title)}&lang=${gtBackendLang()}`);
        const data = await response.json();

        renderizarGameplay(document.getElementById('quickview-video-wrapper'), data.videos || [], jogo.title);

        const resumo = data.game?.description;
        if (resumo) {
            document.getElementById('quickview-summary').textContent = resumo;
            document.getElementById('quickview-summary-wrapper').classList.remove('d-none');
        }
    } catch (error) {
        document.getElementById('quickview-video-wrapper').innerHTML =
            `<p class="text-danger small mb-0">${GT_I18N.t('community.loadError')}</p>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    carregarFeed();
    carregarRanking();
    setupBuscaGlobal();

    const params = new URLSearchParams(window.location.search);
    const profileId = params.get('profile');
    if (profileId) abrirPerfilPublico(profileId);
});

document.addEventListener('gt:langchange', () => {
    carregarFeed();
    carregarRanking();
});
