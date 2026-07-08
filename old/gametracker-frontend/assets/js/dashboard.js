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

// --- Função: Carregar os jogos salvos ---
async function carregarMeusJogos() {
    const token = localStorage.getItem('token');
    const grid = document.getElementById('games-grid');

    try {
        const response = await fetch('http://127.0.0.1:8000/games/', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const jogos = await response.json();
            
            if (jogos.length === 0) {
                grid.innerHTML = '<p class="text-white text-center mt-5">Ainda não adicionou nenhum jogo à sua biblioteca.</p>';
                return;
            }

            // Renderiza os cards mantendo a estrutura original do seu HTML
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
                            <h3 class="gt-card-title mb-0">${game.title}</h3>
                            <p class="gt-card-meta">${game.platform} · ${game.genre}</p>
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
        }
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
            const response = await fetch(`http://127.0.0.1:8000/games/search?q=${encodeURIComponent(query)}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            
            const jogos = await response.json();
            
            if (jogos.length === 0) {
                resultsDiv.innerHTML = '<p class="text-white">Nenhum jogo encontrado.</p>';
                return;
            }

            resultsDiv.innerHTML = jogos.map(jogo => `
                <div class="col-12 mb-2">
                    <div class="card p-2 d-flex flex-row align-items-center bg-dark text-white">
                        <img src="${jogo.background_image}" style="width: 50px; height: 50px; object-fit: cover;" class="rounded">
                        <div class="ms-3">
                            <h6 class="mb-0">${jogo.name}</h6>
                        </div>
                        <button class="btn btn-sm btn-primary ms-auto" onclick="adicionarJogo('${jogo.id}')">Adicionar</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            resultsDiv.innerHTML = '<p class="text-danger">Erro ao pesquisar.</p>';
        }
    });
}

// --- Função: Adicionar Jogo à Biblioteca ---
// --- Função: Adicionar Jogo à Biblioteca ---
async function adicionarJogo(gameId) {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('http://127.0.0.1:8000/games/', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json' 
            },
            // Certifique-se de que o campo 'game_id' corresponde ao esperado pelo seu Backend
            body: JSON.stringify({ game_id: gameId }) 
        });

        if (response.ok) {
            alert("Jogo adicionado com sucesso!");
            
            // 1. Recarrega a lista para mostrar o novo jogo sem precisar atualizar a página
            carregarMeusJogos();
            
            // 2. Se estiver a usar um modal de busca, fecha-o
            const modalElement = document.getElementById('modalAddGame');
            if (modalElement) {
                const modal = bootstrap.Modal.getInstance(modalElement);
                modal?.hide();
            }
        } else {
            alert("Erro ao adicionar o jogo.");
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        alert("Não foi possível conectar ao servidor.");
    }
}

// --- Função: Logoff ---
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}