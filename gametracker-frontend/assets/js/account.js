const API_BASE = 'http://127.0.0.1:8000';

let avatarBase64Atual = null;
let perfilOriginal = null;

document.addEventListener('DOMContentLoaded', () => {
    popularSelectPaises();
    setupBioCounter();
    setupAvatarUpload();
    carregarPerfil();

    document.getElementById('btn-save-profile').addEventListener('click', salvarPerfil);
    document.getElementById('btn-cancel-profile').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
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

function popularSelectPaises() {
    const select = document.getElementById('profile-country-input');
    GT_COUNTRIES.forEach(pais => {
        const option = document.createElement('option');
        option.value = pais.code;
        option.textContent = `${paraEmojiBandeira(pais.code)} ${pais.name}`;
        select.appendChild(option);
    });
}

function setupBioCounter() {
    const input = document.getElementById('profile-bio-input');
    const counter = document.getElementById('profile-bio-counter');
    input.addEventListener('input', () => {
        counter.textContent = `${input.value.length}/30`;
    });
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

async function carregarPerfil() {
    try {
        const response = await authFetch('/auth/me');
        if (!response.ok) return;

        perfilOriginal = await response.json();
        preencherFormulario(perfilOriginal);
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

function preencherFormulario(user) {
    if (!user) return;

    avatarBase64Atual = user.avatar_data || null;

    document.getElementById('profile-name-display').textContent = user.display_name || user.email.split('@')[0];
    document.getElementById('profile-bio-display').textContent = user.bio || '';
    document.getElementById('profile-email-display').textContent = user.email;
    document.getElementById('profile-name-input').value = user.display_name || '';
    document.getElementById('profile-email-input').value = user.email;
    document.getElementById('profile-bio-input').value = user.bio || '';
    document.getElementById('profile-bio-counter').textContent = `${(user.bio || '').length}/30`;
    document.getElementById('profile-country-input').value = user.country || '';
    document.getElementById('profile-state-input').value = user.state || '';
    document.getElementById('profile-gender-input').value = user.gender || '';
    document.getElementById('profile-visibility-input').value = user.profile_visibility || 'public';

    document.getElementById('social-3ds').value = user.friend_code_3ds || '';
    document.getElementById('social-ea').value = user.ea_app_id || '';
    document.getElementById('social-nn').value = user.nintendo_network_id || '';
    document.getElementById('social-switch').value = user.nintendo_switch_id || '';
    document.getElementById('social-psn').value = user.psn_id || '';
    document.getElementById('social-steam').value = user.steam_id || '';
    document.getElementById('social-twitch').value = user.twitch || '';
    document.getElementById('social-ubisoft').value = user.ubisoft_connect || '';
    document.getElementById('social-wii').value = user.wii_friend_code || '';
    document.getElementById('social-xbox').value = user.xbox_gamertag || '';
    document.getElementById('social-discord').value = user.discord || '';
    document.getElementById('social-instagram').value = user.instagram || '';
    document.getElementById('social-x').value = user.x_handle || '';

    const dataFormatada = new Date(user.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric'
    });
    document.getElementById('profile-joined-date').textContent = dataFormatada;

    document.getElementById('profile-avatar-preview').innerHTML = user.avatar_data
        ? `<img src="${user.avatar_data}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">`
        : '<i class="bi bi-person fs-1 text-white-50"></i>';

    document.getElementById('profile-error').classList.add('d-none');
    document.getElementById('profile-success').classList.add('d-none');
}

function mostrarErroPerfil(mensagem) {
    const el = document.getElementById('profile-error');
    el.textContent = mensagem;
    el.classList.remove('d-none');
    document.getElementById('profile-success').classList.add('d-none');
}

async function salvarPerfil() {
    const btn = document.getElementById('btn-save-profile');

    document.getElementById('profile-error').classList.add('d-none');
    document.getElementById('profile-success').classList.add('d-none');
    btn.disabled = true;

    const payload = {
        display_name: document.getElementById('profile-name-input').value.trim() || null,
        avatar_data: avatarBase64Atual,
        bio: document.getElementById('profile-bio-input').value.trim() || null,
        country: document.getElementById('profile-country-input').value || null,
        state: document.getElementById('profile-state-input').value.trim() || null,
        gender: document.getElementById('profile-gender-input').value || null,
        profile_visibility: document.getElementById('profile-visibility-input').value,
        friend_code_3ds: document.getElementById('social-3ds').value.trim() || null,
        ea_app_id: document.getElementById('social-ea').value.trim() || null,
        nintendo_network_id: document.getElementById('social-nn').value.trim() || null,
        nintendo_switch_id: document.getElementById('social-switch').value.trim() || null,
        psn_id: document.getElementById('social-psn').value.trim() || null,
        steam_id: document.getElementById('social-steam').value.trim() || null,
        twitch: document.getElementById('social-twitch').value.trim() || null,
        ubisoft_connect: document.getElementById('social-ubisoft').value.trim() || null,
        wii_friend_code: document.getElementById('social-wii').value.trim() || null,
        xbox_gamertag: document.getElementById('social-xbox').value.trim() || null,
        discord: document.getElementById('social-discord').value.trim() || null,
        instagram: document.getElementById('social-instagram').value.trim() || null,
        x_handle: document.getElementById('social-x').value.trim() || null,
    };

    try {
        const response = await authFetch('/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            perfilOriginal = await response.json();
            preencherFormulario(perfilOriginal);
            document.getElementById('profile-success').classList.remove('d-none');
        } else {
            const data = await response.json().catch(() => ({}));
            const msg = Array.isArray(data.detail) ? data.detail.map(e => e.msg).join(' ') : (data.detail || 'Não foi possível salvar o perfil.');
            mostrarErroPerfil(msg);
        }
    } catch (error) {
        mostrarErroPerfil('Erro de conexão com o servidor.');
    } finally {
        btn.disabled = false;
    }
}
