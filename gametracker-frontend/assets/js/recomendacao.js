function escapeHtml(unsafe) {
    return String(unsafe ?? '')
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

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

// `new Date().toISOString()` converte pra UTC antes de cortar a data — perto
// da meia-noite isso pode devolver o dia ERRADO dependendo do fuso do
// navegador. Monta a data a partir dos componentes LOCAIS em vez disso.
function obterDataLocalHoje() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function minutosParaHHMM(totalMinutos) {
    if (totalMinutos === null || totalMinutos === undefined || isNaN(Number(totalMinutos))) return '';
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    return `${horas}:${String(minutos).padStart(2, '0')}`;
}

function hhmmParaMinutos(texto) {
    if (!texto) return null;
    const valor = texto.trim();
    if (!valor) return null;
    const partes = valor.match(/^(\d{1,4}):([0-5]?\d)$/);
    if (partes) {
        return (parseInt(partes[1], 10) * 60) + parseInt(partes[2], 10);
    }
    const numero = parseFloat(valor.replace(',', '.'));
    return isNaN(numero) ? null : Math.round(numero * 60);
}

function hhmmParaDecimal(texto) {
    const minutos = hhmmParaMinutos(texto);
    return minutos === null ? null : minutos / 60;
}

function aplicarMascaraHHMM(input) {
    input.addEventListener('input', () => {
        let digitos = input.value.replace(/[^\d]/g, '');
        if (digitos.length === 0) { input.value = ''; return; }
        if (digitos.length <= 2) { input.value = digitos; return; }
        input.value = `${digitos.slice(0, -2)}:${digitos.slice(-2)}`;
    });
    input.addEventListener('blur', () => {
        if (!input.value.trim()) return;
        input.value = minutosParaHHMM(hhmmParaMinutos(input.value));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('reco-input');
    const btn = document.getElementById('reco-btn');
    const resultDiv = document.getElementById('reco-result');
    const baseadoEmEl = document.getElementById('reco-baseado-em');

    const buscar = async (termoForcado) => {
        const termo = (termoForcado ?? input.value).trim();
        if (termoForcado !== undefined) input.value = termoForcado;

        resultDiv.innerHTML = `<p class="text-white-50 text-center py-5">${GT_I18N.t('common.loading')}</p>`;
        baseadoEmEl.classList.add('d-none');

        try {
            const query = termo ? `?q=${encodeURIComponent(termo)}` : '';
            const response = await authFetch(`/games/recommendations${query}`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                resultDiv.innerHTML = `<p class="text-danger text-center py-5">${escapeHtml(data.detail || GT_I18N.t('reco.error'))}</p>`;
                return;
            }
            const data = await response.json();
            renderizarRecomendacoes(data);
        } catch (error) {
            resultDiv.innerHTML = `<p class="text-danger text-center py-5">${GT_I18N.t('auth.connectionError')}</p>`;
        }
    };

    btn.addEventListener('click', () => buscar());
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); buscar(); }
    });
    document.querySelectorAll('.gt-suggestion-chip').forEach((chip) => {
        chip.addEventListener('click', () => buscar(chip.dataset.termo));
    });

    // Ao entrar na página, já mostra recomendações baseadas no histórico
    // (sem precisar digitar nada) — só fica vazio pra quem ainda não tem jogo salvo.
    buscar('');
});

