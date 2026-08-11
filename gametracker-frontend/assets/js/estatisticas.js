
document.addEventListener('DOMContentLoaded', carregarRelatorios);

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

function escapeHtml(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function carregarRelatorios() {
    try {
        const response = await authFetch('/games/');
        if (!response.ok) return;

        const jogos = await response.json();

        if (jogos.length === 0) {
            document.getElementById('stats-content').classList.add('d-none');
            document.getElementById('stats-empty').classList.remove('d-none');
            return;
        }

        renderResumo(jogos);
        renderBarras('stat-genero', contarPor(jogos, j => gtTranslateGenre(j.game.genre)));
        renderBarras('stat-plataforma', contarPor(jogos, j => j.platform));
        renderNotasMedias(jogos);
        renderTopJogos(jogos);
    } catch (error) {
        console.error('Erro ao carregar relatórios:', error);
    }
}

function renderResumo(jogos) {
    const total = jogos.length;
    const finalizados = jogos.filter(j => j.status === 'finished').length;
    const favoritos = jogos.filter(j => j.is_favorite).length;

    const todasNotas = jogos.flatMap(j => j.rating
        ? [j.rating.graphics_score, j.rating.sound_score, j.rating.gameplay_score, j.rating.difficulty_score]
        : []).filter(n => typeof n === 'number');

    const mediaGeral = todasNotas.length
        ? (todasNotas.reduce((a, b) => a + b, 0) / todasNotas.length).toFixed(1)
        : '-';

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-taxa-conclusao').textContent = `${Math.round((finalizados / total) * 100)}%`;
    document.getElementById('stat-media-geral').textContent = mediaGeral;
    document.getElementById('stat-favoritos').textContent = favoritos;
}

// Agrupa uma lista de UserGame por um campo (gênero, plataforma etc.), contando ocorrências.
function contarPor(jogos, seletor) {
    const contagem = {};
    jogos.forEach(item => {
        const chaveBruta = seletor(item) || GT_I18N.t('stats.notInformed');
        // Gêneros vêm como "Action, Adventure, RPG" da RAWG — considera o primeiro como principal.
        const chave = chaveBruta.split(',')[0].trim();
        contagem[chave] = (contagem[chave] || 0) + 1;
    });
    return Object.entries(contagem).sort((a, b) => b[1] - a[1]);
}

function renderBarras(containerId, entradas) {
    const container = document.getElementById(containerId);
    if (entradas.length === 0) {
        container.innerHTML = `<p class="text-white-50 small mb-0">${GT_I18N.t('stats.notEnoughData')}</p>`;
        return;
    }

    const max = Math.max(...entradas.map(([, valor]) => valor));

    container.innerHTML = entradas.map(([nome, valor]) => `
        <div class="gt-bar-row">
            <span class="gt-bar-label">${escapeHtml(nome)}</span>
            <div class="gt-bar-track"><div class="gt-bar-fill" style="width:${(valor / max) * 100}%"></div></div>
            <span class="gt-bar-value">${valor}</span>
        </div>
    `).join('');
}

// Notas médias por categoria — cada barra é clicável e mostra a lista de
// jogos ordenada pela nota naquela categoria específica (ex: clicar em
// "Gráficos" mostra quais jogos você avaliou melhor/pior em gráficos).
let _jogosParaNotas = [];

function renderNotasMedias(jogos) {
    _jogosParaNotas = jogos;
    const categorias = [
        { chave: 'graphics_score', label: GT_I18N.t('detail.graphics') },
        { chave: 'sound_score', label: GT_I18N.t('detail.sound') },
        { chave: 'gameplay_score', label: GT_I18N.t('detail.gameplay') },
        { chave: 'difficulty_score', label: GT_I18N.t('detail.difficulty') },
    ];

    const entradas = categorias.map(({ chave, label }) => {
        const notas = jogos
            .map(j => j.rating?.[chave])
            .filter(n => typeof n === 'number');
        const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
        return { chave, label, media: Number(media.toFixed(1)) };
    });

    const container = document.getElementById('stat-notas');
    const algumaNota = entradas.some(({ media }) => media > 0);

    if (!algumaNota) {
        container.innerHTML = `<p class="text-white-50 small mb-0">${GT_I18N.t('stats.noRatedGames')}</p>`;
        return;
    }

    container.innerHTML = `
        <p class="small text-white-50 mb-2">${GT_I18N.t('stats.categoryHint')}</p>
        ${entradas.map(({ chave, label, media }) => `
            <div class="gt-bar-row gt-bar-row-clickable" data-categoria="${chave}" role="button" tabindex="0">
                <span class="gt-bar-label">${label}</span>
                <div class="gt-bar-track"><div class="gt-bar-fill" style="width:${(media / 5) * 100}%"></div></div>
                <span class="gt-bar-value">${media || '-'}</span>
                <i class="bi bi-chevron-right text-white-50 small"></i>
            </div>
        `).join('')}
        <div id="stat-notas-detalhe" class="mt-3"></div>
    `;

    container.querySelectorAll('[data-categoria]').forEach(el => {
        const abrir = () => mostrarJogosPorCategoria(el.getAttribute('data-categoria'), entradas.find(e => e.chave === el.getAttribute('data-categoria')).label);
        el.addEventListener('click', abrir);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    });
}

function mostrarJogosPorCategoria(chave, label) {
    const detalhe = document.getElementById('stat-notas-detalhe');
    if (!detalhe) return;

    const jogosComNota = _jogosParaNotas
        .filter(j => typeof j.rating?.[chave] === 'number')
        .sort((a, b) => b.rating[chave] - a.rating[chave]);

    if (jogosComNota.length === 0) {
        detalhe.innerHTML = `<p class="text-white-50 small mb-0">${GT_I18N.t('stats.noGamesInCategory')}</p>`;
        return;
    }

    detalhe.innerHTML = `
        <hr class="border-secondary">
        <p class="small text-white-50 mb-2">${GT_I18N.t('stats.gamesRatedIn', { category: label })}</p>
        <ul class="list-unstyled mb-0">
            ${jogosComNota.map(j => `
                <li class="d-flex justify-content-between align-items-center py-1">
                    <span class="small">${escapeHtml(j.game.title)}</span>
                    <span class="gt-mono small text-white-50">${j.rating[chave]} <i class="bi bi-star-fill" style="color: var(--gt-accent); font-size: 0.7rem;"></i></span>
                </li>
            `).join('')}
        </ul>
    `;
}

function renderTopJogos(jogos) {
    const comMediaGeral = jogos
        .map(item => {
            const r = item.rating;
            if (!r) return null;
            const notas = [r.graphics_score, r.sound_score, r.gameplay_score, r.difficulty_score].filter(n => typeof n === 'number');
            if (notas.length === 0) return null;
            const media = notas.reduce((a, b) => a + b, 0) / notas.length;
            return { titulo: item.game.title, media };
        })
        .filter(Boolean)
        .sort((a, b) => b.media - a.media)
        .slice(0, 5);

    const lista = document.getElementById('stat-top-jogos');

    if (comMediaGeral.length === 0) {
        lista.innerHTML = `<li class="text-white-50 small">${GT_I18N.t('stats.noRatedGames')}</li>`;
        return;
    }

    lista.innerHTML = comMediaGeral.map(({ titulo, media }) => `
        <li class="mb-2">${escapeHtml(titulo)} — <span class="gt-mono" style="color: var(--gt-amber);">${media.toFixed(1)}</span></li>
    `).join('');
}


// Re-renderiza os relatórios quando o idioma muda (nomes de categoria, gêneros, etc.)
document.addEventListener('gt:langchange', carregarRelatorios);
