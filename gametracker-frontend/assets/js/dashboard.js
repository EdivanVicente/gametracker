/**
 * Dashboard JavaScript - Gerencia a interação do utilizador com a API
 */

const API_BASE = 'http://127.0.0.1:8000';

// Cache local da última lista carregada, usado pelos filtros (evita chamada extra à API a cada filtro).
let meusJogos = [];
// ID do UserGame atualmente aberto no modal de detalhe/edição.
let jogoEmEdicaoId = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');

    // 1. Proteção de rota
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Inicializa as funções da página
    setupSearch();
    setupFilters();
    setupDetailModal();
    aplicarFiltroDaUrl();
    carregarMeusJogos();
});

// --- Helper: Sanitização para evitar XSS ---
function escapeHtml(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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
        btnFavoritos.classList.add('active');
    }
    // 'todos' não precisa de nada — todos os filtros já começam vazios.
}

// --- Função: Carregar os jogos salvos ---
async function carregarMeusJogos() {
    const grid = document.getElementById('games-grid');

    try {
        const response = await authFetch('/games/');

        if (!response.ok) {
            grid.innerHTML = '<p class="text-danger text-center mt-5">Não foi possível carregar sua biblioteca.</p>';
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

    grid.innerHTML = jogos.map(item => {
        const jogo = item.game;
        const rating = item.rating || {};
        const isPlaying = item.status === 'playing';

        return `
        <div class="col-12 col-sm-6 col-md-4 col-xl-3 col-xxl-2">
          <article class="gt-card" data-id="${item.id}" style="cursor: pointer;">
            <div class="gt-card-status ${isPlaying ? 'is-playing' : 'is-finished'}">
                ${isPlaying ? 'Em andamento' : 'Finalizado'}
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
              <p class="gt-card-meta">${escapeHtml(item.platform || '—')} · ${escapeHtml(jogo.genre || '—')}</p>
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

    // Clique no card (fora do botão de favorito) abre o modal de edição/avaliação.
    grid.querySelectorAll('.gt-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.gt-card-favorite')) return;
            abrirDetalhe(Number(card.dataset.id));
        });
    });

    // Botão de favorito em cada card: alterna sem precisar abrir o modal.
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
                            ? `<img src="${jogo.cover_url}" style="width: 50px; height: 50px; object-fit: cover;" class="rounded" alt="Capa">`
                            : '<div style="width:50px;height:50px;" class="rounded bg-secondary d-flex align-items-center justify-content-center"><i class="bi bi-controller"></i></div>'}
                        <div class="ms-3">
                            <h6 class="mb-0 text-white">${escapeHtml(jogo.title)}</h6>
                            <small class="text-white-50">${escapeHtml(jogo.genre || '')}</small>
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
            carregarMeusJogos();

            const modalElement = document.getElementById('modalAddGame');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                modal?.hide();
            }
            document.getElementById('game-search-input').value = '';
            document.getElementById('game-search-results').innerHTML =
                '<p class="text-white-50 small text-center py-4 mb-0">Digite o nome de um jogo para buscar na base de dados.</p>';
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

    document.getElementById('detail-genre').textContent = jogo.genre || 'Gênero não informado';
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
    document.getElementById('detail-platform').value = item.platform || 'PC';
    document.getElementById('detail-start-date').value = item.start_date || '';
    document.getElementById('detail-end-date').value = item.end_date || '';
    document.getElementById('detail-favorite').checked = !!item.is_favorite;

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

        if (data.video?.embed_url) {
            videoWrapper.innerHTML = `
                <div class="ratio ratio-16x9">
                    <iframe src="${data.video.embed_url}" title="Gameplay" allowfullscreen></iframe>
                </div>
            `;
        } else {
            videoWrapper.innerHTML = '<p class="small text-white-50 mb-0">Nenhum vídeo de gameplay encontrado.</p>';
        }
    } catch (error) {
        videoWrapper.innerHTML = '';
    }
}

async function salvarDetalhe() {
    if (!jogoEmEdicaoId) return;

    const payload = {
        platform: document.getElementById('detail-platform').value,
        start_date: document.getElementById('detail-start-date').value || null,
        end_date: document.getElementById('detail-end-date').value || null,
        is_favorite: document.getElementById('detail-favorite').checked,
        graphics_score: Number(document.getElementById('stars-graphics').dataset.score) || null,
        sound_score: Number(document.getElementById('stars-sound').dataset.score) || null,
        gameplay_score: Number(document.getElementById('stars-gameplay').dataset.score) || null,
        difficulty_score: Number(document.getElementById('stars-difficulty').dataset.score) || null,
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
function setupFilters() {
    const filtroSearch = document.getElementById('filter-search');
    const filtroConsole = document.getElementById('filter-console');
    const filtroGenero = document.getElementById('filter-genre');
    const filtroStatus = document.getElementById('filter-status');
    const filtroNota = document.getElementById('filter-gameplay-score');
    const btnFavoritos = document.getElementById('btn-favorites-only');

    filtroSearch?.addEventListener('input', aplicarFiltros);
    filtroConsole?.addEventListener('change', aplicarFiltros);
    filtroGenero?.addEventListener('change', aplicarFiltros);
    filtroStatus?.addEventListener('change', aplicarFiltros);
    filtroNota?.addEventListener('change', aplicarFiltros);
    btnFavoritos?.addEventListener('click', () => {
        btnFavoritos.classList.toggle('active');
        aplicarFiltros();
    });
}

function aplicarFiltros() {
    const termo = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
    const consoleSel = (document.getElementById('filter-console')?.value || '').toLowerCase();
    const generoSel = (document.getElementById('filter-genre')?.value || '').toLowerCase();
    const statusSel = document.getElementById('filter-status')?.value || '';
    const notaMinima = Number(document.getElementById('filter-gameplay-score')?.value || 0);
    const apenasFavoritos = document.getElementById('btn-favorites-only')?.classList.contains('active');

    const filtrados = meusJogos.filter(item => {
        const jogo = item.game;
        const rating = item.rating || {};

        if (termo && !jogo.title.toLowerCase().includes(termo)) return false;
        if (consoleSel && !(item.platform || '').toLowerCase().includes(consoleSel)) return false;
        if (generoSel && !(jogo.genre || '').toLowerCase().includes(generoSel)) return false;
        if (statusSel && item.status !== statusSel) return false;
        if (notaMinima && (rating.gameplay_score || 0) < notaMinima) return false;
        if (apenasFavoritos && !item.is_favorite) return false;

        return true;
    });

    renderGrid(filtrados);
}

// --- Função: Logoff ---
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}
