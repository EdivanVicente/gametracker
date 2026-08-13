function escapeHtml(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

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

let _ultimosResultados = [];
let _ultimaBusca = '';

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('explore-btn');
    const input = document.getElementById('explore-input');
    const resultDiv = document.getElementById('explore-result');
    const filtroPlataforma = document.getElementById('explore-platform-filter');
    let debounceTimer = null;

    // Busca flexível por nome — traz TODAS as variações encontradas (diferentes
    // jogos e plataformas), não só o primeiro resultado como era antes.
    const buscar = async (tituloForcado) => {
        const titulo = (tituloForcado ?? input.value).trim();
        if (titulo.length < 2) return;

        input.value = titulo;
        _ultimaBusca = titulo;
        resultDiv.innerHTML = `<p class="text-white-50 text-center py-5">${GT_I18N.t('common.loading')}</p>`;

        try {
            const response = await authFetch(`/games/search?q=${encodeURIComponent(titulo)}&page_size=24`);

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                resultDiv.innerHTML = `<p class="text-danger text-center py-5">${escapeHtml(data.detail || GT_I18N.t('explore.searchError'))}</p>`;
                return;
            }

            _ultimosResultados = await response.json();
            popularFiltroPlataformas(_ultimosResultados);
            renderizarListaResultados(_ultimosResultados, titulo);
        } catch (error) {
            resultDiv.innerHTML = `<p class="text-danger text-center py-5">${GT_I18N.t('auth.connectionError')}</p>`;
        }
    };

    btn.addEventListener('click', () => buscar());
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscar();
        }
    });
    // Busca também enquanto digita (com um pequeno atraso, pra não disparar uma
    // requisição a cada tecla).
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const valor = input.value.trim();
        if (valor.length < 2) return;
        debounceTimer = setTimeout(() => buscar(valor), 450);
    });

    filtroPlataforma.addEventListener('change', () => {
        renderizarListaResultados(_ultimosResultados, _ultimaBusca);
    });

    // Filtro de visualização (lista/médio/grande) — mesmo padrão e mesma
    // preferência salva da tela "Meus Jogos".
    document.querySelectorAll('#explore-view-mode-btn ~ .dropdown-menu [data-explore-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            definirModoVisualizacaoExplore(item.getAttribute('data-explore-view'));
        });
    });
    atualizarIconeModoExplore();

    // Chips de sugestão: pool grande de jogos populares e variados — a cada
    // visita à página, sorteia 5 diferentes, pra não ficar sempre os mesmos.
    const POOL_SUGESTOES = [
        'Hollow Knight', 'The Witcher 3', 'Elden Ring', 'Stardew Valley', 'Celeste',
        'God of War', 'The Legend of Zelda', 'Red Dead Redemption 2',
        'Super Mario Odyssey', 'Metroid', 'Dark Souls III', 'Persona 5',
        'Hades', 'Cyberpunk 2077', 'Animal Crossing', 'Resident Evil',
        'Final Fantasy VII', 'Sekiro: Shadows Die Twice', 'Undertale', 'Portal 2',
        'Minecraft', 'Terraria', 'Mortal Kombat', 'Street Fighter', 'Chrono Trigger',
        'Castlevania', 'Ori and the Blind Forest', 'Disco Elysium', 'It Takes Two',
        'Aladdin',
    ];

    function sortearSugestoes(qtd = 5) {
        const embaralhado = [...POOL_SUGESTOES].sort(() => Math.random() - 0.5);
        return embaralhado.slice(0, qtd);
    }

    function renderizarSugestoes() {
        const container = document.getElementById('explore-suggestions');
        container.querySelectorAll('.gt-suggestion-chip').forEach(el => el.remove());

        sortearSugestoes().forEach(jogo => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'gt-suggestion-chip';
            chip.dataset.jogo = jogo;
            chip.textContent = jogo;
            chip.addEventListener('click', () => buscar(jogo));
            container.appendChild(chip);
        });
    }

    renderizarSugestoes();

    // Se o usuário trocar o idioma, refaz a busca atual pra os gêneros virem
    // traduzidos de novo.
    document.addEventListener('gt:langchange', () => {
        if (_ultimaBusca.length >= 2) buscar(_ultimaBusca);
    });
});

