/**
 * Dashboard JavaScript - Gerencia a interação do utilizador com a API
 */


// Cache local da última lista carregada, usado pelos filtros (evita chamada extra à API a cada filtro).
let meusJogos = [];
// ID do UserGame atualmente aberto no modal de detalhe/edição.
let jogoEmEdicaoId = null;
// Densidade da grade: 'list' | 'medium' | 'large'
// ('small' foi descontinuado — usuários que tinham essa opção salva migram pra 'medium' automaticamente)
let modoVisualizacao = localStorage.getItem('gt-view-mode') || 'medium';
if (modoVisualizacao === 'small') {
    modoVisualizacao = 'medium';
    localStorage.setItem('gt-view-mode', 'medium');
}
// Ordenação atual: 'recent' | 'name-asc' | 'name-desc' | 'score-desc'
let modoOrdenacao = localStorage.getItem('gt-sort-mode') || 'recent';

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');

    // 1. Proteção de rota
    if (!token) {
        window.location.href = '/';
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
    verificarOnboarding();
    document.getElementById('btn-onboarding-save')?.addEventListener('click', () => concluirOnboarding(true));
    document.getElementById('btn-onboarding-skip')?.addEventListener('click', () => concluirOnboarding(false));

    // Recalcula os contadores de "dias jogando" periodicamente, sem precisar
    // recarregar a página (usa o cache local, não faz nenhuma chamada à API).
    setInterval(aplicarFiltros, 5 * 60 * 1000);

    // Textos gerados via JS (status do card, etc.) não são atualizados pelo
    // GT_I18N.apply() automático — precisam re-renderizar a grade.
    document.addEventListener('gt:langchange', () => carregarMeusJogos());
});

// --- Onboarding: pergunta nome de exibição + IDs de plataforma só no primeiro acesso ---
async function verificarOnboarding() {
    try {
        const response = await authFetch('/auth/me');
        if (!response.ok) return;
        const user = await response.json();
        if (user.onboarding_completed) return;

        // Pré-preenche caso o usuário já tenha algo salvo (ex: veio de um cadastro antigo).
        document.getElementById('onboarding-display-name').value = user.display_name || '';
        document.getElementById('onboarding-psn').value = user.psn_id || '';
        document.getElementById('onboarding-steam').value = user.steam_id || '';
        document.getElementById('onboarding-xbox').value = user.xbox_gamertag || '';
        document.getElementById('onboarding-switch').value = user.nintendo_switch_id || '';

        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalOnboarding')).show();
    } catch (error) {
        console.error('Erro ao verificar onboarding:', error);
    }
}

