/**
 * Dashboard JavaScript - Gerencia a interação do utilizador com a API
 */

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');

    // 1. Proteção de rota
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Inicializa as funções da página
    setupSearch();
    carregarMeusJogos();
});

// --- Helper: Sanitização para evitar XSS ---
function escapeHtml(unsafe) {
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- Helper: Requisição Autenticada ---
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const response = await fetch(url, options);

    if (response.status === 401) {
        alert("Sua sessão expirou. Faça login novamente.");
        logout();
        throw new Error("Unauthorized");
    }
    return response;
}

// --- Função: Carregar os jogos salvos ---
async function carregarMeusJogos() {
    const grid = document.getElementById('games-grid');

    try {
        const response = await authFetch('http://127.0.0.1:8000/games/');
        const jogos = await response.json();
            
        if (jogos.length === 0) {
            grid.innerHTML = '<p class="text-white text-center mt-5">Ainda não adicionou nenhum jogo à sua biblioteca.</p>';
            return;
        }

        grid.innerHTML = jogos.map(game => `
            <div class="col-12 col-sm-6 col-md-4 col-xl-3 col-xxl-2">
                <article class="gt-card">
                    <div class="gt-card-status ${game.status === 'playing' ? 'is-playing' : 'is-finished'}">
                        ${game.status === 'playing' ? 'Em andamento' : 'Finalizado'}
                    </div>
                    <button class="gt-card-favorite ${game.is_favorite ? 'is-active' : ''}">
                        <i class="bi bi-heart${game.is_favorite ? '-fill' : ''}"></i>
                    </button>
                    <div class="gt-card-cover"><i class="bi bi-controller"></i></div>
                    <div class="gt-card-body">
                        <h3 class="gt-card-title mb-0">${escapeHtml(game.title)}</h3>
                        <p class="gt-card-meta">${escapeHtml(game.platform)} · ${escapeHtml(game.genre)}</p>
                        <div class="gt-card-scores">
                            <span>Grf <span class="gt-score-value">${game.score_graphics}</span></span>
                            <span>Som <span class="gt-score-value">${game.score_sound}</span></span>
                            <span>Jog <span class="gt-score-value">${game.score_gameplay}</span></span>
                            <span>Dif <span class="gt-score-value">${game.score_difficulty}</span></span>
                        </div>
                    </div>
                </article>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar jogos:', error);
    }
}

// --- Função: Lógica de Pesquisa ---
function setupSearch() {
    const searchBtn = document.getElementById('game-search-btn');
    const searchInput = document.getElementById('game-search-input');
    const resultsDiv = document.getElementById('game-search-results');

    if (!searchBtn) return;

    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value;
        if (query.length < 2) return;

        resultsDiv.innerHTML = '<p class="text-white text-center">A procurar...</p>';

        try {
            const response = await authFetch(`http://127.0.0.1:8000/games/search?q=${encodeURIComponent(query)}`);
            const jogos = await response.json();
            
            if (jogos.length === 0) {
                resultsDiv.innerHTML = '<p class="text-white">Nenhum jogo encontrado.</p>';
                return;
            }

            resultsDiv.innerHTML = jogos.map(jogo => `
                <div class="col-12 mb-2">
                    <div class="card p-2 d-flex flex-row align-items-center bg-dark text-white border-secondary">
                        <img src="${escapeHtml(jogo.cover_url || '')}" style="width: 50px; height: 50px; object-fit: cover;" class="rounded" alt="Capa">
                        <div class="ms-3">
                            <h6 class="mb-0 text-white">${escapeHtml(jogo.title)}</h6>
                        </div>
                        <button class="btn btn-sm btn-primary ms-auto" onclick="adicionarJogo('${jogo.external_id}', this)" style="background-color: var(--gt-accent); border-color: var(--gt-accent);">Adicionar</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            resultsDiv.innerHTML = '<p class="text-danger">Erro ao pesquisar.</p>';
        }
    });
}

// --- Função: Adicionar Jogo à Biblioteca ---
async function adicionarJogo(gameId, btnElement) {
    // Feedback visual de carregamento
    btnElement.disabled = true;
    btnElement.innerText = "Adicionando...";
    
    try {
        const response = await authFetch('http://127.0.0.1:8000/games/', {
            method: 'POST',
            body: JSON.stringify({ game_id: gameId }) 
        });

        if (response.ok) {
            alert("Jogo adicionado com sucesso!");
            carregarMeusJogos();
            
            const modalElement = document.getElementById('modalAddGame');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                modal?.hide();
            }
        } else {
            alert("Erro ao adicionar o jogo.");
            btnElement.disabled = false;
            btnElement.innerText = "Adicionar";
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        btnElement.disabled = false;
        btnElement.innerText = "Adicionar";
    }
}

// --- Função: Logoff ---
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

// Dentro da sua função setupSearch ou onde você processa o retorno da busca
const jogos = await response.json();
console.log("Dados do jogo recebidos:", jogos); // <--- ADICIONE ISSO