/**
 * Dashboard JavaScript - Gerencia a interação do utilizador com a API
 */

const API_BASE = 'http://127.0.0.1:8000';

// Cache local da última lista carregada, usado pelos filtros (evita chamada extra à API a cada filtro).
let meusJogos = [];
// ID do UserGame atualmente aberto no modal de detalhe/edição.
let jogoEmEdicaoId = null;
// Densidade da grade: 'list' | 'small' | 'medium' | 'large'
let modoVisualizacao = localStorage.getItem('gt-view-mode') || 'medium';
// Ordenação atual: 'recent' | 'name-asc' | 'name-desc' | 'score-desc'
let modoOrdenacao = localStorage.getItem('gt-sort-mode') || 'recent';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');

    // 1. Proteção de rota
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Popula os selects de console e gênero (compartilhados via consoles.js/genres.js)
    popularSelectConsoles(document.getElementById('filter-console'), { incluirTodos: true, labelTodos: 'Console' });
    popularSelectConsoles(document.getElementById('detail-platform'));
    popularSelectGeneros(document.getElementById('filter-genre'));

    // 3. Inicializa as funções da página
    setupSearch();
    setupFilters();
    setupToolbarDropdowns();
    setupViewMode();
    setupSort();
    setupDetailModal();
    aplicarFiltroDaUrl();
    carregarMeusJogos();

    // Recalcula os contadores de "dias jogando" periodicamente, sem precisar
    // recarregar a página (usa o cache local, não faz nenhuma chamada à API).
    setInterval(aplicarFiltros, 5 * 60 * 1000);

    // Textos gerados via JS (status do card, etc.) não são atualizados pelo
    // GT_I18N.apply() automático — precisam re-renderizar a grade.
    document.addEventListener('gt:langchange', () => carregarMeusJogos());
});

// --- Helper: toast simples (sem markup fixo no HTML — cria o container sob demanda) ---
function mostrarToast(mensagem) {
    let container = document.getElementById('gt-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'gt-toast-container';
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = 1080;
        document.body.appendChild(container);
    }

    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center gt-modal border-0';
    toastEl.setAttribute('role', 'status');
    toastEl.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${escapeHtml(mensagem)}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
        </div>`;
    container.appendChild(toastEl);

    const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
    toast.show();
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// --- Helper: Sanitização para evitar XSS ---
function escapeHtml(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- Contador de dias jogando / concluído (item 1) ---

// Conta os dias entre o início do jogo e uma data de referência (hoje, se não
// finalizado), contando o próprio dia de início como "dia 1" — assim, quem
// começou hoje já vê "jogando há 1 dia" em vez de "0 dias".
function calcularDiasDeJogo(dataInicioStr, dataFimStr) {
    const inicio = new Date(`${dataInicioStr}T00:00:00`);
    const fimRef = dataFimStr ? new Date(`${dataFimStr}T00:00:00`) : new Date(new Date().toDateString());
    const diffDias = Math.round((fimRef - inicio) / 86400000);
    return Math.max(1, diffDias + 1);
}

// Transforma um total de dias em texto humanizado tipo "1 mês e 15 dias" ou
// "1 ano, 2 meses e 3 dias" — usado na frase "Você passou X jogando este jogo".
function formatarDuracaoHumana(totalDias) {
    if (totalDias <= 0) return 'menos de 1 dia';

    const anos = Math.floor(totalDias / 365);
    const resto = totalDias % 365;
    const meses = Math.floor(resto / 30);
    const dias = resto % 30;

    const partes = [];
    if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`);
    if (meses > 0) partes.push(`${meses} mês${meses > 1 ? 'es' : ''}`);
    if (dias > 0 || partes.length === 0) partes.push(`${dias} dia${dias !== 1 ? 's' : ''}`);

    if (partes.length === 1) return partes[0];
    if (partes.length === 2) return `${partes[0]} e ${partes[1]}`;
    return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

// Monta o texto de duração pra um UserGame: "Jogando há X dias" (em andamento)
// ou "Concluído em X dias" + a frase humanizada (finalizado). Retorna null se
// não houver data de início registrada ainda (nada a mostrar).
function obterTextoDuracao(item) {
    const dataInicio = item.start_date || (item.created_at ? item.created_at.slice(0, 10) : null);
    if (!dataInicio) return null;

    if (item.status === 'finished' && item.end_date) {
        const totalDias = calcularDiasDeJogo(dataInicio, item.end_date);
        return {
            titulo: `Concluído em ${totalDias} dia${totalDias !== 1 ? 's' : ''}`,
            subtitulo: `Você passou ${formatarDuracaoHumana(totalDias)} jogando este jogo`,
        };
    }

    if (item.status === 'playing') {
        const totalDias = calcularDiasDeJogo(dataInicio, null);
        return {
            titulo: `Jogando há ${totalDias} dia${totalDias !== 1 ? 's' : ''}`,
            subtitulo: null,
        };
    }

    return null;
}