async function concluirOnboarding(comDados) {
    const payload = { onboarding_completed: true };
    if (comDados) {
        payload.display_name = document.getElementById('onboarding-display-name').value.trim() || null;
        payload.psn_id = document.getElementById('onboarding-psn').value.trim() || null;
        payload.steam_id = document.getElementById('onboarding-steam').value.trim() || null;
        payload.xbox_gamertag = document.getElementById('onboarding-xbox').value.trim() || null;
        payload.nintendo_switch_id = document.getElementById('onboarding-switch').value.trim() || null;
    }
    try {
        await authFetch('/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error('Erro ao salvar onboarding:', error);
    } finally {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalOnboarding')).hide();
    }
}

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

// --- Helper: data de "hoje" no fuso horário LOCAL do dispositivo ---
// `new Date().toISOString()` converte o horário atual para UTC antes de
// formatar — em fusos atrás de UTC (ex.: Brasil, UTC-3), isso faz o valor
// "virar" para o dia seguinte várias horas antes da meia-noite local (a
// partir das ~21h no Brasil). Isso fazia campos de data pré-preenchidos com
// "hoje" mostrarem o dia de amanhã, e podia gerar comparações de data erradas
// (jogada validada como "fim antes do início" mesmo sendo o mesmo dia local),
// de forma dependente do fuso horário e do horário exato de cada dispositivo.
function obterDataLocalHoje() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// --- Contador de dias jogando / concluído (item 1) ---

// Conta os dias entre o início do jogo e uma data de referência (hoje, se não
// finalizado), contando o próprio dia de início como "dia 1" — assim, quem
// começou hoje já vê "jogando há 1 dia" em vez de "0 dias".
function calcularDiasDeJogo(dataInicioStr, dataFimStr) {
    const inicio = new Date(`${dataInicioStr}T00:00:00`);
    const fimRef = dataFimStr ? new Date(`${dataFimStr}T00:00:00`) : new Date(new Date().toDateString());
    // Diferença em dias de calendário local (não em horas/86400000) — assim,
    // mudanças de horário de verão na região do usuário nunca derrubam a
    // contagem por causa de uma hora a mais/a menos naquele dia.
    const diffDias = Math.round(
        (Date.UTC(fimRef.getFullYear(), fimRef.getMonth(), fimRef.getDate()) -
         Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())) / 86400000
    );
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
        window.location.href = '/';
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

// --- Alterna entre os modos de densidade da grade (lista/médio/grande), estilo Google Drive ---
const ICONE_POR_MODO = {
    list: 'bi-list-ul',
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
            const hoje = obterDataLocalHoje();
            resultsDiv.innerHTML = jogos.map((jogo, idx) => `
                <div class="col-12 mb-2">
                    <div class="card p-2 bg-dark text-white border-secondary" id="game-result-card-${idx}">
                        <div class="d-flex flex-row align-items-center">
                            ${jogo.cover_url
                                ? `<img src="${jogo.cover_url}" style="width: 50px; height: 50px; object-fit: contain; background-color: var(--gt-void);" class="rounded" alt="Capa">`
                                : '<div style="width:50px;height:50px;" class="rounded bg-secondary d-flex align-items-center justify-content-center"><i class="bi bi-controller"></i></div>'}
                            <div class="ms-3 flex-fill" style="min-width: 0;">
                                <h6 class="mb-0 text-white text-truncate">${escapeHtml(jogo.title)}</h6>
                                <small class="text-white-50">${escapeHtml(gtTranslateGenre(jogo.genre) || '')}</small>
                            </div>
                            <button class="btn btn-sm btn-primary ms-auto flex-shrink-0" style="background-color: var(--gt-accent); border-color: var(--gt-accent);"
                                    onclick="prepararAdicaoJogo('${jogo.external_id}', ${idx})" data-i18n="addGame.addBtn">Adicionar</button>
                        </div>
                        <div class="d-none mt-2 pt-2 border-top border-secondary d-flex flex-wrap align-items-end gap-2" id="game-result-dateform-${idx}">
                            <div class="flex-fill" style="min-width: 140px;">
                                <label class="form-label small text-white-50 mb-1" data-i18n="addGame.startDateLabel">Quando você começou a jogar?</label>
                                <input type="date" class="form-control form-control-sm" id="game-result-date-${idx}" max="${hoje}" value="${hoje}">
                            </div>
                            <button class="btn btn-gt-primary btn-sm" id="game-result-confirm-${idx}" data-i18n="common.confirm">Confirmar</button>
                            <button class="btn btn-gt-outline btn-sm" onclick="cancelarAdicaoJogo(${idx})" data-i18n="common.cancel">Cancelar</button>
                        </div>
                    </div>
                </div>
            `).join('');
            GT_I18N.apply(resultsDiv);
            resultados_busca_atual = jogos;
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

let resultados_busca_atual = [];

// Ao clicar "Adicionar", revela um miniformulário pedindo a data em que o
// usuário começou a jogar (por padrão hoje, mas editável e nunca no futuro) —
// em vez de já cadastrar o jogo direto com a data de hoje fixa.
function prepararAdicaoJogo(externalId, idx) {
    document.getElementById(`game-result-dateform-${idx}`).classList.remove('d-none');
    const btnConfirmar = document.getElementById(`game-result-confirm-${idx}`);
    btnConfirmar.onclick = () => {
        const dataInicio = document.getElementById(`game-result-date-${idx}`).value || null;
        adicionarJogo(externalId, dataInicio, btnConfirmar);
    };
}

function cancelarAdicaoJogo(idx) {
    document.getElementById(`game-result-dateform-${idx}`).classList.add('d-none');
}

// --- Função: Adicionar Jogo à Biblioteca ---
async function adicionarJogo(externalId, dataInicio, btnElement) {
    btnElement.disabled = true;
    btnElement.innerText = GT_I18N.t('addGame.addingBtn') || 'Adicionando...';

    try {
        const response = await authFetch('/games/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ external_id: externalId, platform: null, started_at: dataInicio })
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
            btnElement.innerText = GT_I18N.t('common.confirm') || 'Confirmar';
        } else {
            const data = await response.json().catch(() => ({}));
            alert(data.detail || 'Erro ao adicionar o jogo.');
            btnElement.disabled = false;
            btnElement.innerText = GT_I18N.t('common.confirm') || 'Confirmar';
        }
    } catch (error) {
        console.error('Erro na requisição:', error);
        btnElement.disabled = false;
        btnElement.innerText = GT_I18N.t('common.confirm') || 'Confirmar';
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

    // Campos de tempo (horas jogadas / tempo de sessão) no formato hh:mm.
    document.querySelectorAll('.gt-hhmm-input').forEach(aplicarMascaraHHMM);
}

/**
 * Converte um valor decimal de horas (ex.: 12.5) para o formato "hh:mm"
 * (ex.: "12:30") exibido no campo.
 */
function decimalParaHHMM(decimal) {
    if (decimal === null || decimal === undefined || decimal === '' || isNaN(Number(decimal))) return '';
    return minutosParaHHMM(Math.round(Number(decimal) * 60));
}

/** Converte um total de minutos (int) para o formato "hh:mm". */
function minutosParaHHMM(totalMinutos) {
    if (totalMinutos === null || totalMinutos === undefined || isNaN(Number(totalMinutos))) return '';
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${horas}:${String(minutos).padStart(2, '0')}`;
}

/**
 * Converte o texto digitado no campo (formato "hh:mm") de volta pro total de
 * minutos. Aceita também só um número solto (ex.: "12" vira 12h = 720min).
 */
function hhmmParaMinutos(texto) {
    if (!texto) return null;
    const valor = texto.trim();
    if (!valor) return null;

    const partes = valor.match(/^(\d{1,4}):([0-5]?\d)$/);
    if (partes) {
        const horas = parseInt(partes[1], 10);
        const minutos = parseInt(partes[2], 10);
        return (horas * 60) + minutos;
    }

    const numero = parseFloat(valor.replace(',', '.'));
    return isNaN(numero) ? null : Math.round(numero * 60);
}

/** Mesma conversão de hhmmParaMinutos, mas devolvendo horas decimais (pra API). */
function hhmmParaDecimal(texto) {
    const minutos = hhmmParaMinutos(texto);
    return minutos === null ? null : minutos / 60;
}

/**
 * Liga uma máscara simples de "hh:mm" a um <input type="text">: o usuário
 * digita só números (ex.: "1230") e o campo formata sozinho como "12:30".
 * Também aceita digitar os dois pontos manualmente sem quebrar a formatação.
 */
function aplicarMascaraHHMM(input) {
    input.addEventListener('input', () => {
        let digitos = input.value.replace(/[^\d]/g, '');
        if (digitos.length === 0) {
            input.value = '';
            return;
        }
        if (digitos.length <= 2) {
            input.value = digitos;
            return;
        }
        const minutos = digitos.slice(-2);
        const horas = digitos.slice(0, -2);
        input.value = `${horas}:${minutos}`;
    });

    input.addEventListener('blur', () => {
        if (!input.value.trim()) return;
        input.value = minutosParaHHMM(hhmmParaMinutos(input.value));
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
function truncarDescricao(texto) {
    if (!texto) return 'Sem descrição disponível para este jogo.';
    return texto;
}

// Depois de preencher a descrição, verifica se o texto realmente ultrapassa
// o espaço reservado (o "resumo" mantém sempre o mesmo tamanho) — só então
// mostra o botão "Saiba mais". Precisa rodar depois do layout do modal estar
// pronto (por isso o duplo requestAnimationFrame), senão scrollHeight/clientHeight
// podem vir zerados enquanto o modal ainda está sendo exibido.
function atualizarBotaoSaibaMais() {
    const wrapper = document.getElementById('detail-description-wrapper');
    const btn = document.getElementById('btn-toggle-description');
    wrapper.classList.remove('gt-expanded');
    btn.textContent = GT_I18N.t('detail.readMore');
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const transbordando = wrapper.scrollHeight > wrapper.clientHeight + 2;
            btn.classList.toggle('d-none', !transbordando);
        });
    });
}

document.getElementById('btn-toggle-description')?.addEventListener('click', () => {
    const wrapper = document.getElementById('detail-description-wrapper');
    const btn = document.getElementById('btn-toggle-description');
    const expandido = wrapper.classList.toggle('gt-expanded');
    btn.textContent = expandido ? GT_I18N.t('detail.readLess') : GT_I18N.t('detail.readMore');
});

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
    atualizarBotaoSaibaMais();

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

    const hojeISO = obterDataLocalHoje();
    const inputInicio = document.getElementById('detail-start-date');
    const inputFim = document.getElementById('detail-end-date');
    inputInicio.max = hojeISO;
    inputFim.max = hojeISO;
    inputInicio.value = item.start_date || '';
    inputFim.value = item.end_date || '';
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
    document.getElementById('detail-hours-played').value = decimalParaHHMM(item.hours_played);
    document.getElementById('detail-time-to-beat-main').value = decimalParaHHMM(item.time_to_beat_main) || '—';
    document.getElementById('detail-time-to-beat-100').value = decimalParaHHMM(item.time_to_beat_completionist) || '—';

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
        is_favorite: document.getElementById('detail-favorite').checked,
        graphics_score: Number(document.getElementById('stars-graphics').dataset.score) || null,
        sound_score: Number(document.getElementById('stars-sound').dataset.score) || null,
        gameplay_score: Number(document.getElementById('stars-gameplay').dataset.score) || null,
        difficulty_score: Number(document.getElementById('stars-difficulty').dataset.score) || null,
        hours_played: hhmmParaDecimal(document.getElementById('detail-hours-played').value),
    };

    // Se a pessoa editou "Data de início" e/ou "Data de finalização" direto
    // por aqui (em vez de usar o botão de editar de uma jogada específica no
    // histórico), aplicamos a mudança na jogada certa: a mais antiga (início)
    // ou a mais recente/em andamento (fim) — sem isso, essas datas ficariam
    // "soltas" de novo e o card voltaria a dessincronizar do histórico.
    const item = meusJogos.find(g => g.id === jogoEmEdicaoId);
    const novaDataInicio = document.getElementById('detail-start-date').value || null;
    const novaDataFim = document.getElementById('detail-end-date').value || null;
    const sessoesOrdenadas = (item?.sessions || []).slice().sort((a, b) => (a.started_at < b.started_at ? -1 : 1));

    if (sessoesOrdenadas.length) {
        const primeira = sessoesOrdenadas[0];
        const ultima = sessoesOrdenadas[sessoesOrdenadas.length - 1];

        const inicioMudou = novaDataInicio && novaDataInicio !== primeira.started_at;
        const fimMudou = novaDataFim !== (ultima.finished_at || null) && (novaDataFim || ultima.finished_at);

        // IMPORTANTE: quando início e fim mudam ao mesmo tempo NA MESMA sessão
        // (caso comum quando só existe 1 sessão), as duas mudanças precisam ir
        // juntas numa ÚNICA requisição. Mandar em duas chamadas separadas pode
        // fazer a primeira (ex: só o novo início) ser rejeitada por comparar
        // contra a data de fim ANTIGA — mesmo que o resultado final, com as
        // duas datas novas, seja perfeitamente válido.
        if (inicioMudou && fimMudou && primeira.id === ultima.id) {
            const r = await authFetch(`/games/${jogoEmEdicaoId}/sessions/${primeira.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ started_at: novaDataInicio, finished_at: novaDataFim }),
            });
            if (!r.ok) {
                const data = await r.json().catch(() => ({}));
                alert(data.detail || GT_I18N.t('detail.sessionError'));
                return;
            }
        } else {
            if (inicioMudou) {
                const r = await authFetch(`/games/${jogoEmEdicaoId}/sessions/${primeira.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ started_at: novaDataInicio }),
                });
                if (!r.ok) {
                    const data = await r.json().catch(() => ({}));
                    alert(data.detail || GT_I18N.t('detail.sessionError'));
                    return;
                }
            }
            if (fimMudou) {
                const r = await authFetch(`/games/${jogoEmEdicaoId}/sessions/${ultima.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ finished_at: novaDataFim }),
                });
                if (!r.ok) {
                    const data = await r.json().catch(() => ({}));
                    alert(data.detail || GT_I18N.t('detail.sessionError'));
                    return;
                }
            }
        }
    }

    const sucesso = await atualizarJogo(jogoEmEdicaoId, payload);
    if (sucesso) {
        const modalElement = document.getElementById('modalGameDetail');
        bootstrap.Modal.getInstance(modalElement)?.hide();
        carregarMeusJogos();
    } else {
        alert('Não foi possível salvar as alterações.');
    }
}

