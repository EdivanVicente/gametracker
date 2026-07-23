/**
 * Player de gameplay compartilhado (usado no modal do dashboard e na página Explorar).
 *
 * - Mostra uma miniatura + botão de play; ao clicar, o vídeo passa a tocar
 *   ali mesmo (sem precisar sair da página).
 * - Tem um link separado para ir direto ao canal de quem postou o vídeo.
 * - Se o vídeo estiver indisponível/removido, detecta o erro (evento onError
 *   da API do YouTube) e troca automaticamente para o próximo candidato da
 *   lista, sem o usuário precisar fazer nada.
 */

let _ytApiCarregada = false;
let _ytApiCarregando = false;
const _ytCallbacksPendentes = [];

function _carregarYoutubeApi(callback) {
    if (_ytApiCarregada && window.YT && window.YT.Player) {
        callback();
        return;
    }
    _ytCallbacksPendentes.push(callback);
    if (_ytApiCarregando) return;
    _ytApiCarregando = true;

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = function () {
        _ytApiCarregada = true;
        _ytCallbacksPendentes.forEach(cb => cb());
        _ytCallbacksPendentes.length = 0;
    };
}

function _escapeHtmlLocal(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/**
 * @param {HTMLElement} container - onde o card/player vai ser renderizado
 * @param {Array} candidatos - lista de vídeos candidatos (o primeiro é o preferido)
 * @param {string} [tituloBusca] - nome do jogo, usado para montar o link de busca manual no YouTube
 *                                 quando nenhum vídeo automático é encontrado/disponível.
 */
function renderizarGameplay(container, candidatos, tituloBusca) {
    const linkBuscaManual = (mensagem) => {
        if (!tituloBusca) return mensagem;
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(tituloBusca + ' gameplay')}`;
        return `
            ${mensagem}
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="gt-gameplay-channel-link d-inline-flex mt-2">
                <i class="bi bi-youtube"></i> Buscar no YouTube <i class="bi bi-box-arrow-up-right"></i>
            </a>
        `;
    };

    if (!candidatos || candidatos.length === 0) {
        container.innerHTML = linkBuscaManual('<p class="small text-white-50 mb-0">Nenhum vídeo de gameplay encontrado.</p>');
        return;
    }

    let indiceAtual = 0;

    const mostrarThumbnail = () => {
        const video = candidatos[indiceAtual];
        if (!video) {
            container.innerHTML = linkBuscaManual('<p class="small text-white-50 mb-0">Nenhum vídeo de gameplay disponível no momento.</p>');
            return;
        }

        container.innerHTML = `
            <div class="gt-gameplay-link" id="gt-gameplay-trigger" role="button" tabindex="0">
                <div class="gt-gameplay-thumb">
                    ${video.thumbnail_url ? `<img src="${video.thumbnail_url}" alt="Miniatura do vídeo">` : ''}
                    <div class="gt-gameplay-play"><i class="bi bi-play-fill"></i></div>
                </div>
                <div class="min-width-0">
                    <div class="gt-gameplay-title">${_escapeHtmlLocal(video.title || 'Ver gameplay')}</div>
                    <div class="gt-gameplay-channel">${_escapeHtmlLocal(video.channel_title || '')}</div>
                </div>
            </div>
            ${video.channel_url ? `<a href="${video.channel_url}" target="_blank" rel="noopener noreferrer" class="gt-gameplay-channel-link">Ver canal <i class="bi bi-box-arrow-up-right"></i></a>` : ''}
        `;

        const disparar = () => tocarVideo();
        const gatilho = document.getElementById('gt-gameplay-trigger');
        gatilho.addEventListener('click', disparar);
        gatilho.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); disparar(); }
        });
    };

    const tentarProximoCandidato = () => {
        indiceAtual += 1;
        if (indiceAtual < candidatos.length) {
            // Já estava tocando: tenta o próximo direto, sem exigir novo clique.
            tocarVideo();
        } else {
            container.innerHTML = linkBuscaManual('<p class="small text-white-50 mb-0">Não foi possível carregar nenhum vídeo disponível para este jogo.</p>');
        }
    };

    const tocarVideo = () => {
        const video = candidatos[indiceAtual];
        if (!video || !video.video_id) {
            tentarProximoCandidato();
            return;
        }

        const playerDivId = 'gt-yt-player-' + Math.random().toString(36).slice(2);
        container.innerHTML = `<div class="ratio ratio-16x9"><div id="${playerDivId}"></div></div>`;

        _carregarYoutubeApi(() => {
            try {
                new YT.Player(playerDivId, {
                    videoId: video.video_id,
                    playerVars: { autoplay: 1 },
                    events: {
                        // Códigos de erro da API: 100/101/150 = vídeo removido, privado ou
                        // com incorporação (embed) desativada pelo dono do canal.
                        onError: tentarProximoCandidato,
                    },
                });
            } catch (error) {
                tentarProximoCandidato();
            }
        });
    };

    mostrarThumbnail();
}
