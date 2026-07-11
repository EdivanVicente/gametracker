const API_BASE = 'http://127.0.0.1:8000';

// Se já houver um token salvo, pula a tela de login e vai direto pro dashboard.
if (localStorage.getItem('token')) {
    window.location.href = 'dashboard.html';
}

// --- Funções de Apoio ---
const showError = (elementId, message) => {
    const errorDiv = document.getElementById(elementId);
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
};

const hideError = (elementId) => {
    const errorDiv = document.getElementById(elementId);
    errorDiv.style.display = 'none';
};

// Extrai uma mensagem de erro legível tanto de erros de negócio ({"detail": "..."})
// quanto de erros de validação do Pydantic ({"detail": [{"msg": "..."}]}).
const extrairMensagemErro = (data, fallback) => {
    if (!data || !data.detail) return fallback;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map(e => e.msg).join(' ');
    return fallback;
};

let ultimoEmailLogin = '';

// --- Registro ---
document.getElementById('panel-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert(data.message || 'Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de entrar.');
            document.getElementById('tab-login-btn').click();
            document.getElementById('login-email').value = email;
        } else {
            showError('register-error', extrairMensagemErro(data, 'Erro ao registrar.'));
        }
    } catch (err) {
        showError('register-error', 'Erro de conexão com o servidor.');
    }
});

// --- Login ---
document.getElementById('panel-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError('login-error');
    document.getElementById('btn-resend-verification').classList.add('d-none');

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    ultimoEmailLogin = email;

    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.access_token);
            window.location.href = 'dashboard.html';
        } else if (response.status === 403) {
            // E-mail ainda não confirmado: mostra opção de reenviar o link.
            showError('login-error', extrairMensagemErro(data, 'Confirme seu e-mail antes de entrar.'));
            document.getElementById('btn-resend-verification').classList.remove('d-none');
        } else {
            showError('login-error', extrairMensagemErro(data, 'Credenciais inválidas.'));
        }
    } catch (err) {
        showError('login-error', 'Erro de conexão com o servidor.');
    }
});

// --- Reenviar e-mail de confirmação ---
document.getElementById('btn-resend-verification')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const btn = e.target;
    btn.disabled = true;

    try {
        await fetch(`${API_BASE}/auth/resend-verification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ultimoEmailLogin })
        });
        alert('Se o e-mail existir e ainda não tiver sido confirmado, um novo link foi enviado.');
    } catch (err) {
        alert('Erro de conexão com o servidor.');
    } finally {
        btn.disabled = false;
    }
});
