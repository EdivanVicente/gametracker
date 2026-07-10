// --- Funções de Apoio ---
const showError = (elementId, message) => {
    const errorDiv = document.getElementById(elementId);
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
};

// --- Registro ---
document.getElementById('panel-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    try {
        const response = await fetch('http://127.0.0.1:8000/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            alert('Cadastro realizado! Agora você pode entrar.');
            document.getElementById('tab-login-btn').click(); 
        } else {
            const data = await response.json();
            
            // CORREÇÃO: O FastAPI devolve erros de validação como Array. Precisamos extrair a mensagem correta.
            let errorMsg = 'Erro ao registrar.';
            if (Array.isArray(data.detail)) {
                errorMsg = data.detail[0].msg; // Pega a mensagem de erro específica da senha
            } else if (data.detail) {
                errorMsg = data.detail;
            }
            
            showError('register-error', errorMsg);
        }
    } catch (err) {
        showError('register-error', 'Erro de conexão com o servidor.');
    }
});

// --- Login ---
document.getElementById('panel-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
        const response = await fetch('http://127.0.0.1:8000/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            // Sucesso: Salva o token e redireciona
            localStorage.setItem('token', data.access_token);
            window.location.href = 'dashboard.html'; 
        } else {
            showError('login-error', data.detail || 'Credenciais inválidas.');
        }
    } catch (err) {
        showError('login-error', 'Erro de conexão com o servidor.');
    }
});