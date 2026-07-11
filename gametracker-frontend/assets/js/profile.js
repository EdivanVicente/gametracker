const API_BASE = 'http://127.0.0.1:8000';

let avatarBase64Atual = null;

document.addEventListener('DOMContentLoaded', () => {
    carregarPerfil();
    setupAvatarUpload();

    document.getElementById('btn-save-profile').addEventListener('click', salvarPerfil);
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

async function carregarPerfil() {
    try {
        const response = await authFetch('/auth/me');
        if (!response.ok) return;

        const user = await response.json();
        avatarBase64Atual = user.avatar_data || null;

        document.getElementById('profile-name-display').textContent = user.display_name || user.email.split('@')[0];
        document.getElementById('profile-email-display').textContent = user.email;
        document.getElementById('profile-name-input').value = user.display_name || '';
        document.getElementById('profile-email-input').value = user.email;

        const dataFormatada = new Date(user.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
        document.getElementById('profile-joined-date').textContent = dataFormatada;

        if (user.avatar_data) {
            document.getElementById('profile-avatar-preview').innerHTML =
                `<img src="${user.avatar_data}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`;
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

function setupAvatarUpload() {
    const input = document.getElementById('profile-avatar-input');
    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            mostrarErroPerfil('A imagem deve ter no máximo 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            avatarBase64Atual = reader.result;
            document.getElementById('profile-avatar-preview').innerHTML =
                `<img src="${avatarBase64Atual}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    });
}

function mostrarErroPerfil(mensagem) {
    const el = document.getElementById('profile-error');
    el.textContent = mensagem;
    el.classList.remove('d-none');
    document.getElementById('profile-success').classList.add('d-none');
}

async function salvarPerfil() {
    const btn = document.getElementById('btn-save-profile');
    const displayName = document.getElementById('profile-name-input').value.trim();

    document.getElementById('profile-error').classList.add('d-none');
    document.getElementById('profile-success').classList.add('d-none');
    btn.disabled = true;

    try {
        const response = await authFetch('/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_name: displayName || null, avatar_data: avatarBase64Atual })
        });

        if (response.ok) {
            const user = await response.json();
            document.getElementById('profile-name-display').textContent = user.display_name || user.email.split('@')[0];
            document.getElementById('profile-success').classList.remove('d-none');
        } else {
            const data = await response.json().catch(() => ({}));
            mostrarErroPerfil(data.detail || 'Não foi possível salvar o perfil.');
        }
    } catch (error) {
        mostrarErroPerfil('Erro de conexão com o servidor.');
    } finally {
        btn.disabled = false;
    }
}