// Formata uma sessão de jogo pro histórico, já separada em colunas (datas /
// tempo) — o HTML monta essas partes num grid pra tudo ficar alinhado.
function formatarPeriodoSessao(sessao) {
    const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString();
    const tempo = sessao.duration_minutes ? minutosParaHHMM(sessao.duration_minutes) : '';
    let datas;
    if (!sessao.finished_at) {
        datas = `${fmt(sessao.started_at)} — ${GT_I18N.t('status.playing')}`;
    } else if (sessao.started_at === sessao.finished_at) {
        datas = fmt(sessao.started_at);
    } else {
        datas = `${fmt(sessao.started_at)} → ${fmt(sessao.finished_at)}`;
    }
    return { datas, tempo };
}

const SESSOES_POR_PAGINA = 10;
let _historicoOrdenacao = 'recentes';
let _historicoPaginaAtual = 1;

// Desenha os botões de ação (Jogar novamente / Finalizar esta jogada), o
// filtro de ordenação e a lista de histórico de jogadas — paginada de 10 em
// 10, cada uma com data de início, fim, tempo opcional e um botão de editar.
function renderizarHistoricoJogadas(item, manterPagina = false) {
    if (!manterPagina) _historicoPaginaAtual = 1;

    const todasSessoes = (item.sessions || []).slice().sort((a, b) => {
        const diff = a.started_at < b.started_at ? -1 : (a.started_at > b.started_at ? 1 : 0);
        return _historicoOrdenacao === 'recentes' ? -diff : diff;
    });
    const sessaoAberta = todasSessoes.find(s => !s.finished_at);
    const acoes = document.getElementById('detail-session-actions');
    const historico = document.getElementById('detail-session-history');
    const sortSelect = document.getElementById('detail-session-sort');
    if (sortSelect) sortSelect.value = _historicoOrdenacao;

    if (sessaoAberta) {
        acoes.innerHTML = `
            <button type="button" class="btn btn-gt-primary btn-sm" id="btn-finish-session" data-session-id="${sessaoAberta.id}">
                <i class="bi bi-check-lg me-1"></i><span data-i18n="detail.finishSession">Finalizar esta jogada</span>
            </button>`;
        document.getElementById('btn-finish-session').addEventListener('click', () => abrirFormularioSessao('finish', sessaoAberta));
    } else {
        acoes.innerHTML = `
            <button type="button" class="btn btn-gt-outline btn-sm" id="btn-play-again">
                <i class="bi bi-plus-lg me-1"></i><span data-i18n="detail.logSession">Jogar novamente</span>
            </button>`;
        document.getElementById('btn-play-again').addEventListener('click', () => abrirFormularioSessao('start'));
    }
    GT_I18N.apply(acoes);

    if (todasSessoes.length === 0) {
        historico.innerHTML = '';
        document.getElementById('detail-session-pagination').classList.add('d-none');
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(todasSessoes.length / SESSOES_POR_PAGINA));
    _historicoPaginaAtual = Math.min(Math.max(1, _historicoPaginaAtual), totalPaginas);
    const inicio = (_historicoPaginaAtual - 1) * SESSOES_POR_PAGINA;
    const sessoesDaPagina = todasSessoes.slice(inicio, inicio + SESSOES_POR_PAGINA);

    historico.innerHTML = sessoesDaPagina.map(s => {
        const { datas, tempo } = formatarPeriodoSessao(s);
        return `
        <li class="gt-session-row">
            <span class="gt-session-row__dates"><i class="bi bi-calendar3 me-1"></i>${datas}</span>
            <span class="gt-session-row__time">${tempo}</span>
            <button type="button" class="btn btn-link btn-sm text-white-50 p-0 gt-session-row__edit gt-session-edit-btn" data-session-id="${s.id}" title="${GT_I18N.t('detail.editSession')}">
                <i class="bi bi-pencil-square"></i>
            </button>
        </li>`;
    }).join('');

    historico.querySelectorAll('.gt-session-edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const sessao = todasSessoes.find(s => s.id === Number(btn.dataset.sessionId));
            if (sessao) abrirFormularioSessao('edit', sessao);
        });
    });

    renderizarPaginacaoHistorico(totalPaginas, item);
}