// Monta o filtro "Todas as plataformas" + uma opção pra cada plataforma
// diferente encontrada nos resultados da busca atual.
function popularFiltroPlataformas(resultados) {
    const select = document.getElementById('explore-platform-filter');
    const valorAtual = select.value;

    const plataformas = new Set();
    resultados.forEach(jogo => (jogo.platforms || []).forEach(p => plataformas.add(p)));

    select.innerHTML = `<option value="">${GT_I18N.t('explore.allPlatforms')}</option>`;
    [...plataformas].sort().forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        option.textContent = p;
        select.appendChild(option);
    });

    // Mantém a plataforma selecionada, se ela ainda existir na nova lista.
    if ([...plataformas].includes(valorAtual)) select.value = valorAtual;
}

const CLASSES_POR_MODO_EXPLORE = {
    medium: 'col-6 col-sm-4 col-lg-3',
    large: 'col-12 col-sm-6 col-lg-4',
};
const ICONE_POR_MODO_EXPLORE = { list: 'bi-list-ul', medium: 'bi-grid-3x2-gap-fill', large: 'bi-grid-1x2-gap-fill' };

function modoVisualizacaoExplore() {
    const salvo = localStorage.getItem('gt-view-mode') || 'medium';
    return salvo === 'small' ? 'medium' : salvo;
}

function definirModoVisualizacaoExplore(modo) {
    localStorage.setItem('gt-view-mode', modo);
    atualizarIconeModoExplore();
    renderizarListaResultados(_ultimosResultados, _ultimaBusca);
}

function atualizarIconeModoExplore() {
    const icone = document.getElementById('explore-view-mode-icon');
    if (icone) icone.className = `bi ${ICONE_POR_MODO_EXPLORE[modoVisualizacaoExplore()] || ICONE_POR_MODO_EXPLORE.medium}`;
}