// --- Helper: fetch autenticado com tratamento de sessão expirada ---
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

// --- Lê ?filtro=playing|finished|favoritos|todos na URL (vindo dos cards do HUD) e pré-aplica ---
function aplicarFiltroDaUrl() {
    const params = new URLSearchParams(window.location.search);
    const filtro = params.get('filtro');
    if (!filtro) return;

    const filtroStatus = document.getElementById('filter-status');
    const btnFavoritos = document.getElementById('btn-favorites-only');

    if (filtro === 'playing' || filtro === 'finished') {
        filtroStatus.value = filtro;
    } else if (filtro === 'favoritos') {
        btnFavoritos.classList.add('is-active');
    }
    // 'todos' não precisa de nada — todos os filtros já começam vazios.
}

// --- Função: Carregar os jogos salvos ---
async function carregarMeusJogos() {
    const grid = document.getElementById('games-grid');

    try {
        const response = await authFetch(`/games/?lang=${gtBackendLang()}`);

        if (!response.ok) {
            grid.innerHTML = `<p class="text-danger text-center mt-5">${GT_I18N.t('grid.loadError')}</p>`;
            return;
        }

        meusJogos = await response.json();
        atualizarHud(meusJogos);
        aplicarFiltros();
    } catch (error) {
        console.error('Erro ao carregar jogos:', error);
    }
}

// --- Função: Atualiza os contadores do HUD com números reais ---
function atualizarHud(jogos) {
    const total = jogos.length;
    const emAndamento = jogos.filter(g => g.status === 'playing').length;
    const finalizados = jogos.filter(g => g.status === 'finished').length;
    const favoritos = jogos.filter(g => g.is_favorite).length;

    document.getElementById('hud-total').textContent = total;
    document.getElementById('hud-playing').textContent = emAndamento;
    document.getElementById('hud-finished').textContent = finalizados;
    document.getElementById('hud-favorites').textContent = favoritos;
}

// Mapeia cada modo de grade pra classe de coluna Bootstrap (não se aplica ao modo 'list').
const CLASSES_POR_MODO = {
    small: 'col-6 col-sm-4 col-md-3 col-lg-2 col-xxl-1',
    medium: 'col-12 col-sm-6 col-md-4 col-xl-3 col-xxl-2',
    large: 'col-12 col-sm-6 col-md-6 col-lg-4 col-xl-3',
};

// --- Função: Renderiza a grade de cards a partir de uma lista de UserGame ---
function renderGrid(jogos) {
    const grid = document.getElementById('games-grid');
    const emptyState = document.getElementById('games-grid-empty');

    if (jogos.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('d-none');
        return;
    }

    emptyState.classList.add('d-none');

    if (modoVisualizacao === 'list') {
        renderGridLista(jogos, grid);
    } else {
        renderGridCards(jogos, grid);
    }
}

function renderGridCards(jogos, grid) {
    const colClass = CLASSES_POR_MODO[modoVisualizacao] || CLASSES_POR_MODO.medium;

    grid.innerHTML = jogos.map(item => {
        const jogo = item.game;
        const rating = item.rating || {};
        const isPlaying = item.status === 'playing';
        const duracao = obterTextoDuracao(item);

        return `
        <div class="${colClass}">
          <article class="gt-card" data-id="${item.id}" style="cursor: pointer;">
            <div class="gt-card-status ${isPlaying ? 'is-playing' : 'is-finished'}">
                ${isPlaying ? GT_I18N.t('status.playing') : GT_I18N.t('status.finished')}
            </div>
            <button class="gt-card-favorite ${item.is_favorite ? 'is-active' : ''}" data-id="${item.id}" data-favorite="${item.is_favorite}" aria-label="Favoritar">
                <i class="bi bi-heart${item.is_favorite ? '-fill' : ''}"></i>
            </button>
            <div class="gt-card-cover">
                ${jogo.cover_url
                    ? `<img src="${jogo.cover_url}" alt="${escapeHtml(jogo.title)}" loading="lazy">`
                    : '<i class="bi bi-controller"></i>'}
            </div>
            <div class="gt-card-body">
              <h3 class="gt-card-title mb-0">${escapeHtml(jogo.title)}</h3>
              <p class="gt-card-meta">${escapeHtml(item.platform || '—')} · ${escapeHtml(gtTranslateGenre(jogo.genre) || '—')}</p>
              ${duracao ? `<p class="gt-card-duration"><i class="bi bi-hourglass-split"></i> ${duracao.titulo}</p>` : ''}
              <div class="gt-card-scores">
                <span>Grf <span class="gt-score-value">${rating.graphics_score ?? '-'}</span></span>
                <span>Som <span class="gt-score-value">${rating.sound_score ?? '-'}</span></span>
                <span>Jog <span class="gt-score-value">${rating.gameplay_score ?? '-'}</span></span>
                <span>Dif <span class="gt-score-value">${rating.difficulty_score ?? '-'}</span></span>
              </div>
            </div>
          </article>
        </div>
        `;
    }).join('');

    ligarEventosDosCards(grid);
}