function renderizarPaginacaoHistorico(totalPaginas, item) {
    const nav = document.getElementById('detail-session-pagination');
    const lista = nav.querySelector('ul');

    if (totalPaginas <= 1) {
        nav.classList.add('d-none');
        lista.innerHTML = '';
        return;
    }
    nav.classList.remove('d-none');

    const pagina = _historicoPaginaAtual;
    const item_ = (rotulo, alvo, desabilitado, ativo = false) => `
        <li class="page-item ${desabilitado ? 'disabled' : ''} ${ativo ? 'active' : ''}">
            <button type="button" class="page-link" data-pagina="${alvo}" ${desabilitado ? 'tabindex="-1"' : ''}>${rotulo}</button>
        </li>`;

    let html = '';
    html += item_('«', 1, pagina === 1);
    html += item_('‹', pagina - 1, pagina === 1);
    for (let p = 1; p <= totalPaginas; p++) {
        html += item_(String(p), p, false, p === pagina);
    }
    html += item_('›', pagina + 1, pagina === totalPaginas);
    html += item_('»', totalPaginas, pagina === totalPaginas);

    lista.innerHTML = html;
    lista.querySelectorAll('.page-link:not([tabindex])').forEach((btn) => {
        btn.addEventListener('click', () => {
            _historicoPaginaAtual = Number(btn.dataset.pagina);
            renderizarHistoricoJogadas(item, true);
        });
    });
}

