const API_BASE = 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', () => {
    carregarVisibilidadeAtual();

    document.getElementById('btn-change-email').addEventListener('click', trocarEmail);
    document.getElementById('btn-change-password').addEventListener('click', trocarSenha);
    document.getElementById('btn-save-visibility').addEventListener('click', salvarVisibilidade);
    document.getElementById('btn-confirm-delete').addEventListener('click', pedirExclusaoConta);
});

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

function extrairMensagemErro(data, fallback) {
    if (!data || !data.detail) return fallback;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map(e => e.msg).join(' ');
    return fallback;
}

function mostrarMensagem(idErro, idSucesso, mensagem, sucesso) {
    const elErro = document.getElementById(idErro);
    const elSucesso = document.getElementById(idSucesso);
    if (sucesso) {
        elErro.classList.add('d-none');
        elSucesso.textContent = mensagem;
        elSucesso.classList.remove('d-none');
    } else {
        elSucesso.classList.add('d-none');
        elErro.textContent = mensagem;
        elErro.classList.remove('d-none');
    }
}

async function carregarVisibilidadeAtual() {
    try {
        const response = await authFetch('/auth/me');
        if (!response.ok) return;
        const user = await response.json();
        document.getElementById('settings-visibility').value = user.profile_visibility || 'public';
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
}

// --- Trocar e-mail ---
async function trocarEmail() {
    const btn = document.getElementById('btn-change-email');
    const novoEmail = document.getElementById('settings-new-email').value.trim();
    const senha = document.getElementById('settings-email-password').value;

    if (!novoEmail || !senha) {
        mostrarMensagem('settings-email-error', 'settings-email-success', 'Preencha o novo e-mail e a senha atual.', false);
        return;
    }

    btn.disabled = true;
    try {
        const response = await authFetch('/auth/change-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_email: novoEmail, current_password: senha })
        });
        const data = await response.json();

        if (response.ok) {
            mostrarMensagem('settings-email-error', 'settings-email-success', data.message, true);
            document.getElementById('settings-new-email').value = '';
            document.getElementById('settings-email-password').value = '';
        } else {
            mostrarMensagem('settings-email-error', 'settings-email-success', extrairMensagemErro(data, 'Não foi possível trocar o e-mail.'), false);
        }
    } catch (error) {
        mostrarMensagem('settings-email-error', 'settings-email-success', 'Erro de conexão com o servidor.', false);
    } finally {
        btn.disabled = false;
    }
}

// --- Trocar senha ---
async function trocarSenha() {
    const btn = document.getElementById('btn-change-password');
    const atual = document.getElementById('settings-current-password').value;
    const nova = document.getElementById('settings-new-password').value;
    const confirmacao = document.getElementById('settings-confirm-password').value;

    if (!atual || !nova || !confirmacao) {
        mostrarMensagem('settings-password-error', 'settings-password-success', 'Preencha todos os campos.', false);
        return;
    }
    if (nova !== confirmacao) {
        mostrarMensagem('settings-password-error', 'settings-password-success', 'A confirmação não bate com a nova senha.', false);
        return;
    }

    btn.disabled = true;
    try {
        const response = await authFetch('/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: atual, new_password: nova })
        });
        const data = await response.json();

        if (response.ok) {
            mostrarMensagem('settings-password-error', 'settings-password-success', data.message, true);
            document.getElementById('settings-current-password').value = '';
            document.getElementById('settings-new-password').value = '';
            document.getElementById('settings-confirm-password').value = '';
        } else {
            mostrarMensagem('settings-password-error', 'settings-password-success', extrairMensagemErro(data, 'Não foi possível trocar a senha.'), false);
        }
    } catch (error) {
        mostrarMensagem('settings-password-error', 'settings-password-success', 'Erro de conexão com o servidor.', false);
    } finally {
        btn.disabled = false;
    }
}

// --- Privacidade ---
async function salvarVisibilidade() {
    const valor = document.getElementById('settings-visibility').value;
    try {
        const response = await authFetch('/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_visibility: valor })
        });
        if (response.ok) {
            document.getElementById('settings-visibility-success').classList.remove('d-none');
            setTimeout(() => document.getElementById('settings-visibility-success').classList.add('d-none'), 3000);
        }
    } catch (error) {
        console.error('Erro ao salvar privacidade:', error);
    }
}

// --- Excluir conta ---
async function pedirExclusaoConta() {
    const btn = document.getElementById('btn-confirm-delete');
    const senha = document.getElementById('delete-account-password').value;

    if (!senha) {
        mostrarMensagem('delete-account-error', 'delete-account-success', 'Digite sua senha atual.', false);
        return;
    }

    btn.disabled = true;
    try {
        const response = await authFetch('/auth/request-account-deletion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: senha })
        });
        const data = await response.json();

        if (response.ok) {
            mostrarMensagem('delete-account-error', 'delete-account-success', data.message, true);
            document.getElementById('delete-account-password').value = '';
        } else {
            mostrarMensagem('delete-account-error', 'delete-account-success', extrairMensagemErro(data, 'Não foi possível processar a exclusão.'), false);
        }
    } catch (error) {
        mostrarMensagem('delete-account-error', 'delete-account-success', 'Erro de conexão com o servidor.', false);
    } finally {
        btn.disabled = false;
    }
}