function renderGridLista(jogos, grid) {
    grid.innerHTML = jogos.map(item => {
        const jogo = item.game;
        const rating = item.rating || {};
        const isPlaying = item.status === 'playing';
        const duracao = obterTextoDuracao(item);

        return `
        <div class="col-12">
          <article class="gt-card-list" data-id="${item.id}">
            <div class="gt-card-list-cover">
                ${jogo.cover_url
                    ? `<img src="${jogo.cover_url}" alt="${escapeHtml(jogo.title)}" loading="lazy">`
                    : '<i class="bi bi-controller"></i>'}
            </div>
            <div class="flex-grow-1 min-width-0">
              <div class="gt-card-list-title">${escapeHtml(jogo.title)}</div>
              <div class="gt-card-list-meta">${escapeHtml(item.platform || '—')} · ${escapeHtml(gtTranslateGenre(jogo.genre) || '—')}${duracao ? ` · ${duracao.titulo}` : ''}</div>
            </div>
            <span class="gt-card-status position-relative ${isPlaying ? 'is-playing' : 'is-finished'}" style="top:auto; left:auto;">
                ${isPlaying ? GT_I18N.t('status.playing') : GT_I18N.t('status.finished')}
            </span>
            <div class="gt-card-list-scores d-none d-md-block">
                Grf <span class="gt-score-value">${rating.graphics_score ?? '-'}</span> ·
                Som <span class="gt-score-value">${rating.sound_score ?? '-'}</span> ·
                Jog <span class="gt-score-value">${rating.gameplay_score ?? '-'}</span> ·
                Dif <span class="gt-score-value">${rating.difficulty_score ?? '-'}</span>
            </div>
            <button class="gt-card-favorite position-relative ${item.is_favorite ? 'is-active' : ''}" data-id="${item.id}" data-favorite="${item.is_favorite}" aria-label="Favoritar" style="top:auto; right:auto;">
                <i class="bi bi-heart${item.is_favorite ? '-fill' : ''}"></i>
            </button>
          </article>
        </div>
        `;
    }).join('');

    ligarEventosDosCards(grid, '.gt-card-list');
}

// Liga os eventos de clique (abrir detalhe) e favoritar, compartilhados entre os modos de card e lista.
function ligarEventosDosCards(grid, seletorCard = '.gt-card') {
    grid.querySelectorAll(seletorCard).forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.gt-card-favorite')) return;
            abrirDetalhe(Number(card.dataset.id));
        });
    });

    grid.querySelectorAll('.gt-card-favorite').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = Number(btn.dataset.id);
            const favoritoAtual = btn.dataset.favorite === 'true';

            // Feedback visual imediato (otimista), revertido se a chamada falhar.
            btn.classList.toggle('is-active');
            btn.querySelector('i').className = `bi bi-heart${!favoritoAtual ? '-fill' : ''}`;

            const sucesso = await atualizarJogo(id, { is_favorite: !favoritoAtual });
            if (sucesso) {
                carregarMeusJogos();
            } else {
                // Reverte o feedback visual se a API falhar.
                btn.classList.toggle('is-active');
                btn.querySelector('i').className = `bi bi-heart${favoritoAtual ? '-fill' : ''}`;
            }
        });
    });
}

// --- Alterna entre os modos de densidade da grade (lista/pequeno/médio/grande), estilo Google Drive ---
const ICONE_POR_MODO = {
    list: 'bi-list-ul',
    small: 'bi-grid-3x3-gap-fill',
    medium: 'bi-grid-3x2-gap-fill',
    large: 'bi-grid-1x2-gap-fill',
};

function setupViewMode() {
    const itens = document.querySelectorAll('#view-mode-group [data-view]');
    const iconeAtual = document.getElementById('view-mode-current-icon');

    const aplicarEstadoAtivo = () => {
        itens.forEach(el => el.classList.toggle('active', el.dataset.view === modoVisualizacao));
        if (iconeAtual) {
            iconeAtual.className = `bi ${ICONE_POR_MODO[modoVisualizacao] || ICONE_POR_MODO.medium}`;
        }
    };
    aplicarEstadoAtivo();

    itens.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            modoVisualizacao = item.dataset.view;
            localStorage.setItem('gt-view-mode', modoVisualizacao);
            aplicarEstadoAtivo();
            aplicarFiltros();
        });
    });
}