document.getElementById('detail-session-sort')?.addEventListener('change', (e) => {
    _historicoOrdenacao = e.target.value;
    _historicoPaginaAtual = 1;
    const item = meusJogos.find(g => g.id === jogoEmEdicaoId);
    if (item) renderizarHistoricoJogadas(item, true);
});

let _sessaoFormModo = null;   // 'start' | 'finish' | 'edit'
let _sessaoFormId = null;     // id da sessão (usado em 'finish'/'edit')

function abrirFormularioSessao(modo, sessao = null) {
    _sessaoFormModo = modo;
    _sessaoFormId = sessao ? sessao.id : null;

    const form = document.getElementById('detail-session-form');
    const label = document.getElementById('detail-session-form-label');
    const inicioInput = document.getElementById('detail-session-date-input');
    const fimWrapper = document.getElementById('detail-session-finish-wrapper');
    const fimInput = document.getElementById('detail-session-finish-input');
    const duracaoInput = document.getElementById('detail-session-duration-input');

    const hoje = obterDataLocalHoje();
    // Datas retroativas são permitidas (controle de jogos já jogados), mas
    // NUNCA no futuro — o atributo max do <input type="date"> já bloqueia
    // isso na própria UI, além da validação que o backend também faz.
    inicioInput.max = hoje;
    fimInput.max = hoje;

    if (modo === 'start') {
        label.textContent = GT_I18N.t('detail.startDate');
        inicioInput.value = hoje;
        inicioInput.disabled = false;

        // Limpa o campo de fim e seu "min": antes, ao só esconder (d-none),
        // um valor de uma sessão 'finish'/'edit' anterior ficava preso aqui
        // e era lido na validação, disparando o erro de data por engano.
        fimInput.value = '';
        fimInput.min = '';
        fimWrapper.classList.add('d-none');

        duracaoInput.value = '';
    } else if (modo === 'finish') {
        label.textContent = GT_I18N.t('detail.startDate');
        inicioInput.value = sessao.started_at;
        inicioInput.disabled = true; // ao finalizar, a data de início já é fixa (veio da jogada aberta)
        fimInput.min = sessao.started_at;
        fimInput.value = hoje;
        fimWrapper.classList.remove('d-none');
        duracaoInput.value = sessao.duration_minutes ? minutosParaHHMM(sessao.duration_minutes) : '';
    } else { // 'edit': permite corrigir tudo, inclusive reabrir (limpar a data de fim)
        label.textContent = GT_I18N.t('detail.startDate');
        inicioInput.disabled = false;
        inicioInput.value = sessao.started_at;
        fimInput.min = sessao.started_at;
        fimInput.value = sessao.finished_at || '';
        fimWrapper.classList.remove('d-none');
        duracaoInput.value = sessao.duration_minutes ? minutosParaHHMM(sessao.duration_minutes) : '';
    }

    form.classList.remove('d-none');
}

