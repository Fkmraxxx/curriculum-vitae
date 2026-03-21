const STATUS_LABELS = {
  "fait": "Fait",
  "en-cours": "En cours",
  "a-faire": "À faire",
  "abandonne": "Abandonné"
};

const state = {
  category: "all",
  search: "",
  franchise: "all",
  sort: "rating-desc"
};

const els = {
  totalCount: document.getElementById("totalCount"),
  favoriteCount: document.getElementById("favoriteCount"),
  doneCount: document.getElementById("doneCount"),
  progressCount: document.getElementById("progressCount"),
  categoryTabs: document.getElementById("categoryTabs"),
  searchInput: document.getElementById("searchInput"),
  franchiseFilter: document.getElementById("franchiseFilter"),
  sortFilter: document.getElementById("sortFilter"),
  resultsCount: document.getElementById("resultsCount"),
  franchiseChips: document.getElementById("franchiseChips"),
  gamesContainer: document.getElementById("gamesContainer"),
  resetFilters: document.getElementById("resetFilters")
};

let allGames = [];

init();

async function init() {
  bindEvents();

  try {
    const response = await fetch("./data/games.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Impossible de charger data/games.json (${response.status})`);
    }

    const data = await response.json();
    allGames = Array.isArray(data.games) ? data.games.map(normalizeGame) : [];

    renderStaticLists();
    render();
  } catch (error) {
    console.error(error);
    els.gamesContainer.innerHTML = `
      <div class="empty-state">
        Impossible de charger la bibliothèque de jeux.<br>
        Vérifie le fichier <strong>data/games.json</strong>.
      </div>
    `;
  }
}

function bindEvents() {
  els.categoryTabs.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-category]");
    if (!btn) return;

    state.category = btn.dataset.category;
    updateTabState();
    render();
  });

  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    render();
  });

  els.franchiseFilter.addEventListener("change", (event) => {
    state.franchise = event.target.value;
    syncFranchiseChips();
    render();
  });

  els.sortFilter.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  els.resetFilters.addEventListener("click", () => {
    state.category = "all";
    state.search = "";
    state.franchise = "all";
    state.sort = "rating-desc";

    els.searchInput.value = "";
    els.franchiseFilter.value = "all";
    els.sortFilter.value = "rating-desc";

    updateTabState();
    syncFranchiseChips();
    render();
  });
}

function normalizeGame(game) {
  return {
    id: String(game.id || "").trim(),
    title: String(game.title || "Sans titre").trim(),
    franchise: String(game.franchise || "Sans franchise").trim(),
    status: normalizeStatus(game.status),
    favorite: Boolean(game.favorite),
    rating: normalizeRating(game.rating),
    platform: String(game.platform || "").trim(),
    release_year: normalizeYear(game.release_year),
    cover: resolveAssetPath(game.cover),
    comment: String(game.comment || "").trim(),
    tags: Array.isArray(game.tags)
      ? game.tags.map(tag => String(tag).trim()).filter(Boolean)
      : []
  };
}

function normalizeStatus(value) {
  const source = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");

  if (["fait", "termine", "terminee"].includes(source)) return "fait";
  if (["en-cours", "encours", "progress"].includes(source)) return "en-cours";
  if (["a-faire", "afaire", "backlog", "todo"].includes(source)) return "a-faire";
  if (["abandonne", "abandonné", "dropped"].includes(source)) return "abandonne";

  return "a-faire";
}

function normalizeRating(value) {
  const number = Number(value);
  if (Number.isFinite(number)) {
    return Math.max(0, Math.min(20, number));
  }
  return null;
}

function normalizeYear(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resolveAssetPath(path) {
  if (!path) return "";
  const value = String(path).trim();

  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  if (value.startsWith("./") || value.startsWith("../")) return value;

  return `./${value.replace(/^\/+/, "")}`;
}

function updateTabState() {
  [...els.categoryTabs.querySelectorAll(".tab")].forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.category === state.category);
  });
}

