const API_BASE = 'http://127.0.0.1:8000';

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
            document.getElementById('reports-content').classList.add('d-none');
            document.getElementById('reports-empty').classList.remove('d-none');
            return;
        }

        renderResumo(jogos);
        renderBarras('rep-genero', contarPor(jogos, j => j.game.genre));
        renderBarras('rep-plataforma', contarPor(jogos, j => j.platform));
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

    document.getElementById('rep-total').textContent = total;
    document.getElementById('rep-taxa-conclusao').textContent = `${Math.round((finalizados / total) * 100)}%`;
    document.getElementById('rep-media-geral').textContent = mediaGeral;
    document.getElementById('rep-favoritos').textContent = favoritos;
}

// Agrupa uma lista de UserGame por um campo (gênero, plataforma etc.), contando ocorrências.
function contarPor(jogos, seletor) {
    const contagem = {};
    jogos.forEach(item => {
        const chaveBruta = seletor(item) || 'Não informado';
        // Gêneros vêm como "Action, Adventure, RPG" da RAWG — considera o primeiro como principal.
        const chave = chaveBruta.split(',')[0].trim();
        contagem[chave] = (contagem[chave] || 0) + 1;
    });
    return Object.entries(contagem).sort((a, b) => b[1] - a[1]);
}

function renderBarras(containerId, entradas) {
    const container = document.getElementById(containerId);
    if (entradas.length === 0) {
        container.innerHTML = '<p class="text-white-50 small mb-0">Sem dados suficientes.</p>';
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

function renderNotasMedias(jogos) {
    const categorias = [
        { chave: 'graphics_score', label: 'Gráficos' },
        { chave: 'sound_score', label: 'Som' },
        { chave: 'gameplay_score', label: 'Jogabilidade' },
        { chave: 'difficulty_score', label: 'Dificuldade' },
    ];

    const entradas = categorias.map(({ chave, label }) => {
        const notas = jogos
            .map(j => j.rating?.[chave])
            .filter(n => typeof n === 'number');
        const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
        return [label, Number(media.toFixed(1))];
    });

    const container = document.getElementById('rep-notas');
    const algumaNota = entradas.some(([, v]) => v > 0);

    if (!algumaNota) {
        container.innerHTML = '<p class="text-white-50 small mb-0">Ainda não há jogos avaliados.</p>';
        return;
    }

    container.innerHTML = entradas.map(([nome, valor]) => `
        <div class="gt-bar-row">
            <span class="gt-bar-label">${nome}</span>
            <div class="gt-bar-track"><div class="gt-bar-fill" style="width:${(valor / 5) * 100}%"></div></div>
            <span class="gt-bar-value">${valor || '-'}</span>
        </div>
    `).join('');
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

    const lista = document.getElementById('rep-top-jogos');

    if (comMediaGeral.length === 0) {
        lista.innerHTML = '<li class="text-white-50 small">Ainda não há jogos avaliados.</li>';
        return;
    }

    lista.innerHTML = comMediaGeral.map(({ titulo, media }) => `
        <li class="mb-2">${escapeHtml(titulo)} — <span class="gt-mono" style="color: var(--gt-amber);">${media.toFixed(1)}</span></li>
    `).join('');
}
