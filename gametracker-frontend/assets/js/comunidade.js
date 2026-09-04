
async function authFetch(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = Object.assign({ 'Authorization': `Bearer ${token}` }, options.headers || {});
    const response = await fetch(`${API_BASE}${path}`, Object.assign({}, options, { headers }));
    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/';
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
                <div><div class="fw-bold">${p.games_count ?? 0}</div><div class="text-white-50 small">${GT_I18N.t('community.games')}</div></div>
                <div id="public-followers-trigger" role="button"><div class="fw-bold">${p.followers_count ?? 0}</div><div class="text-white-50 small">${GT_I18N.t('community.followers')}</div></div>
                <div id="public-following-trigger" role="button"><div class="fw-bold">${p.following_count ?? 0}</div><div class="text-white-50 small">${GT_I18N.t('community.following')}</div></div>
            </div>

            ${p.is_self ? '' : `
                <div class="d-flex justify-content-center align-items-center gap-2">
                    <button type="button" class="btn ${_classeBotaoSeguir(p.follow_status)} btn-sm" id="btn-toggle-follow" data-user-id="${p.id}" data-follow-status="${p.follow_status}">
                        <i class="bi ${_iconeBotaoSeguir(p.follow_status)} me-1"></i>
                        <span>${_textoBotaoSeguir(p.follow_status)}</span>
                    </button>
                    ${p.follow_status === 'accepted' ? `
                        <button type="button" class="btn btn-gt-outline btn-sm ${p.is_favorite_friend ? 'is-active' : ''}" id="btn-toggle-favorite-friend"
                                data-user-id="${p.id}" data-favorite="${p.is_favorite_friend}" title="${GT_I18N.t('community.favoriteFriend')}">
                            <i class="bi ${p.is_favorite_friend ? 'bi-star-fill' : 'bi-star'}"></i>
                        </button>` : ''}
                </div>`}

            ${idsPreenchidos.length > 0 ? `
                <div class="d-flex flex-wrap justify-content-center gap-2 mt-3">
                    ${idsPreenchidos.map(([campo, label, icone]) => `
                        <span class="badge text-bg-secondary d-inline-flex align-items-center gap-1" style="font-weight: 400;">
                            <i class="bi ${icone}"></i> ${label}: ${escapeHtml(p[campo])}
                        </span>`).join('')}
                </div>` : ''}
        </div>

        <hr class="border-secondary">

        <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
            <input type="text" class="form-control form-control-sm flex-fill" style="min-width: 0;" id="public-profile-search"
                   placeholder="${GT_I18N.t('community.searchInLibrary', { name: p.display_name || GT_I18N.t('community.anonymous') })}">
            <select class="form-select form-select-sm flex-shrink-0" style="width: auto;" id="public-profile-status-filter">
                <option value="">${GT_I18N.t('toolbar.status')}</option>
                <option value="wish_to_play">${GT_I18N.t('status.wishToPlay')}</option>
                <option value="playing">${GT_I18N.t('status.playing')}</option>
                <option value="finished">${GT_I18N.t('status.finished')}</option>
            </select>
            <div class="dropdown flex-shrink-0">
                <button class="btn btn-gt-outline btn-sm d-flex align-items-center" type="button"
                        id="public-view-mode-btn" data-bs-toggle="dropdown" aria-expanded="false" title="${GT_I18N.t('toolbar.viewMode')}">
                    <i class="bi bi-grid-3x2-gap-fill" id="public-view-mode-icon"></i>
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
    const btnFavorite = document.getElementById('btn-toggle-favorite-friend');
    if (btnFavorite) {
        btnFavorite.addEventListener('click', () => alternarFavoritoAmigo(btnFavorite));
    }
    document.getElementById('public-followers-trigger')?.addEventListener('click', () => abrirListaSeguidores('followers', p.id));
    document.getElementById('public-following-trigger')?.addEventListener('click', () => abrirListaSeguidores('following', p.id));
}

const CLASSES_POR_MODO_PUBLICO = {
    medium: 'col-6 col-sm-4 col-lg-3',
    large: 'col-12 col-sm-6 col-lg-4',
};let modoVisualizacaoPublico = localStorage.getItem('gt-view-mode') || 'medium';
if (modoVisualizacaoPublico === 'small') modoVisualizacaoPublico = 'medium';