// --- Ordenação (dropdown "Ordenar") ---
function setupSort() {
    const itens = document.querySelectorAll('#sort-menu [data-sort]');
    itens.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            modoOrdenacao = item.dataset.sort;
            localStorage.setItem('gt-sort-mode', modoOrdenacao);
            aplicarFiltros();
        });
    });
}

function ordenarJogos(lista) {
    const copia = [...lista];
    switch (modoOrdenacao) {
        case 'name-asc':
            return copia.sort((a, b) => a.game.title.localeCompare(b.game.title, 'pt-BR'));
        case 'name-desc':
            return copia.sort((a, b) => b.game.title.localeCompare(a.game.title, 'pt-BR'));
        case 'score-desc':
            return copia.sort((a, b) => {
                const notaMedia = (item) => {
                    const r = item.rating;
                    if (!r) return -1;
                    const notas = [r.graphics_score, r.sound_score, r.gameplay_score, r.difficulty_score].filter(n => typeof n === 'number');
                    return notas.length ? notas.reduce((x, y) => x + y, 0) / notas.length : -1;
                };
                return notaMedia(b) - notaMedia(a);
            });
        case 'recent':
        default:
            return copia.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
}

// --- Função: Lógica de Pesquisa (Adicionar jogo) ---
function setupSearch() {
    const searchBtn = document.getElementById('game-search-btn');
    const searchInput = document.getElementById('game-search-input');
    const resultsDiv = document.getElementById('game-search-results');

    if (!searchBtn) return;

    const executarBusca = async () => {
        const query = searchInput.value;
        if (query.length < 2) return;

        resultsDiv.innerHTML = '<p class="text-white text-center">A procurar...</p>';

        try {
            const response = await authFetch(`/games/search?q=${encodeURIComponent(query)}`);

            if (!response.ok) {
                resultsDiv.innerHTML = '<p class="text-danger">Erro ao pesquisar.</p>';
                return;
            }

            const jogos = await response.json();

            if (jogos.length === 0) {
                resultsDiv.innerHTML = '<p class="text-white">Nenhum jogo encontrado.</p>';
                return;
            }

            // Campos retornados pelo backend: external_id, title, cover_url, genre, platforms...
            resultsDiv.innerHTML = jogos.map(jogo => `
                <div class="col-12 mb-2">
                    <div class="card p-2 d-flex flex-row align-items-center bg-dark text-white border-secondary">
                        ${jogo.cover_url
                            ? `<img src="${jogo.cover_url}" style="width: 50px; height: 50px; object-fit: contain; background-color: var(--gt-void);" class="rounded" alt="Capa">`
                            : '<div style="width:50px;height:50px;" class="rounded bg-secondary d-flex align-items-center justify-content-center"><i class="bi bi-controller"></i></div>'}
                        <div class="ms-3">
                            <h6 class="mb-0 text-white">${escapeHtml(jogo.title)}</h6>
                            <small class="text-white-50">${escapeHtml(gtTranslateGenre(jogo.genre) || '')}</small>
                        </div>
                        <button class="btn btn-sm btn-primary ms-auto" onclick="adicionarJogo('${jogo.external_id}', this)" style="background-color: var(--gt-accent); border-color: var(--gt-accent);">Adicionar</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            resultsDiv.innerHTML = '<p class="text-danger">Erro ao pesquisar.</p>';
        }
    };

    searchBtn.addEventListener('click', executarBusca);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            executarBusca();
        }
    });
}

// --- Função: Adicionar Jogo à Biblioteca ---
async function adicionarJogo(externalId, btnElement) {
    btnElement.disabled = true;
    btnElement.innerText = 'Adicionando...';

    try {
        const response = await authFetch('/games/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ external_id: externalId, platform: null })
        });

        if (response.ok) {
            const data = await response.json().catch(() => null);
            carregarMeusJogos();

            const modalElement = document.getElementById('modalAddGame');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                modal?.hide();
            }
            document.getElementById('game-search-input').value = '';
            document.getElementById('game-search-results').innerHTML =
                `<p class="text-white-50 small text-center py-4 mb-0">${GT_I18N.t('addGame.searchHint')}</p>`;

            // Já estava na biblioteca: em vez de duplicar o card, o backend
            // registrou uma nova sessão de jogo (replay) e incrementou o contador.
            if (data && data.play_count > 1) {
                mostrarToast(
                    tf('toast.replayLogged', { title: data.game?.title || '', count: data.play_count })
                    || `"${data.game?.title || ''}" já estava na sua biblioteca — registramos mais uma jogada (total: ${data.play_count}x).`
                );
            }
        } else if (response.status === 409) {
            alert('Esse jogo já está na sua biblioteca.');
            btnElement.disabled = false;
            btnElement.innerText = 'Adicionar';
        } else {
            const data = await response.json().catch(() => ({}));
            alert(data.detail || 'Erro ao adicionar o jogo.');
            btnElement.disabled = false;
            btnElement.innerText = 'Adicionar';
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        btnElement.disabled = false;
        btnElement.innerText = 'Adicionar';
    }
}

// --- Função: Atualiza um UserGame (favoritar rápido e modal de detalhe) ---
async function atualizarJogo(userGameId, payload) {
    try {
        const response = await authFetch(`/games/${userGameId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (error) {
        console.error('Erro ao atualizar jogo:', error);
        return false;
    }
}

// --- Modal de Detalhe / Avaliação ---
function setupDetailModal() {
    // Estrelas: clique define a nota (1 a 5); clicar na mesma nota zera.
    document.querySelectorAll('.gt-star-input').forEach(container => {
        container.querySelectorAll('.gt-star').forEach(star => {
            star.addEventListener('click', () => {
                const valorClicado = Number(star.dataset.value);
                const notaAtual = Number(container.dataset.score || 0);
                const novaNota = notaAtual === valorClicado ? 0 : valorClicado;
                definirEstrelas(container, novaNota);
            });
        });
    });

    document.getElementById('btn-save-detail')?.addEventListener('click', salvarDetalhe);
    document.getElementById('btn-delete-detail')?.addEventListener('click', excluirJogoAtual);
    document.getElementById('btn-confirm-session')?.addEventListener('click', confirmarFormularioSessao);
    document.getElementById('btn-cancel-session')?.addEventListener('click', fecharFormularioSessao);
    document.getElementById('btn-fetch-duration')?.addEventListener('click', buscarDuracaoAutomatica);

    document.getElementById('detail-platform')?.addEventListener('change', (e) => {
        document.getElementById('detail-platform-custom').classList.toggle('d-none', e.target.value !== 'Outro');
    });
}

function definirEstrelas(container, nota) {
    container.dataset.score = nota;
    container.querySelectorAll('.gt-star').forEach(star => {
        const valor = Number(star.dataset.value);
        const preenchida = valor <= nota;
        star.classList.toggle('is-filled', preenchida);
        star.classList.toggle('bi-star-fill', preenchida);
        star.classList.toggle('bi-star', !preenchida);
    });
}

// Reduz uma descrição longa para no máximo ~50 palavras, terminando com reticências.
function truncarDescricao(texto, maxPalavras = 50) {
    if (!texto) return 'Sem descrição disponível para este jogo.';
    const palavras = texto.trim().split(/\s+/);
    if (palavras.length <= maxPalavras) return texto;
    return palavras.slice(0, maxPalavras).join(' ') + '…';
}

function abrirDetalhe(userGameId) {
    const item = meusJogos.find(g => g.id === userGameId);
    if (!item) return;

    jogoEmEdicaoId = userGameId;
    const rating = item.rating || {};
    const jogo = item.game;

    document.getElementById('modalGameDetailLabel').textContent = jogo.title;

    // --- Seção de informações (capa, gênero, descrição, plataformas, multiplayer) ---
    const coverWrapper = document.getElementById('detail-cover-wrapper');
    coverWrapper.innerHTML = jogo.cover_url
        ? `<img src="${jogo.cover_url}" alt="${escapeHtml(jogo.title)}">`
        : '<i class="bi bi-controller"></i>';

    document.getElementById('detail-genre').textContent = gtTranslateGenre(jogo.genre) || GT_I18N.t('detail.noGenre');
    document.getElementById('detail-description').textContent = truncarDescricao(jogo.description);

    const badgesWrapper = document.getElementById('detail-platforms-badges');
    const plataformas = (jogo.platforms || '').split(',').map(p => p.trim()).filter(Boolean);
    badgesWrapper.innerHTML = plataformas.length
        ? plataformas.map(p => `<span class="gt-platform-badge">${escapeHtml(p)}</span>`).join('')
        : '';

    document.getElementById('detail-multiplayer-info').textContent = jogo.multiplayer_info
        ? `Modo: ${jogo.multiplayer_info}`
        : '';

    // Vídeo de gameplay/trailer (busca sob demanda, não fica salvo — pode demorar um instante)
    const videoWrapper = document.getElementById('detail-video-wrapper');
    videoWrapper.innerHTML = '<p class="small text-white-50 mb-0">Buscando vídeo de gameplay...</p>';
    carregarVideoDoJogo(jogo.title, videoWrapper);

    // --- Formulário de tracking/avaliação ---
    const consoleConhecido = identificarConsoleConhecido(item.platform);
    const platformSelect = document.getElementById('detail-platform');
    const platformCustomInput = document.getElementById('detail-platform-custom');

    if (consoleConhecido) {
        platformSelect.value = consoleConhecido.value;
        platformCustomInput.classList.add('d-none');
        platformCustomInput.value = '';
    } else if (item.platform) {
        platformSelect.value = 'Outro';
        platformCustomInput.value = item.platform;
        platformCustomInput.classList.remove('d-none');
    } else {
        platformSelect.value = 'PC';
        platformCustomInput.classList.add('d-none');
        platformCustomInput.value = '';
    }

    document.getElementById('detail-start-date').value = item.start_date || '';
    document.getElementById('detail-end-date').value = item.end_date || '';
    document.getElementById('detail-favorite').checked = !!item.is_favorite;

    // --- Contador de dias jogando/concluído ---
    const duracaoWrapper = document.getElementById('detail-duration-wrapper');
    const duracao = obterTextoDuracao(item);
    if (duracao) {
        document.getElementById('detail-duration-title').textContent = duracao.titulo;
        document.getElementById('detail-duration-subtitle').textContent = duracao.subtitulo || '';
        duracaoWrapper.classList.remove('d-none');
    } else {
        duracaoWrapper.classList.add('d-none');
    }

    // --- Replay: contador, histórico de jogadas (início/fim), horas, duração ---
    document.getElementById('detail-play-count').textContent = item.play_count || 1;
    renderizarHistoricoJogadas(item);
    document.getElementById('detail-hours-played').value = item.hours_played ?? '';
    document.getElementById('detail-time-to-beat-main').value = item.time_to_beat_main ?? '';
    document.getElementById('detail-time-to-beat-100').value = item.time_to_beat_completionist ?? '';

    definirEstrelas(document.getElementById('stars-graphics'), rating.graphics_score || 0);
    definirEstrelas(document.getElementById('stars-sound'), rating.sound_score || 0);
    definirEstrelas(document.getElementById('stars-gameplay'), rating.gameplay_score || 0);
    definirEstrelas(document.getElementById('stars-difficulty'), rating.difficulty_score || 0);

    const modalElement = document.getElementById('modalGameDetail');
    const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modal.show();
}

async function carregarVideoDoJogo(titulo, videoWrapper) {
    try {
        const response = await authFetch(`/explore/gameplay?title=${encodeURIComponent(titulo)}`);
        if (!response.ok) {
            videoWrapper.innerHTML = '';
            return;
        }
        const data = await response.json();
        renderizarGameplay(videoWrapper, data.videos || (data.video ? [data.video] : []), titulo);
    } catch (error) {
        videoWrapper.innerHTML = '';
    }
}

async function salvarDetalhe() {
    if (!jogoEmEdicaoId) return;

    const platformSelectValue = document.getElementById('detail-platform').value;
    const platformFinal = platformSelectValue === 'Outro'
        ? (document.getElementById('detail-platform-custom').value.trim() || 'Outro')
        : platformSelectValue;

    const payload = {
        platform: platformFinal,
        start_date: document.getElementById('detail-start-date').value || null,
        end_date: document.getElementById('detail-end-date').value || null,
        is_favorite: document.getElementById('detail-favorite').checked,
        graphics_score: Number(document.getElementById('stars-graphics').dataset.score) || null,
        sound_score: Number(document.getElementById('stars-sound').dataset.score) || null,
        gameplay_score: Number(document.getElementById('stars-gameplay').dataset.score) || null,
        difficulty_score: Number(document.getElementById('stars-difficulty').dataset.score) || null,
        hours_played: parseFloat(document.getElementById('detail-hours-played').value) || null,
        time_to_beat_main: parseFloat(document.getElementById('detail-time-to-beat-main').value) || null,
        time_to_beat_completionist: parseFloat(document.getElementById('detail-time-to-beat-100').value) || null,
    };

    const sucesso = await atualizarJogo(jogoEmEdicaoId, payload);
    if (sucesso) {
        const modalElement = document.getElementById('modalGameDetail');
        bootstrap.Modal.getInstance(modalElement)?.hide();
        carregarMeusJogos();
    } else {
        alert('Não foi possível salvar as alterações.');
    }
}

// Formata uma sessão de jogo pro histórico (ex: "12/03/2026 — em andamento" ou "12/03/2026 → 15/03/2026")
function formatarPeriodoSessao(sessao) {
    const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString();
    if (!sessao.finished_at) {
        return `${fmt(sessao.started_at)} — ${GT_I18N.t('status.playing')}`;
    }
    if (sessao.started_at === sessao.finished_at) {
        return fmt(sessao.started_at);
    }
    return `${fmt(sessao.started_at)} → ${fmt(sessao.finished_at)}`;
}

// Desenha os botões de ação (Jogar novamente / Finalizar esta jogada) e a
// lista de histórico de jogadas (cada uma com data de início e de término).
function renderizarHistoricoJogadas(item) {
    const sessoes = (item.sessions || []).slice().sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    const sessaoAberta = sessoes.find(s => !s.finished_at);
    const acoes = document.getElementById('detail-session-actions');
    const historico = document.getElementById('detail-session-history');

    if (sessaoAberta) {
        acoes.innerHTML = `
            <button type="button" class="btn btn-gt-primary btn-sm" id="btn-finish-session" data-session-id="${sessaoAberta.id}">
                <i class="bi bi-check-lg me-1"></i><span data-i18n="detail.finishSession">Finalizar esta jogada</span>
            </button>`;
        document.getElementById('btn-finish-session').addEventListener('click', () => abrirFormularioSessao('finish', sessaoAberta.id));
    } else {
        acoes.innerHTML = `
            <button type="button" class="btn btn-gt-outline btn-sm" id="btn-play-again">
                <i class="bi bi-plus-lg me-1"></i><span data-i18n="detail.logSession">Jogar novamente</span>
            </button>`;
        document.getElementById('btn-play-again').addEventListener('click', () => abrirFormularioSessao('start'));
    }
    GT_I18N.apply(acoes);

    if (sessoes.length === 0) {
        historico.innerHTML = '';
        return;
    }
    historico.innerHTML = sessoes.map(s => `<li><i class="bi bi-calendar3 me-1"></i>${formatarPeriodoSessao(s)}</li>`).join('');
}

let _sessaoFormModo = null; // 'start' | 'finish'
let _sessaoFormId = null;   // id da sessão (só usado no modo 'finish')

function abrirFormularioSessao(modo, sessionId = null) {
    _sessaoFormModo = modo;
    _sessaoFormId = sessionId;
    const form = document.getElementById('detail-session-form');
    const label = document.getElementById('detail-session-form-label');
    const input = document.getElementById('detail-session-date-input');
    label.textContent = modo === 'start' ? GT_I18N.t('detail.startDate') : GT_I18N.t('detail.endDate');
    input.value = new Date().toISOString().slice(0, 10);
    form.classList.remove('d-none');
}

function fecharFormularioSessao() {
    document.getElementById('detail-session-form').classList.add('d-none');
    _sessaoFormModo = null;
    _sessaoFormId = null;
}

async function confirmarFormularioSessao() {
    if (!jogoEmEdicaoId || !_sessaoFormModo) return;
    const data = document.getElementById('detail-session-date-input').value || null;

    try {
        let response;
        if (_sessaoFormModo === 'start') {
            response = await authFetch(`/games/${jogoEmEdicaoId}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ started_at: data }),
            });
        } else {
            response = await authFetch(`/games/${jogoEmEdicaoId}/sessions/${_sessaoFormId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finished_at: data }),
            });
        }
        if (!response.ok) {
            alert(GT_I18N.t('detail.sessionError'));
            return;
        }
        const atualizado = await response.json();
        document.getElementById('detail-play-count').textContent = atualizado.play_count;
        renderizarHistoricoJogadas(atualizado);
        const idx = meusJogos.findIndex(g => g.id === jogoEmEdicaoId);
        if (idx !== -1) meusJogos[idx] = atualizado;
        fecharFormularioSessao();
        aplicarFiltros();
    } catch (error) {
        console.error('Erro ao registrar jogada:', error);
    }
}

async function buscarDuracaoAutomatica() {
    if (!jogoEmEdicaoId) return;
    const btn = document.getElementById('btn-fetch-duration');
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${GT_I18N.t('common.loading')}`;

    try {
        const response = await authFetch(`/games/${jogoEmEdicaoId}/fetch-duration`, { method: 'POST' });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            alert(data.detail || GT_I18N.t('detail.durationNotFound'));
            return;
        }
        const atualizado = await response.json();
        document.getElementById('detail-time-to-beat-main').value = atualizado.time_to_beat_main ?? '';
        document.getElementById('detail-time-to-beat-100').value = atualizado.time_to_beat_completionist ?? '';
        const idx = meusJogos.findIndex(g => g.id === jogoEmEdicaoId);
        if (idx !== -1) meusJogos[idx] = atualizado;
    } catch (error) {
        console.error('Erro ao buscar duração automática:', error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
    }
}

async function excluirJogoAtual() {
    if (!jogoEmEdicaoId) return;
    if (!confirm('Tem certeza que deseja remover este jogo da sua biblioteca?')) return;

    try {
        const response = await authFetch(`/games/${jogoEmEdicaoId}`, { method: 'DELETE' });
        if (response.ok || response.status === 204) {
            const modalElement = document.getElementById('modalGameDetail');
            bootstrap.Modal.getInstance(modalElement)?.hide();
            carregarMeusJogos();
        } else {
            alert('Não foi possível excluir o jogo.');
        }
    } catch (error) {
        console.error('Erro ao excluir jogo:', error);
        alert('Não foi possível conectar ao servidor.');
    }
}

// --- Filtros e busca no catálogo local ---
// A toolbar (.gt-toolbar-row) usa "overflow-x: auto" pra rolar em vez de quebrar
// em telas estreitas — mas isso faz o navegador tratar overflow-y como "auto"
// também (regra do CSS), então o menu dos dropdowns (Filtros/Ordenar/Visualização)
// acabava sendo CORTADO pela própria toolbar, sobrando só uma tira fina com as
// setinhas dos <select>. Corrigido posicionando o menu com Popper "fixed", que
// não é afetado pelo overflow do ancestral.
function setupToolbarDropdowns() {
    ['btn-filtros', 'btn-sort', 'btn-view-mode'].forEach(id => {
        const el = document.getElementById(id);
        if (!el || typeof bootstrap === 'undefined') return;
        bootstrap.Dropdown.getOrCreateInstance(el, {
            popperConfig: (defaultConfig) => ({ ...defaultConfig, strategy: 'fixed' }),
        });
    });
}

function setupFilters() {
    const filtroSearch = document.getElementById('filter-search');
    const filtroConsole = document.getElementById('filter-console');
    const filtroGenero = document.getElementById('filter-genre');
    const filtroStatus = document.getElementById('filter-status');
    const filtroNota = document.getElementById('filter-gameplay-score');
    const btnFavoritos = document.getElementById('btn-favorites-only');
    const btnLimpar = document.getElementById('btn-limpar-filtros');

    filtroSearch?.addEventListener('input', aplicarFiltros);
    filtroConsole?.addEventListener('change', aplicarFiltros);
    filtroGenero?.addEventListener('change', aplicarFiltros);
    filtroStatus?.addEventListener('change', aplicarFiltros);
    filtroNota?.addEventListener('change', aplicarFiltros);
    btnFavoritos?.addEventListener('click', () => {
        btnFavoritos.classList.toggle('is-active');
        aplicarFiltros();
    });

    btnLimpar?.addEventListener('click', () => {
        if (filtroConsole) filtroConsole.value = '';
        if (filtroGenero) filtroGenero.value = '';
        if (filtroStatus) filtroStatus.value = '';
        if (filtroNota) filtroNota.value = '';
        aplicarFiltros();
    });
}

// Atualiza o número de filtros ativos no badge do botão "Filtros" (não conta
// a busca por texto nem favoritos, que têm seus próprios indicadores visuais).
function atualizarBadgeFiltros() {
    const badge = document.getElementById('filtros-badge-count');
    if (!badge) return;

    const valores = [
        document.getElementById('filter-console')?.value,
        document.getElementById('filter-genre')?.value,
        document.getElementById('filter-status')?.value,
        document.getElementById('filter-gameplay-score')?.value,
    ];
    const ativos = valores.filter(Boolean).length;

    if (ativos > 0) {
        badge.textContent = ativos;
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
}

function aplicarFiltros() {
    const termo = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
    const consoleSel = document.getElementById('filter-console')?.value || '';
    const generoSel = (document.getElementById('filter-genre')?.value || '').toLowerCase();
    const statusSel = document.getElementById('filter-status')?.value || '';
    const notaMinima = Number(document.getElementById('filter-gameplay-score')?.value || 0);
    const apenasFavoritos = document.getElementById('btn-favorites-only')?.classList.contains('is-active');

    atualizarBadgeFiltros();

    const filtrados = meusJogos.filter(item => {
        const jogo = item.game;
        const rating = item.rating || {};

        if (termo && !jogo.title.toLowerCase().includes(termo)) return false;

        if (consoleSel) {
            const consoleConhecido = identificarConsoleConhecido(item.platform);
            if (consoleSel === 'Outro') {
                // "Outro" reúne tudo que não bateu com nenhum console conhecido da lista.
                if (consoleConhecido) return false;
            } else if (!consoleConhecido || consoleConhecido.value !== consoleSel) {
                return false;
            }
        }

        if (generoSel && !(jogo.genre || '').toLowerCase().includes(generoSel)) return false;
        if (statusSel && item.status !== statusSel) return false;
        if (notaMinima && (rating.gameplay_score || 0) < notaMinima) return false;
        if (apenasFavoritos && !item.is_favorite) return false;

        return true;
    });

    renderGrid(ordenarJogos(filtrados));
}

// --- Função: Logoff ---
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}