function fecharFormularioSessao() {
    const form = document.getElementById('detail-session-form');
    const inicioInput = document.getElementById('detail-session-date-input');
    const fimInput = document.getElementById('detail-session-finish-input');
    const duracaoInput = document.getElementById('detail-session-duration-input');

    form.classList.add('d-none');
    inicioInput.disabled = false;
    inicioInput.value = '';
    fimInput.value = '';
    fimInput.min = '';
    fimInput.max = '';
    duracaoInput.value = '';

    _sessaoFormModo = null;
    _sessaoFormId = null;
}

async function confirmarFormularioSessao() {
    if (!jogoEmEdicaoId || !_sessaoFormModo) return;

    const inicio = document.getElementById('detail-session-date-input').value || null;
    const fim = document.getElementById('detail-session-finish-input').value || null;
    const duracaoMin = hhmmParaMinutos(document.getElementById('detail-session-duration-input').value);

    if (fim && inicio && fim < inicio) {
        alert(GT_I18N.t('detail.sessionDateOrderError'));
        return;
    }

    try {
        let response;
        if (_sessaoFormModo === 'start') {
            response = await authFetch(`/games/${jogoEmEdicaoId}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ started_at: inicio }),
            });
        } else if (_sessaoFormModo === 'finish') {
            response = await authFetch(`/games/${jogoEmEdicaoId}/sessions/${_sessaoFormId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ finished_at: fim, duration_minutes: duracaoMin }),
            });
        } else { // 'edit'
            response = await authFetch(`/games/${jogoEmEdicaoId}/sessions/${_sessaoFormId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ started_at: inicio, finished_at: fim, duration_minutes: duracaoMin }),
            });
        }
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            alert(data.detail || GT_I18N.t('detail.sessionError'));
            return;
        }
        const atualizado = await response.json();
        document.getElementById('detail-play-count').textContent = atualizado.play_count;
        document.getElementById('detail-start-date').value = atualizado.start_date || '';
        document.getElementById('detail-end-date').value = atualizado.end_date || '';
        const duracaoWrapper = document.getElementById('detail-duration-wrapper');
        const duracao = obterTextoDuracao(atualizado);
        if (duracao) {
            document.getElementById('detail-duration-title').textContent = duracao.titulo;
            document.getElementById('detail-duration-subtitle').textContent = duracao.subtitulo || '';
            duracaoWrapper.classList.remove('d-none');
        } else {
            duracaoWrapper.classList.add('d-none');
        }
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
        document.getElementById('detail-time-to-beat-main').value = decimalParaHHMM(atualizado.time_to_beat_main) || '—';
        document.getElementById('detail-time-to-beat-100').value = decimalParaHHMM(atualizado.time_to_beat_completionist) || '—';
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
    window.location.href = '/';
}
