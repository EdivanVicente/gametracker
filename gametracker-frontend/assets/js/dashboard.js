/**
 * dashboard.js — usado em dashboard.html
 * Conecta:
 *   - HUD strip          -> GET /catalog/summary
 *   - Grid de jogos       -> GET /catalog/games (com filtros)
 *   - Modal "Adicionar"   -> GET /games/search (RAWG) + POST /catalog/games
 *   - Modal "Detalhe"     -> PATCH /catalog/games/{id} (datas, favorito, notas)
 *   - Botão de favorito   -> PATCH rápido direto no card
 *   - Botão de compartilhar -> Web Share API
 */

document.addEventListener("DOMContentLoaded", () => {
  if (!auth.isLoggedIn()) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("btn-logout").addEventListener("click", (e) => {
    e.preventDefault();
    auth.logout();
  });

  loadSummary();
  loadCatalog();
  wireFilters();
  wireAddGameModal();
  wireDetailModal();
});

// ---------------------------------------------------------------------------
// HUD status strip
// ---------------------------------------------------------------------------

async function loadSummary() {
  try {
    const summary = await api.get("/catalog/summary");
    document.querySelector(".gt-hud-value.gt-mono:not(.is-playing):not(.is-finished):not(.is-favorite)")
      .textContent = summary.total;
    document.querySelector(".gt-hud-value.is-playing").textContent = summary.playing;
    document.querySelector(".gt-hud-value.is-finished").textContent = summary.finished;
    document.querySelector(".gt-hud-value.is-favorite").textContent = summary.favorites;
  } catch (err) {
    console.error("Falha ao carregar resumo:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Grid de jogos (catálogo do usuário)
// ---------------------------------------------------------------------------

/** Guarda em memória o catálogo carregado, pra reabrir o modal de detalhe sem outro fetch */
let catalogCache = [];

function buildQueryString(params) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      usp.set(key, value);
    }
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

function getActiveFilters() {
  return {
    search: document.getElementById("filter-search").value.trim(),
    console: document.getElementById("filter-console").value,
    genre: document.getElementById("filter-genre").value,
    status: document.getElementById("filter-status").value,
    min_gameplay: document.getElementById("filter-gameplay-score").value,
    favorite: document.getElementById("btn-favorites-only").classList.contains("active")
      ? "true"
      : "",
  };
}

async function loadCatalog() {
  const grid = document.getElementById("games-grid");
  const loading = document.getElementById("games-grid-loading");
  const empty = document.getElementById("games-grid-empty");

  grid.classList.add("d-none");
  empty.classList.add("d-none");
  loading.classList.remove("d-none");

  try {
    const qs = buildQueryString(getActiveFilters());
    const items = await api.get(`/catalog/games${qs}`);
    catalogCache = items;

    if (items.length === 0) {
      empty.classList.remove("d-none");
      grid.innerHTML = "";
    } else {
      grid.innerHTML = items.map(renderGameCard).join("");
      grid.classList.remove("d-none");
      wireGridCardEvents();
    }
  } catch (err) {
    console.error("Falha ao carregar catálogo:", err.message);
    empty.classList.remove("d-none");
  } finally {
    loading.classList.add("d-none");
  }
}

function renderGameCard(item) {
  const isFinished = item.status === "finished";
  const statusLabel = isFinished ? "Finalizado" : "Em andamento";
  const statusClass = isFinished ? "is-finished" : "is-playing";
  const favIconClass = item.is_favorite ? "bi-heart-fill" : "bi-heart";
  const favActiveClass = item.is_favorite ? "is-active" : "";
  const cover = item.game.cover_url
    ? `<img src="${escapeHtml(item.game.cover_url)}" alt="${escapeHtml(item.game.title)}">`
    : `<i class="bi bi-controller"></i>`;

  const rating = item.rating || {};
  const scoreOrDash = (v) => (v ?? "–");

  return `
    <div class="col-12 col-sm-6 col-md-4 col-xl-3 col-xxl-2">
      <article class="gt-card" data-user-game-id="${item.id}" tabindex="0">
        <div class="gt-card-status ${statusClass}">${statusLabel}</div>
        <button class="gt-card-favorite ${favActiveClass}" data-favorite-toggle
                aria-label="${item.is_favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}">
          <i class="bi ${favIconClass}"></i>
        </button>
        <div class="gt-card-cover">${cover}</div>
        <div class="gt-card-body">
          <h3 class="gt-card-title mb-0">${escapeHtml(item.game.title)}</h3>
          <p class="gt-card-meta">${escapeHtml(item.platform || "—")} · ${escapeHtml(item.game.genre || "Gênero desconhecido")}</p>
          <div class="gt-card-scores">
            <span>Grf <span class="gt-score-value">${scoreOrDash(rating.graphics_score)}</span></span>
            <span>Som <span class="gt-score-value">${scoreOrDash(rating.sound_score)}</span></span>
            <span>Jog <span class="gt-score-value">${scoreOrDash(rating.gameplay_score)}</span></span>
            <span>Dif <span class="gt-score-value">${scoreOrDash(rating.difficulty_score)}</span></span>
          </div>
        </div>
      </article>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function wireGridCardEvents() {
  // Abrir modal de detalhe ao clicar no card (exceto no botão de favorito)
  document.querySelectorAll(".gt-card[data-user-game-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-favorite-toggle]")) return;
      const id = Number(card.dataset.userGameId);
      openDetailModal(id);
    });
  });

  // Toggle rápido de favorito direto no card, sem abrir o modal
  document.querySelectorAll("[data-favorite-toggle]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const card = btn.closest(".gt-card");
      const id = Number(card.dataset.userGameId);
      const item = catalogCache.find((g) => g.id === id);
      if (!item) return;

      const newValue = !item.is_favorite;
      try {
        await api.patch(`/catalog/games/${id}`, { is_favorite: newValue });
        item.is_favorite = newValue;
        btn.classList.toggle("is-active", newValue);
        btn.querySelector("i").className = `bi ${newValue ? "bi-heart-fill" : "bi-heart"}`;
        loadSummary();
      } catch (err) {
        alert(`Não foi possível atualizar o favorito: ${err.message}`);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Toolbar de filtros
// ---------------------------------------------------------------------------

function wireFilters() {
  const debounce = (fn, delay = 400) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  document
    .getElementById("filter-search")
    .addEventListener("input", debounce(() => loadCatalog()));

  ["filter-console", "filter-genre", "filter-status", "filter-gameplay-score"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => loadCatalog());
  });

  document.getElementById("btn-favorites-only").addEventListener("click", (event) => {
    event.currentTarget.classList.toggle("active");
    loadCatalog();
  });
}

// ---------------------------------------------------------------------------
// Modal: Adicionar jogo (busca na RAWG via backend)
// ---------------------------------------------------------------------------

function wireAddGameModal() {
  const searchInput = document.getElementById("game-search-input");
  const searchBtn = document.getElementById("game-search-btn");
  const resultsContainer = document.getElementById("game-search-results");

  async function runSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) return;

    resultsContainer.innerHTML = `
      <div class="text-center py-4 w-100">
        <div class="spinner-border spinner-border-sm" style="color: var(--gt-accent);"></div>
      </div>`;

    try {
      const results = await api.get(`/games/search?q=${encodeURIComponent(query)}`);

      if (results.length === 0) {
        resultsContainer.innerHTML = `<p class="text-white-50 small text-center py-4 mb-0">Nenhum jogo encontrado.</p>`;
        return;
      }

      resultsContainer.innerHTML = results.map(renderSearchResult).join("");
      wireSearchResultButtons(results);
    } catch (err) {
      resultsContainer.innerHTML = `<p class="text-danger small text-center py-4 mb-0">${escapeHtml(err.message)}</p>`;
    }
  }

  searchBtn.addEventListener("click", runSearch);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  });
}

function renderSearchResult(game, index) {
  const cover = game.cover_url
    ? `<img src="${escapeHtml(game.cover_url)}" alt="${escapeHtml(game.title)}" style="width:48px;height:64px;object-fit:cover;border-radius:0.25rem;">`
    : `<div style="width:48px;height:64px;" class="d-flex align-items-center justify-content-center bg-secondary bg-opacity-10 rounded"><i class="bi bi-controller"></i></div>`;

  return `
    <div class="col-12">
      <div class="d-flex align-items-center gap-3 p-2 gt-panel">
        ${cover}
        <div class="flex-grow-1">
          <div class="fw-semibold">${escapeHtml(game.title)}</div>
          <div class="small text-white-50">${escapeHtml(game.genre || "Gênero desconhecido")}</div>
        </div>
        <select class="form-select form-select-sm gt-add-platform" style="width: auto;" data-index="${index}">
          <option value="PC">PC</option>
          <option value="PlayStation 5">PS5</option>
          <option value="Xbox Series">Xbox</option>
          <option value="Switch">Switch</option>
        </select>
        <button class="btn btn-gt-primary btn-sm gt-add-confirm" data-index="${index}">
          Adicionar
        </button>
      </div>
    </div>
  `;
}

function wireSearchResultButtons(results) {
  document.querySelectorAll(".gt-add-confirm").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const index = Number(btn.dataset.index);
      const game = results[index];
      const platformSelect = document.querySelector(`.gt-add-platform[data-index="${index}"]`);
      const platform = platformSelect.value;

      btn.disabled = true;
      btn.textContent = "Adicionando...";

      try {
        await api.post("/catalog/games", {
          external_id: game.external_id,
          title: game.title,
          cover_url: game.cover_url,
          description: game.description,
          genre: game.genre,
          platform,
          start_date: new Date().toISOString().slice(0, 10),
        });

        btn.textContent = "Adicionado!";
        loadSummary();
        loadCatalog();

        setTimeout(() => {
          const modal = bootstrap.Modal.getInstance(document.getElementById("modalAddGame"));
          modal.hide();
        }, 600);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Adicionar";
        alert(`Não foi possível adicionar: ${err.message}`);
      }
    });
  });
}

// Limpa a busca toda vez que o modal de adicionar é fechado
document.getElementById("modalAddGame")?.addEventListener("hidden.bs.modal", () => {
  document.getElementById("game-search-input").value = "";
  document.getElementById("game-search-results").innerHTML = `
    <p class="text-white-50 small text-center py-4 mb-0">
      Digite o nome de um jogo para buscar na base de dados.
    </p>`;
});

// ---------------------------------------------------------------------------
// Modal: Detalhe / Avaliação
// ---------------------------------------------------------------------------

let currentDetailId = null;

function openDetailModal(userGameId) {
  const item = catalogCache.find((g) => g.id === userGameId);
  if (!item) return;

  currentDetailId = userGameId;

  document.getElementById("modalGameDetailLabel").textContent = item.game.title;
  document.getElementById("detail-start-date").value = item.start_date || "";
  document.getElementById("detail-end-date").value = item.end_date || "";
  document.getElementById("detail-favorite").checked = item.is_favorite;

  const rating = item.rating || {};
  document.querySelectorAll(".gt-star-input").forEach((group) => {
    const category = group.dataset.category;
    setStarDisplay(group, rating[category] || 0);
  });

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("modalGameDetail"));
  modal.show();
}

function setStarDisplay(group, value) {
  group.dataset.value = value;
  group.querySelectorAll(".gt-star").forEach((star) => {
    const starValue = Number(star.dataset.value);
    star.classList.toggle("is-filled", starValue <= value);
    star.classList.toggle("bi-star-fill", starValue <= value);
    star.classList.toggle("bi-star", starValue > value);
  });
}

function wireDetailModal() {
  // Clique nas estrelas atualiza a nota daquela categoria (em memória, salva só ao clicar "Salvar")
  document.querySelectorAll(".gt-star-input").forEach((group) => {
    group.addEventListener("click", (event) => {
      const star = event.target.closest(".gt-star");
      if (!star) return;
      setStarDisplay(group, Number(star.dataset.value));
    });
  });

  document.getElementById("btn-save-detail").addEventListener("click", async () => {
    if (!currentDetailId) return;

    const payload = {
      start_date: document.getElementById("detail-start-date").value || null,
      end_date: document.getElementById("detail-end-date").value || null,
      is_favorite: document.getElementById("detail-favorite").checked,
      rating: {},
    };

    document.querySelectorAll(".gt-star-input").forEach((group) => {
      const category = group.dataset.category;
      const value = Number(group.dataset.value || 0);
      if (value > 0) payload.rating[category] = value;
    });
    if (Object.keys(payload.rating).length === 0) delete payload.rating;

    const btn = document.getElementById("btn-save-detail");
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Salvando...";

    try {
      await api.patch(`/catalog/games/${currentDetailId}`, payload);
      await loadCatalog();
      await loadSummary();
      bootstrap.Modal.getInstance(document.getElementById("modalGameDetail")).hide();
    } catch (err) {
      alert(`Não foi possível salvar: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });

  // Compartilhar — Web Share API nativa, com fallback de copiar texto
  document.getElementById("btn-share-game").addEventListener("click", async () => {
    const item = catalogCache.find((g) => g.id === currentDetailId);
    if (!item) return;

    const gameplayScore = item.rating?.gameplay_score ?? "–";
    const text = `Terminei ${item.game.title} no ${item.platform || "meu console"}. Minha nota de Jogabilidade: ${gameplayScore}/5! #GameTracker`;

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (err) {
        // Usuário cancelou o share -- não precisa tratar como erro
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      alert("Texto copiado! Cole onde quiser compartilhar.");
    } else {
      alert(text);
    }
  });
}