// Lista de cards compactos (nome + plataforma + botão "Saiba mais") — sem
// carregar vídeo/descrição pra cada um, isso só é buscado quando o usuário
// clica em "Saiba mais" de um jogo específico (mais rápido e mais leve).
function renderizarListaResultados(resultados, tituloBuscado) {
    const resultDiv = document.getElementById('explore-result');
    const plataformaFiltro = document.getElementById('explore-platform-filter').value;

    const filtrados = plataformaFiltro
        ? resultados.filter(j => (j.platforms || []).includes(plataformaFiltro))
        : resultados;

    if (filtrados.length === 0) {
        resultDiv.innerHTML = `
            <p class="text-white-50 text-center py-3 mb-2">${GT_I18N.t('explore.notFound', { title: escapeHtml(tituloBuscado) })}</p>
            <div class="text-center">
                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(tituloBuscado + ' gameplay')}"
                   target="_blank" rel="noopener noreferrer" class="gt-gameplay-channel-link d-inline-flex">
                    <i class="bi bi-youtube"></i> ${GT_I18N.t('explore.searchOnYoutube', { title: escapeHtml(tituloBuscado) })} <i class="bi bi-box-arrow-up-right"></i>
                </a>
            </div>
        `;
        return;
    }

    resultDiv.innerHTML = `
        <p class="small text-white-50 mb-3">${GT_I18N.t('explore.resultsCount', { count: filtrados.length })}</p>
        <div class="row g-3" id="explore-results-grid"></div>
    `;

    const grid = document.getElementById('explore-results-grid');
    const modo = modoVisualizacaoExplore();

    if (modo === 'list') {
        grid.innerHTML = filtrados.map((jogo, idx) => `
            <div class="col-12">
                <div class="gt-panel d-flex align-items-center gap-3 p-2" data-explore-idx="${idx}" role="button">
                    <div style="width:48px;height:48px;border-radius:6px;overflow:hidden;background-color:var(--gt-surface-raised);flex-shrink:0;">
                        ${jogo.cover_url ? `<img src="${jogo.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;">` : ''}
                    </div>
                    <div class="flex-fill min-width-0">
                        <p class="small fw-semibold mb-0 text-truncate">${escapeHtml(jogo.title)}</p>
                        <p class="text-white-50 mb-0" style="font-size: 0.72rem;">${escapeHtml((jogo.platforms || []).join(', ') || GT_I18N.t('stats.notInformed'))}</p>
                    </div>
                    <button type="button" class="btn btn-gt-outline btn-sm flex-shrink-0" data-explore-idx-btn="${idx}">${GT_I18N.t('explore.learnMore')}</button>
                </div>
            </div>`).join('');
    } else {
        const colClass = CLASSES_POR_MODO_EXPLORE[modo] || CLASSES_POR_MODO_EXPLORE.medium;
        grid.innerHTML = filtrados.map((jogo, idx) => `
            <div class="${colClass}">
                <div class="gt-panel h-100 overflow-hidden" style="padding: 0; cursor: pointer;" data-explore-idx="${idx}" role="button">
                    <div style="aspect-ratio: 3/4; background-color: var(--gt-surface-raised);">
                        ${jogo.cover_url ? `<img src="${jogo.cover_url}" alt="" style="width:100%;height:100%;object-fit:cover;">` : ''}
                    </div>
                    <div class="p-2">
                        <p class="small fw-semibold mb-1 text-truncate" title="${escapeHtml(jogo.title)}">${escapeHtml(jogo.title)}</p>
                        <p class="text-white-50 mb-2" style="font-size: 0.72rem;">
                            ${escapeHtml((jogo.platforms || []).slice(0, 2).join(', ') || GT_I18N.t('stats.notInformed'))}
                        </p>
                        <button type="button" class="btn btn-gt-outline btn-sm w-100" data-explore-idx-btn="${idx}">
                            ${GT_I18N.t('explore.learnMore')}
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    grid.querySelectorAll('[data-explore-idx], [data-explore-idx-btn]').forEach(el => {
        const idx = parseInt(el.getAttribute('data-explore-idx') ?? el.getAttribute('data-explore-idx-btn'), 10);
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirDetalheJogo(filtrados[idx]);
        });
    });
}

// Modal "Saiba mais" — reaproveita a MESMA estrutura de detalhe (capa, gênero,
// plataformas, resumo, vídeo de gameplay) usada em outros pontos do site.
async function abrirDetalheJogo(jogo) {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalExploreDetail'));
    const titulo = document.getElementById('explore-detail-title');
    const body = document.getElementById('explore-detail-body');

    titulo.textContent = jogo.title;
    body.innerHTML = `<p class="text-white-50 small text-center py-4 mb-0">${GT_I18N.t('common.loading')}</p>`;
    modal.show();

    try {
        const response = await authFetch(
            `/explore/gameplay?title=${encodeURIComponent(jogo.title)}&external_id=${encodeURIComponent(jogo.external_id)}&lang=${gtBackendLang()}`
        );
        const data = await response.json();
        renderizarDetalheJogo(body, data, jogo);
    } catch (error) {
        body.innerHTML = `<p class="text-danger small text-center py-4 mb-0">${GT_I18N.t('community.loadError')}</p>`;
    }
}

function renderizarDetalheJogo(body, data, jogoResumo) {
    const jogo = data.game || jogoResumo;
    const plataformas = jogo.platforms || [];
    const badgesPlataformas = plataformas.length
        ? plataformas.map(p => `<span class="gt-platform-badge">${escapeHtml(p)}</span>`).join('')
        : '';

    body.innerHTML = `
        <div class="row g-4">
            <div class="col-12 col-md-5">
                <div class="gt-detail-cover mb-3">
                    ${jogo.cover_url ? `<img src="${jogo.cover_url}" alt="${escapeHtml(jogo.title || '')}">` : '<i class="bi bi-controller"></i>'}
                </div>
                <p class="gt-detail-genre mb-2">${escapeHtml(gtTranslateGenre(jogo.genre) || '')}</p>
                <div class="d-flex flex-wrap gap-1">${badgesPlataformas}</div>
            </div>
            <div class="col-12 col-md-7">
                <p class="small mb-3">${jogo.description ? escapeHtml(jogo.description.split(/\s+/).slice(0, 60).join(' ')) + '…' : GT_I18N.t('explore.noDescription')}</p>
                <p class="small text-white-50 mb-2">${GT_I18N.t('detail.gameplayLabel')}</p>
                <div id="explore-video-wrapper"></div>
            </div>
        </div>
    `;

    renderizarGameplay(document.getElementById('explore-video-wrapper'), data.videos || (data.video ? [data.video] : []), jogo.title);
}
