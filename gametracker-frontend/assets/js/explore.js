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
            renderResultado(data);
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

function renderResultado(data) {
    const resultDiv = document.getElementById('explore-result');
    const jogo = data.game;
    const video = data.video;

    if (!jogo && !video) {
        resultDiv.innerHTML = '<p class="text-white-50 text-center py-5">Nada encontrado para essa busca.</p>';
        return;
    }

    const plataformas = (jogo?.platforms || []);
    const badgesPlataformas = plataformas.length
        ? plataformas.map(p => `<span class="gt-platform-badge">${escapeHtml(p)}</span>`).join('')
        : '';

    resultDiv.innerHTML = `
        <div class="row g-4">
            <div class="col-12 col-md-5">
                <div class="gt-card p-3">
                    ${jogo?.cover_url ? `<img src="${jogo.cover_url}" class="w-100 rounded mb-3" style="max-height:280px;object-fit:cover;">` : ''}
                    <h3 class="gt-card-title mb-1">${escapeHtml(jogo?.title || 'Jogo não encontrado na base')}</h3>
                    <p class="gt-detail-genre mb-2">${escapeHtml(jogo?.genre || '')}</p>
                    <p class="small text-white-50 mb-2">${jogo?.description ? escapeHtml(jogo.description.split(/\s+/).slice(0, 50).join(' ')) + '…' : ''}</p>
                    <div class="d-flex flex-wrap gap-1">${badgesPlataformas}</div>
                </div>
            </div>
            <div class="col-12 col-md-7">
                <p class="small text-white-50 mb-2">Gameplay</p>
                ${video?.watch_url
                    ? `<a href="${video.watch_url}" target="_blank" rel="noopener noreferrer" class="gt-gameplay-link">
                        <div class="gt-gameplay-thumb">
                            ${video.thumbnail_url ? `<img src="${video.thumbnail_url}" alt="Miniatura do vídeo">` : ''}
                            <div class="gt-gameplay-play"><i class="bi bi-play-fill"></i></div>
                        </div>
                        <div>
                            <div class="gt-gameplay-title">${escapeHtml(video.title || 'Ver gameplay')}</div>
                            <div class="gt-gameplay-channel">${escapeHtml(video.channel_title || '')} · <span class="text-decoration-underline">assistir no YouTube</span></div>
                        </div>
                       </a>`
                    : '<p class="text-white-50 small">Nenhum vídeo de gameplay encontrado (configure a YOUTUBE_API_KEY no .env do backend para habilitar essa parte).</p>'}
            </div>
        </div>
    `;
}