const ICONE_POR_MODO_PUBLICO = { list: 'bi-list-ul', medium: 'bi-grid-3x2-gap-fill', large: 'bi-grid-1x2-gap-fill' };

function definirModoVisualizacaoPublico(modo) {
    modoVisualizacaoPublico = modo;
    localStorage.setItem('gt-view-mode', modo);
    const icone = document.getElementById('public-view-mode-icon');
    if (icone) icone.className = `bi ${ICONE_POR_MODO_PUBLICO[modo] || ICONE_POR_MODO_PUBLICO.medium}`;
    filtrarJogosPublico();
}

// Traduz o status de um jogo do amigo pra {classe, texto} do badge — mesma
// ideia de 3 estados usada em Meus Jogos (dashboard.js), pra manter consistência.
function _badgeStatusPublico(statusValor) {
    if (statusValor === 'wish_to_play') return { classe: 'text-bg-info', texto: GT_I18N.t('status.wishToPlay') };
    if (statusValor === 'playing') return { classe: 'text-bg-primary', texto: GT_I18N.t('status.playing') };
    return { classe: 'text-bg-success', texto: GT_I18N.t('status.finished') };
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
            const badge = _badgeStatusPublico(j.status);
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
                        <span class="badge ${badge.classe}" style="font-size: 0.65rem;">${badge.texto}</span>
                    </div>
                </div>`;
        }).join('');
    } else {
        const colClass = CLASSES_POR_MODO_PUBLICO[modoVisualizacaoPublico] || CLASSES_POR_MODO_PUBLICO.medium;
        grid.innerHTML = jogos.map((j, idx) => {
            const badge = _badgeStatusPublico(j.status);
            return `
                <div class="${colClass}">
                    <div class="gt-panel h-100 overflow-hidden" style="padding: 0; cursor: pointer;" data-game-idx="${idx}" role="button">
                        <div class="position-relative" style="aspect-ratio: 3/4; background-color: var(--gt-surface-raised);">
                            ${j.cover_url ? `<img src="${j.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;">` : ''}
                            <span class="badge ${badge.classe} position-absolute top-0 start-0 m-2" style="font-size: 0.65rem;">${badge.texto}</span>
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

// O botão de seguir tem 3 estados visuais: "Seguir" (nunca pediu ou foi
// recusado/cancelado), "Solicitação enviada" (pendente, aguardando resposta
// do outro lado) e "Seguindo" (aceito). Centralizado aqui pra não duplicar
// essa lógica nos dois lugares que desenham o botão (perfil + resposta do clique).
function _textoBotaoSeguir(followStatus) {
    if (followStatus === 'accepted') return GT_I18N.t('community.unfollow');
    if (followStatus === 'pending') return GT_I18N.t('community.requestSent');
    return GT_I18N.t('community.follow');
}
function _iconeBotaoSeguir(followStatus) {
    if (followStatus === 'accepted') return 'bi-person-dash';
    if (followStatus === 'pending') return 'bi-hourglass-split';
    return 'bi-person-plus';
}
function _classeBotaoSeguir(followStatus) {
    return followStatus === 'accepted' || followStatus === 'pending' ? 'btn-gt-outline' : 'btn-gt-primary';
}

async function alternarSeguir(btn) {
    const userId = btn.getAttribute('data-user-id');
    const statusAtual = btn.getAttribute('data-follow-status');
    // "Seguir" ou "Solicitação enviada" (pendente) -> clicar de novo CANCELA o
    // pedido. Só "Seguindo" (aceito) -> clicar DEIXA de seguir. Os dois casos
    // usam o mesmo endpoint DELETE (cancelar um pedido e deixar de seguir são,
    // na prática, a mesma ação: apagar o vínculo).
    const vaiRemover = statusAtual === 'accepted' || statusAtual === 'pending';
    btn.disabled = true;
    try {
        const response = await authFetch(`/social/follow/${userId}`, { method: vaiRemover ? 'DELETE' : 'POST' });
        if (!response.ok) throw new Error('erro');
        const data = await response.json();
        btn.setAttribute('data-follow-status', data.follow_status);
        btn.className = `btn ${_classeBotaoSeguir(data.follow_status)} btn-sm`;
        btn.innerHTML = `<i class="bi ${_iconeBotaoSeguir(data.follow_status)} me-1"></i>
                          <span>${_textoBotaoSeguir(data.follow_status)}</span>`;
        carregarFeed(); // o feed pode mudar dependendo de quem você segue agora

        // Se deixou de seguir, o botão de favoritar não faz mais sentido — some.
        const btnFavorite = document.getElementById('btn-toggle-favorite-friend');
        if (btnFavorite && data.follow_status !== 'accepted') {
            btnFavorite.remove();
        }
    } catch (error) {
        alert(GT_I18N.t('community.loadError'));
    } finally {
        btn.disabled = false;
    }
}

async function alternarFavoritoAmigo(btn) {
    const userId = btn.getAttribute('data-user-id');
    const jaFavorito = btn.getAttribute('data-favorite') === 'true';
    btn.disabled = true;
    try {
        const response = await authFetch(`/social/follow/${userId}/favorite`, { method: jaFavorito ? 'DELETE' : 'POST' });
        if (!response.ok) throw new Error('erro');
        const novoValor = !jaFavorito;
        btn.setAttribute('data-favorite', novoValor);
        btn.classList.toggle('is-active', novoValor);
        btn.querySelector('i').className = novoValor ? 'bi bi-star-fill' : 'bi bi-star';
        carregarFeed(); // amigos favoritos vêm primeiro no feed
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

        <div id="quickview-friend-stats" class="mb-3"></div>

        <div id="quickview-add-wrapper" class="mb-3"></div>

        <p class="small text-white-50 mb-2">${GT_I18N.t('detail.gameplayLabel')}</p>
        <div id="quickview-video-wrapper" class="mb-3">
            <p class="text-white-50 small mb-0">${GT_I18N.t('common.loading')}</p>
        </div>
        <div id="quickview-summary-wrapper" class="d-none">
            <p class="small text-white-50 mb-1">${GT_I18N.t('quickview.summary')}</p>
            <p class="small mb-0" id="quickview-summary"></p>
        </div>
    `;

    carregarStatsAmigoNoJogo(jogo);

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

// Notas + sessões + tempo total que o AMIGO registrou nesse jogo (item 4.2),
// mais o botão de copiar pra própria biblioteca usando o mesmo fluxo
// inteligente de status do cadastro normal (item 2).
function _minutosParaHHMMQuickview(min) {
    if (min === null || min === undefined) return '';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}

async function carregarStatsAmigoNoJogo(jogo) {
    const statsWrapper = document.getElementById('quickview-friend-stats');
    const addWrapper = document.getElementById('quickview-add-wrapper');
    if (!_perfilPublicoAtual || !jogo.id) return;

    try {
        const response = await authFetch(`/social/profile/${_perfilPublicoAtual.id}/games/${jogo.id}`);
        if (!response.ok) return;
        const d = await response.json();

        const notas = [
            ['Grf', d.graphics_score], ['Som', d.sound_score], ['Jog', d.gameplay_score], ['Dif', d.difficulty_score],
        ].filter(([, v]) => v !== null && v !== undefined);

        statsWrapper.innerHTML = `
            <div class="gt-panel p-2 px-3">
              ${notas.length ? `<div class="d-flex flex-wrap gap-3 mb-2">
                  ${notas.map(([label, v]) => `<span class="small">${label} <span class="fw-semibold">${v}</span>/5</span>`).join('')}
                </div>` : ''}
              <div class="d-flex flex-wrap gap-3 small text-white-50">
                <span><i class="bi bi-arrow-repeat me-1"></i>${d.play_count} ${GT_I18N.t('detail.playCountLabel')}</span>
                ${d.hours_played !== null ? `<span><i class="bi bi-hourglass-split me-1"></i>${_minutosParaHHMMQuickview(Math.round(d.hours_played * 60))} ${GT_I18N.t('detail.hoursPlayed').toLowerCase()}</span>` : ''}
              </div>
              ${d.sessions.length ? `
                <ul class="list-unstyled small text-white-50 mb-0 mt-2 pt-2" style="border-top: 1px solid var(--gt-border);">
                  ${d.sessions.slice(0, 5).map(s => {
                      const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString();
                      const periodo = s.finished_at && s.finished_at !== s.started_at ? `${fmt(s.started_at)} → ${fmt(s.finished_at)}` : fmt(s.started_at);
                      const tempo = s.duration_minutes ? ` · ${_minutosParaHHMMQuickview(s.duration_minutes)}` : '';
                      return `<li>${periodo}${tempo}</li>`;
                  }).join('')}
                </ul>` : ''}
            </div>`;

        addWrapper.innerHTML = `
            <button type="button" class="btn btn-gt-outline btn-sm w-100" id="quickview-add-btn" data-i18n="community.addToMyLibrary">Adicionar à minha biblioteca</button>
            <div class="d-none mt-2" id="quickview-add-form"></div>`;
        if (window.GT_I18N) GT_I18N.apply(addWrapper);
        document.getElementById('quickview-add-btn').addEventListener('click', () => prepararAdicaoDeAmigo(jogo.external_id));
    } catch (error) {
        // Silencioso — se não der pra carregar as estatísticas, o resto do quick view continua funcionando.
    }
}

// Mesmo fluxo condicional de 3 status (item 2), reaproveitado aqui pra copiar
// um jogo do amigo pra própria biblioteca.
function prepararAdicaoDeAmigo(externalId) {
    const wrapper = document.getElementById('quickview-add-form');
    const hoje = new Date().toISOString().slice(0, 10);
    wrapper.classList.remove('d-none');
    wrapper.innerHTML = `
        <p class="small text-white-50 mb-2" data-i18n="addGame.statusPrompt">O que você quer registrar sobre este jogo?</p>
        <div class="d-flex flex-wrap gap-1 mb-2" id="quickview-status-choices">
            <button type="button" class="btn btn-gt-outline btn-sm gt-status-choice" data-status="wish_to_play" data-i18n="addGame.statusWishToPlay">Quero jogar</button>
            <button type="button" class="btn btn-gt-outline btn-sm gt-status-choice" data-status="playing" data-i18n="addGame.statusPlaying">Jogando</button>
            <button type="button" class="btn btn-gt-outline btn-sm gt-status-choice" data-status="finished" data-i18n="addGame.statusFinished">Finalizado</button>
        </div>
        <div class="d-none flex-column gap-2 mb-2" id="quickview-status-fields">
            <input type="date" class="form-control form-control-sm" id="quickview-date-start" max="${hoje}" value="${hoje}">
            <input type="date" class="form-control form-control-sm d-none" id="quickview-date-finish" max="${hoje}" value="${hoje}">
        </div>
        <button class="btn btn-gt-primary btn-sm d-none" id="quickview-confirm-add" data-i18n="common.confirm">Confirmar</button>
    `;
    if (window.GT_I18N) GT_I18N.apply(wrapper);

    const fieldsWrapper = document.getElementById('quickview-status-fields');
    const finishInput = document.getElementById('quickview-date-finish');
    const btnConfirmar = document.getElementById('quickview-confirm-add');

    document.querySelectorAll('#quickview-status-choices .gt-status-choice').forEach((choiceBtn) => {
        choiceBtn.addEventListener('click', () => {
            document.querySelectorAll('#quickview-status-choices .gt-status-choice').forEach(b => b.classList.remove('is-active'));
            choiceBtn.classList.add('is-active');
            const statusEscolhido = choiceBtn.dataset.status;
            btnConfirmar.classList.remove('d-none');

            if (statusEscolhido === 'wish_to_play') {
                fieldsWrapper.classList.add('d-none');
                fieldsWrapper.classList.remove('d-flex');
            } else {
                fieldsWrapper.classList.remove('d-none');
                fieldsWrapper.classList.add('d-flex');
                finishInput.classList.toggle('d-none', statusEscolhido !== 'finished');
            }

            btnConfirmar.onclick = async () => {
                const payload = { external_id: externalId, platform: null, status: statusEscolhido };
                if (statusEscolhido !== 'wish_to_play') {
                    payload.started_at = document.getElementById('quickview-date-start').value || null;
                }
                if (statusEscolhido === 'finished') {
                    payload.finished_at = finishInput.value || null;
                }
                btnConfirmar.disabled = true;
                try {
                    const response = await authFetch('/games/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    if (response.ok) {
                        wrapper.innerHTML = `<p class="small text-success mb-0"><i class="bi bi-check-circle me-1"></i>${GT_I18N.t('reco.added')}</p>`;
                    } else {
                        const data = await response.json().catch(() => ({}));
                        alert(data.detail || 'Erro ao adicionar o jogo.');
                        btnConfirmar.disabled = false;
                    }
                } catch (error) {
                    btnConfirmar.disabled = false;
                }
            };
        });
    });
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