function renderStaticLists() {
  const franchises = [...new Set(allGames.map(game => game.franchise))].sort((a, b) => a.localeCompare(b, "fr"));

  els.franchiseFilter.innerHTML = `
    <option value="all">Toutes</option>
    ${franchises.map(franchise => `<option value="${escapeHtml(franchise)}">${escapeHtml(franchise)}</option>`).join("")}
  `;

  els.franchiseChips.innerHTML = `
    <button class="chip is-active" data-franchise="all" type="button">Toutes</button>
    ${franchises.map(franchise => {
      const count = allGames.filter(game => game.franchise === franchise).length;
      return `<button class="chip" data-franchise="${escapeHtml(franchise)}" type="button">${escapeHtml(franchise)} (${count})</button>`;
    }).join("")}
  `;

  els.franchiseChips.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-franchise]");
    if (!chip) return;

    state.franchise = chip.dataset.franchise;
    els.franchiseFilter.value = state.franchise;
    syncFranchiseChips();
    render();
  });
}

function syncFranchiseChips() {
  [...els.franchiseChips.querySelectorAll(".chip")].forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.franchise === state.franchise);
  });
}

function render() {
  renderStats();

  let filtered = [...allGames];

  if (state.category === "favorites") {
    filtered = filtered.filter(game => game.favorite);
  } else if (state.category !== "all") {
    filtered = filtered.filter(game => game.status === state.category);
  }

  if (state.franchise !== "all") {
    filtered = filtered.filter(game => game.franchise === state.franchise);
  }

  if (state.search) {
    filtered = filtered.filter(game => {
      const haystack = [
        game.title,
        game.franchise,
        game.platform,
        game.comment,
        ...game.tags
      ].join(" ").toLowerCase();

      return haystack.includes(state.search);
    });
  }

  filtered = sortGames(filtered);

  els.resultsCount.textContent = `${filtered.length} jeu${filtered.length > 1 ? "x" : ""}`;

  renderGroupedGames(filtered);
}

function renderStats() {
  els.totalCount.textContent = allGames.length;
  els.favoriteCount.textContent = allGames.filter(game => game.favorite).length;
  els.doneCount.textContent = allGames.filter(game => game.status === "fait").length;
  els.progressCount.textContent = allGames.filter(game => game.status === "en-cours").length;
}

function sortGames(games) {
  const sorted = [...games];

  switch (state.sort) {
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title, "fr"));

    case "year-desc":
      return sorted.sort((a, b) => (b.release_year || 0) - (a.release_year || 0));

    case "status-asc":
      return sorted.sort((a, b) => STATUS_LABELS[a.status].localeCompare(STATUS_LABELS[b.status], "fr"));

    case "rating-desc":
    default:
      return sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title, "fr"));
  }
}

function renderGroupedGames(games) {
  if (!games.length) {
    els.gamesContainer.innerHTML = `
      <div class="empty-state">
        Aucun jeu ne correspond aux filtres actuels.
      </div>
    `;
    return;
  }

  const groups = groupBy(games, game => game.franchise);

  els.gamesContainer.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([franchise, items]) => `
      <section class="group-block">
        <div class="group-title">
          <h3>${escapeHtml(franchise)}</h3>
          <span>${items.length} jeu${items.length > 1 ? "x" : ""}</span>
        </div>

        <div class="games-grid">
          ${items.map(renderCard).join("")}
        </div>
      </section>
    `)
    .join("");
}

function renderCard(game) {
  const cover = game.cover
    ? `<img src="${escapeAttribute(game.cover)}" alt="Cover de ${escapeAttribute(game.title)}" loading="lazy" />`
    : `<div class="no-cover">Aucune image</div>`;

  const rating = game.rating !== null ? `${game.rating}/20` : "Non noté";
  const platform = game.platform ? `<span class="badge">${escapeHtml(game.platform)}</span>` : "";
  const year = game.release_year ? `<span class="badge">${game.release_year}</span>` : "";
  const favorite = game.favorite ? `<div class="favorite-badge">★ Favori</div>` : "";
  const tags = game.tags.length
    ? `<div class="tags">${game.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
    : "";

  return `
    <article class="game-card">
      <div class="game-cover">
        ${favorite}
        ${cover}
      </div>

      <div class="card-body">
        <div class="card-head">
          <h4>${escapeHtml(game.title)}</h4>
          <div class="meta">
            <span class="badge status-${escapeAttribute(game.status)}">${escapeHtml(STATUS_LABELS[game.status])}</span>
            <span class="badge">${escapeHtml(rating)}</span>
            ${platform}
            ${year}
          </div>
        </div>

        <p class="comment">${escapeHtml(game.comment || "Aucun commentaire.")}</p>
        ${tags}
      </div>
    </article>
  `;
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}