const API_BASE = 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('explore-btn');
    const input = document.getElementById('explore-input');
    const resultDiv = document.getElementById('explore-result');

    const buscar = async () => {
        const titulo = input.value.trim();
        if (titulo.length < 2) return;

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
                resultDiv.innerHTML = `<p class="text-danger text-center py-5">${data.detail || 'Erro ao buscar.'}</p>`;
                return;
            }

            const data = await response.json();
            renderResultado(data);
        } catch (error) {
            resultDiv.innerHTML = '<p class="text-danger text-center py-5">Erro de conexão com o servidor.</p>';
        }
    };

    btn.addEventListener('click', buscar);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscar();
        }
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

    resultDiv.innerHTML = `
        <div class="row g-4">
            <div class="col-12 col-md-5">
                <div class="gt-card p-3">
                    ${jogo?.cover_url ? `<img src="${jogo.cover_url}" class="w-100 rounded mb-3" style="max-height:280px;object-fit:cover;">` : ''}
                    <h3 class="gt-card-title">${jogo?.title || 'Jogo não encontrado na base'}</h3>
                    <p class="text-white-50 mb-1">${jogo?.genre || ''}</p>
                    <p class="small text-white-50">${jogo?.description ? jogo.description.slice(0, 300) + '…' : ''}</p>
                </div>
            </div>
            <div class="col-12 col-md-7">
                ${video?.embed_url
                    ? `<div class="ratio ratio-16x9 mb-2">
                         <iframe src="${video.embed_url}" title="${video.title || ''}" allowfullscreen></iframe>
                       </div>
                       <p class="small text-white-50 mb-0">${video.title || ''} — ${video.channel_title || ''}</p>`
                    : '<p class="text-white-50">Nenhum vídeo de gameplay encontrado (configure a YOUTUBE_API_KEY no .env do backend para habilitar essa parte).</p>'}
            </div>
        </div>
    `;
}
