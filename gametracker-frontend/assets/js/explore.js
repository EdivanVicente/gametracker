const API_BASE = 'http://127.0.0.1:8000';

function escapeHtml(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('explore-btn');
    const input = document.getElementById('explore-input');
    const resultDiv = document.getElementById('explore-result');

    const buscar = async (tituloForcado) => {
        const titulo = (tituloForcado ?? input.value).trim();
        if (titulo.length < 2) return;

        input.value = titulo;
        resultDiv.innerHTML = '<p class="text-white-50 text-center py-5">Buscando...</p>';

        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${API_BASE}/explore/gameplay?title=${encodeURIComponent(titulo)}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                window.location.href = 'index.html';
                return;
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                resultDiv.innerHTML = `<p class="text-danger text-center py-5">${escapeHtml(data.detail || 'Erro ao buscar.')}</p>`;
                return;
            }

            const data = await response.json();
            renderResultado(data, titulo);
        } catch (error) {
            resultDiv.innerHTML = '<p class="text-danger text-center py-5">Erro de conexão com o servidor.</p>';
        }
    };

    btn.addEventListener('click', () => buscar());
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscar();
        }
    });

    // Chips de sugestão: clicar já dispara a busca com aquele jogo.
    document.querySelectorAll('.gt-suggestion-chip').forEach(chip => {
        chip.addEventListener('click', () => buscar(chip.dataset.jogo));
    });
});

function renderResultado(data, tituloBuscado) {
    const resultDiv = document.getElementById('explore-result');
    const jogo = data.game;
    const video = data.video;

    if (!jogo && !video) {
        resultDiv.innerHTML = `
            <p class="text-white-50 text-center py-3 mb-2">Nenhuma informação encontrada na nossa base para "${escapeHtml(tituloBuscado)}".</p>
            <div class="text-center">
                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(tituloBuscado + ' gameplay')}"
                   target="_blank" rel="noopener noreferrer" class="gt-gameplay-channel-link d-inline-flex">
                    <i class="bi bi-youtube"></i> Buscar "${escapeHtml(tituloBuscado)}" no YouTube <i class="bi bi-box-arrow-up-right"></i>
                </a>
            </div>
        `;
        return;
    }

    const plataformas = (jogo?.platforms || []);
    const badgesPlataformas = plataformas.length
        ? plataformas.map(p => `<span class="gt-platform-badge">${escapeHtml(p)}</span>`).join('')
        : '';

    resultDiv.innerHTML = `
        <div class="gt-card p-3 mb-4">
            <div class="gt-detail-cover mb-3">
                ${jogo?.cover_url ? `<img src="${jogo.cover_url}" alt="${escapeHtml(jogo?.title || '')}">` : '<i class="bi bi-controller"></i>'}
            </div>
            <h3 class="gt-card-title mb-1">${escapeHtml(jogo?.title || 'Jogo não encontrado na base')}</h3>
            <p class="gt-detail-genre mb-2">${escapeHtml(jogo?.genre || '')}</p>
            <div class="row g-4">
                <div class="col-12 col-md-6">
                    <p class="small mb-2">${jogo?.description ? escapeHtml(jogo.description.split(/\s+/).slice(0, 50).join(' ')) + '…' : 'Sem descrição disponível para este jogo.'}</p>
                    <div class="d-flex flex-wrap gap-1">${badgesPlataformas}</div>
                </div>
                <div class="col-12 col-md-6">
                    <p class="small text-white-50 mb-2">Gameplay</p>
                    <div id="explore-video-wrapper"></div>
                </div>
            </div>
        </div>
    `;

    renderizarGameplay(document.getElementById('explore-video-wrapper'), data.videos || (video ? [video] : []), tituloBuscado);
}
