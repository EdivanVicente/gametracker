/**
 * auth.js — usado em index.html
 * Conecta os formulários de login e cadastro às rotas /auth/login e /auth/register.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Se já está logado, pula direto pro dashboard
  if (auth.isLoggedIn()) {
    window.location.href = "dashboard.html";
    return;
  }

  const loginForm = document.getElementById("panel-login");
  const registerForm = document.getElementById("panel-register");
  const loginError = document.getElementById("login-error");
  const registerError = document.getElementById("register-error");

  function showError(el, message) {
    el.textContent = message;
    el.style.display = "block";
  }
  function hideError(el) {
    el.style.display = "none";
  }

  function setLoading(form, isLoading) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = isLoading;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.textContent = isLoading ? "Aguarde..." : btn.dataset.originalText;
  }

  // --- LOGIN ---
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(loginError);

    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    setLoading(loginForm, true);
    try {
      // /auth/login espera application/x-www-form-urlencoded (OAuth2PasswordRequestForm),
      // por isso usamos URLSearchParams em vez de JSON aqui.
      const body = new URLSearchParams();
      body.set("username", email);
      body.set("password", password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((data && data.detail) || "E-mail ou senha incorretos.");
      }

      auth.setToken(data.access_token);
      window.location.href = "dashboard.html";
    } catch (err) {
      showError(loginError, err.message);
    } finally {
      setLoading(loginForm, false);
    }
  });

  // --- CADASTRO ---
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(registerError);

    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;

    setLoading(registerForm, true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Erros de validação do Pydantic vêm em data.detail como lista de objetos
        let message = "Não foi possível criar a conta.";
        if (Array.isArray(data?.detail)) {
          message = data.detail.map((e) => e.msg).join(" ");
        } else if (typeof data?.detail === "string") {
          message = data.detail;
        }
        throw new Error(message);
      }

      // Conta criada -> loga automaticamente em seguida
      const loginBody = new URLSearchParams();
      loginBody.set("username", email);
      loginBody.set("password", password);

      const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: loginBody,
      });
      const loginData = await loginResponse.json();

      auth.setToken(loginData.access_token);
      window.location.href = "dashboard.html";
    } catch (err) {
      showError(registerError, err.message);
    } finally {
      setLoading(registerForm, false);
    }
  });
});
