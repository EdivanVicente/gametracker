
function extrairMensagemErro(data, fallback) {
    if (!data || !data.detail) return fallback;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map(e => e.msg).join(' ');
    return fallback;
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
        mostrarLinkInvalido();
        return;
    }

    document.getElementById('btn-reset-password').addEventListener('click', () => redefinirSenha(token));
});

function mostrarLinkInvalido() {
    document.getElementById('reset-form-wrapper').classList.add('d-none');
    document.getElementById('reset-success-wrapper').classList.add('d-none');
    document.getElementById('reset-invalid-wrapper').classList.remove('d-none');
}

async function redefinirSenha(token) {
    const btn = document.getElementById('btn-reset-password');
    const novaSenha = document.getElementById('reset-new-password').value;
    const confirmacao = document.getElementById('reset-confirm-password').value;
    const erroEl = document.getElementById('reset-error');

    erroEl.classList.add('d-none');

    if (!novaSenha || !confirmacao) {
        erroEl.textContent = GT_I18N.t('resetPassword.fillBothFields');
        erroEl.classList.remove('d-none');
        return;
    }
    if (novaSenha !== confirmacao) {
        erroEl.textContent = GT_I18N.t('resetPassword.mismatch');
        erroEl.classList.remove('d-none');
        return;
    }

    btn.disabled = true;
    try {
        const response = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, new_password: novaSenha })
        });
        const data = await response.json();

        if (response.ok) {
            document.getElementById('reset-form-wrapper').classList.add('d-none');
            document.getElementById('reset-success-wrapper').classList.remove('d-none');
        } else if (response.status === 400) {
            mostrarLinkInvalido();
        } else {
            erroEl.textContent = extrairMensagemErro(data, GT_I18N.t('resetPassword.genericError'));
            erroEl.classList.remove('d-none');
        }
    } catch (error) {
        erroEl.textContent = GT_I18N.t('auth.connectionError');
        erroEl.classList.remove('d-none');
    } finally {
        btn.disabled = false;
    }
}