function renderizarRecomendacoes(data) {
    const resultDiv = document.getElementById('reco-result');
    const baseadoEmEl = document.getElementById('reco-baseado-em');
    const resultados = data.resultados || [];

    if (data.baseado_em === 'historico' && data.generos_usados?.length) {
        baseadoEmEl.textContent = GT_I18N.t('reco.basedOnHistory', { genres: data.generos_usados.join(', ') });
        baseadoEmEl.classList.remove('d-none');
    } else if (data.baseado_em === 'busca' && data.generos_usados?.length > 1) {
        baseadoEmEl.textContent = GT_I18N.t('reco.alsoIncluding', { genres: data.generos_usados.slice(1).join(', ') });
        baseadoEmEl.classList.remove('d-none');
    } else {
        baseadoEmEl.classList.add('d-none');
    }

    if (data.baseado_em === 'sem_historico') {
        resultDiv.innerHTML = `<p class="text-white-50 text-center py-5">${GT_I18N.t('reco.noHistory')}</p>`;
        return;
    }
    if (resultados.length === 0) {
        resultDiv.innerHTML = `<p class="text-white-50 text-center py-5">${GT_I18N.t('reco.notFound')}</p>`;
        return;
    }

    const hoje = obterDataLocalHoje();
    resultDiv.innerHTML = `<div class="row g-3">${resultados.map((jogo, idx) => `
        <div class="col-6 col-md-4 col-lg-3">
          <div class="gt-card" id="reco-card-${idx}">
            <div class="gt-card-cover">
                ${jogo.cover_url
                    ? `<img src="${jogo.cover_url}" alt="${escapeHtml(jogo.title)}" loading="lazy">`
                    : '<i class="bi bi-controller"></i>'}
            </div>
            <div class="gt-card-body">
              <h3 class="gt-card-title mb-0">${escapeHtml(jogo.title)}</h3>
              <p class="gt-card-meta">${escapeHtml(gtTranslateGenre(jogo.genre) || '—')}</p>
              <button class="btn btn-gt-primary btn-sm w-100 mt-2" onclick="prepararAdicaoRecomendacao('${jogo.external_id}', ${idx})" data-i18n="addGame.addBtn">Adicionar</button>

              <div class="d-none mt-2 pt-2 border-top" style="border-color: var(--gt-border) !important;" id="reco-form-${idx}">
                <p class="small text-white-50 mb-2" data-i18n="addGame.statusPrompt">O que você quer registrar sobre este jogo?</p>
                <div class="d-flex flex-wrap gap-1 mb-2" id="reco-status-${idx}">
                  <button type="button" class="btn btn-gt-outline btn-sm gt-status-choice" data-status="wish_to_play" data-i18n="addGame.statusWishToPlay">Quero jogar</button>
                  <button type="button" class="btn btn-gt-outline btn-sm gt-status-choice" data-status="playing" data-i18n="addGame.statusPlaying">Jogando</button>
                  <button type="button" class="btn btn-gt-outline btn-sm gt-status-choice" data-status="finished" data-i18n="addGame.statusFinished">Finalizado</button>
                </div>
                <div class="d-none flex-column gap-2 mb-2" id="reco-fields-${idx}">
                  <input type="date" class="form-control form-control-sm" id="reco-date-${idx}" max="${hoje}" value="${hoje}">
                  <input type="date" class="form-control form-control-sm d-none" id="reco-finish-${idx}" max="${hoje}" value="${hoje}">
                  <input type="text" inputmode="numeric" autocomplete="off" maxlength="7" class="form-control form-control-sm gt-hhmm-input d-none" id="reco-hours-${idx}" placeholder="Ex: 12:30">
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-gt-primary btn-sm d-none" id="reco-confirm-${idx}" data-i18n="common.confirm">Confirmar</button>
                  <button class="btn btn-gt-outline btn-sm" onclick="document.getElementById('reco-form-${idx}').classList.add('d-none')" data-i18n="common.cancel">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
    `).join('')}</div>`;

    GT_I18N.apply(resultDiv);
    resultDiv.querySelectorAll('.gt-hhmm-input').forEach(aplicarMascaraHHMM);
    window._recomendacoesAtuais = resultados;
}

function prepararAdicaoRecomendacao(externalId, idx) {
    document.getElementById(`reco-card-${idx}`).querySelector('.btn-gt-primary').classList.add('d-none');
    document.getElementById(`reco-form-${idx}`).classList.remove('d-none');

    const fieldsWrapper = document.getElementById(`reco-fields-${idx}`);
    const finishInput = document.getElementById(`reco-finish-${idx}`);
    const hoursInput = document.getElementById(`reco-hours-${idx}`);
    const btnConfirmar = document.getElementById(`reco-confirm-${idx}`);

    document.querySelectorAll(`#reco-status-${idx} .gt-status-choice`).forEach((choiceBtn) => {
        choiceBtn.addEventListener('click', () => {
            document.querySelectorAll(`#reco-status-${idx} .gt-status-choice`).forEach(b => b.classList.remove('is-active'));
            choiceBtn.classList.add('is-active');

            const statusEscolhido = choiceBtn.dataset.status;
            btnConfirmar.classList.remove('d-none');

            if (statusEscolhido === 'wish_to_play') {
                fieldsWrapper.classList.add('d-none');
                fieldsWrapper.classList.remove('d-flex');
            } else {
                fieldsWrapper.classList.remove('d-none');
                fieldsWrapper.classList.add('d-flex');
                finishInput.classList.toggle('d-none', statusEscolhido !== 'finished');
                hoursInput.classList.toggle('d-none', statusEscolhido !== 'finished');
            }

            btnConfirmar.onclick = async () => {
                const payload = { external_id: externalId, platform: null, status: statusEscolhido };
                if (statusEscolhido !== 'wish_to_play') {
                    payload.started_at = document.getElementById(`reco-date-${idx}`).value || null;
                }
                if (statusEscolhido === 'finished') {
                    payload.finished_at = finishInput.value || null;
                    payload.hours_played = hoursInput.value ? hhmmParaDecimal(hoursInput.value) : null;
                }

                btnConfirmar.disabled = true;
                btnConfirmar.innerText = GT_I18N.t('addGame.addingBtn') || 'Adicionando...';
                try {
                    const response = await authFetch('/games/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    if (response.ok) {
                        document.getElementById(`reco-card-${idx}`).innerHTML = `
                            <div class="d-flex flex-column align-items-center justify-content-center h-100 py-5 text-center">
                                <i class="bi bi-check-circle fs-1 mb-2" style="color: var(--gt-success);"></i>
                                <p class="small text-white-50 mb-0" data-i18n="reco.added">Adicionado à sua biblioteca!</p>
                            </div>`;
                        GT_I18N.apply(document.getElementById(`reco-card-${idx}`));
                    } else {
                        const data = await response.json().catch(() => ({}));
                        alert(data.detail || 'Erro ao adicionar o jogo.');
                        btnConfirmar.disabled = false;
                        btnConfirmar.innerText = GT_I18N.t('common.confirm');
                    }
                } catch (error) {
                    console.error('Erro ao adicionar recomendação:', error);
                    btnConfirmar.disabled = false;
                    btnConfirmar.innerText = GT_I18N.t('common.confirm');
                }
            };
        });
    });
}
