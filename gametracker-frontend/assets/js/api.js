/**
 * api.js
 * Camada fina sobre o fetch nativo que:
 *   - injeta o header Authorization com o token JWT salvo no localStorage
 *   - redireciona para o login se o backend responder 401
 *   - centraliza o tratamento de erro (o backend sempre devolve {"detail": "..."})
 *
 * Depende de config.js (API_BASE_URL) já ter sido carregado antes.
 */

const TOKEN_KEY = "gametracker_token";

const auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },
  isLoggedIn() {
    return Boolean(this.getToken());
  },
  logout() {
    this.clearToken();
    window.location.href = "index.html";
  },
};

/**
 * Função central de requisição.
 * @param {string} path - ex: "/catalog/games"
 * @param {object} options - mesmas options do fetch (method, body, etc.)
 * @param {boolean} requireAuth - se true, injeta o header Authorization
 */
async function apiFetch(path, options = {}, requireAuth = true) {
  const headers = { ...(options.headers || {}) };

  // Só definimos Content-Type JSON se o corpo não for FormData/URLSearchParams
  const isPlainBody = options.body && typeof options.body === "string";
  if (isPlainBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (requireAuth) {
    const token = auth.getToken();
    if (!token) {
      auth.logout();
      throw new Error("Usuário não autenticado.");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (networkError) {
    throw new Error(
      "Não foi possível conectar ao servidor. Verifique se o backend está rodando."
    );
  }

  // Token expirado ou inválido -> manda de volta pro login
  if (response.status === 401) {
    auth.clearToken();
    window.location.href = "index.html";
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  // 204 No Content não tem corpo JSON pra parsear
  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data && data.detail) || `Erro ${response.status}`;
    throw new Error(message);
  }

  return data;
}

/** Atalhos convenientes */
const api = {
  get: (path, requireAuth = true) => apiFetch(path, { method: "GET" }, requireAuth),
  post: (path, body, requireAuth = true) =>
    apiFetch(path, { method: "POST", body: JSON.stringify(body) }, requireAuth),
  patch: (path, body, requireAuth = true) =>
    apiFetch(path, { method: "PATCH", body: JSON.stringify(body) }, requireAuth),
  delete: (path, requireAuth = true) => apiFetch(path, { method: "DELETE" }, requireAuth),
};
