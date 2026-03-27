const STATUS_LABELS = {
  "fait": "Fait",
  "en-cours": "En cours",
  "a-faire": "À faire",
  "abandonne": "Abandonné"
};

const REVEAL_VIEWPORT_THRESHOLD_RATIO = 0.98;
const REVEAL_FALLBACK_DELAY_MS = 180;

let revealObserver = null;
let infiniteScrollObserver = null;
let revealFallbackTimer = null;

const state = {
  allGames: [],
  selectedGameId: null,
  activeFilter: "all",
  search: "",
  franchise: "all",
  platform: "all",
  year: "all",
  tag: "",
  sort: "featured",
  viewMode: "grid",
  visibleCount: 24
};

const els = {
  heroBackdrop: document.getElementById("heroBackdrop"),
  heroMiniList: document.getElementById("heroMiniList"),
  heroFranchise: document.getElementById("heroFranchise"),
  heroTitle: document.getElementById("heroTitle"),
  heroSubtitle: document.getElementById("heroSubtitle"),
  heroMeta: document.getElementById("heroMeta"),
  heroDescription: document.getElementById("heroDescription"),
  heroSideCover: document.getElementById("heroSideCover"),
  heroSideTitle: document.getElementById("heroSideTitle"),
  heroSideInfo: document.getElementById("heroSideInfo"),
  showSelectedBtn: document.getElementById("showSelectedBtn"),
  showFavoritesBtn: document.getElementById("showFavoritesBtn"),

  statTotal: document.getElementById("statTotal"),
  statFavorites: document.getElementById("statFavorites"),
  statDone: document.getElementById("statDone"),
  statProgress: document.getElementById("statProgress"),

  searchInput: document.getElementById("searchInput"),
  statusTabs: document.getElementById("statusTabs"),
  franchiseFilter: document.getElementById("franchiseFilter"),
  platformFilter: document.getElementById("platformFilter"),
  yearFilter: document.getElementById("yearFilter"),
  sortFilter: document.getElementById("sortFilter"),
  viewToggle: document.getElementById("viewToggle"),
  franchiseChips: document.getElementById("franchiseChips"),
  activeTagFilter: document.getElementById("activeTagFilter"),
  activeTagChip: document.getElementById("activeTagChip"),
  clearTagFilter: document.getElementById("clearTagFilter"),
  resultsInfo: document.getElementById("resultsInfo"),
  favoritesGrid: document.getElementById("favoritesGrid"),
  favoritesInfo: document.getElementById("favoritesInfo"),
  selectedGrid: document.getElementById("selectedGrid"),
  scrollSentinel: document.getElementById("scrollSentinel"),
  franchiseSections: document.getElementById("franchiseSections"),
  gamesPage: document.querySelector(".games-page")
};

init();

async function init() {
  bindEvents();

  try {
    const response = await fetch("./data/games.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Impossible de charger data/games.json (${response.status})`);
    }

    const payload = await response.json();
    const games = Array.isArray(payload.games) ? payload.games.map(normalizeGame) : [];

    state.allGames = games;
    state.selectedGameId = pickFeaturedGame(games)?.id || null;

    renderStats();
    renderFilterLists();
    renderHero();
    renderFavoritesSection();
    renderSelectedGrid();
    renderFranchiseSections();
    setupInfiniteScroll();
    setupAmbientBg();
  } catch (error) {
    console.error(error);
    showGlobalError();
  }
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    state.visibleCount = 24;
    renderSelectedGrid();
    renderFranchiseSections();
  });

  els.statusTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    state.activeFilter = button.dataset.filter;
    state.visibleCount = 24;
    [...els.statusTabs.querySelectorAll(".chip")].forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.filter === state.activeFilter);
    });

    renderSelectedGrid();
    renderFranchiseSections();
  });

  els.franchiseFilter.addEventListener("change", (event) => {
    state.franchise = event.target.value;
    state.visibleCount = 24;
    syncFranchiseChips();
    renderSelectedGrid();
    renderFranchiseSections();
  });

  els.platformFilter.addEventListener("change", (event) => {
    state.platform = event.target.value;
    state.visibleCount = 24;
    renderSelectedGrid();
    renderFranchiseSections();
  });

  els.yearFilter.addEventListener("change", (event) => {
    state.year = event.target.value;
    state.visibleCount = 24;
    renderSelectedGrid();
    renderFranchiseSections();
  });

  els.sortFilter.addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderSelectedGrid();
    renderFranchiseSections();
  });

  els.viewToggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    setViewMode(button.dataset.view);
  });

  els.franchiseChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-franchise]");
    if (!button) return;

    state.franchise = button.dataset.franchise;
    state.visibleCount = 24;
    els.franchiseFilter.value = state.franchise;
    syncFranchiseChips();
    renderSelectedGrid();
    renderFranchiseSections();
  });

  els.clearTagFilter.addEventListener("click", () => {
    state.tag = "";
    state.visibleCount = 24;
    els.activeTagFilter.hidden = true;
    renderSelectedGrid();
    renderFranchiseSections();
  });

  els.showSelectedBtn.addEventListener("click", () => {
    const selected = getSelectedGame();
    if (!selected) return;

    const card = document.querySelector(`[data-card-id="${cssEscape(selected.id)}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  els.showFavoritesBtn.addEventListener("click", () => {
    state.activeFilter = "favorites";
    state.visibleCount = 24;
    [...els.statusTabs.querySelectorAll(".chip")].forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.filter === "favorites");
    });
    renderSelectedGrid();
    renderFranchiseSections();
    document.getElementById("favoritesSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function normalizeGame(game) {
  return {
    id: String(game.id || cryptoRandomFallback()).trim(),
    title: String(game.title || "Sans titre").trim(),
    franchise: String(game.franchise || "Sans franchise").trim(),
    status: normalizeStatus(game.status),
    favorite: Boolean(game.favorite),
    rating: normalizeRating(game.rating),
    platform: String(game.platform || "").trim(),
    release_year: normalizeYear(game.release_year),
    cover: normalizeCover(game.cover),
    comment: String(game.comment || "").trim(),
    tags: Array.isArray(game.tags)
      ? game.tags.map(tag => String(tag).trim()).filter(Boolean)
      : []
  };
}

function normalizeStatus(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");

  if (["fait", "termine", "terminee"].includes(v)) return "fait";
  if (["en-cours", "encours", "progress"].includes(v)) return "en-cours";
  if (["a-faire", "afaire", "todo", "backlog"].includes(v)) return "a-faire";
  if (["abandonne", "abandonné", "dropped"].includes(v)) return "abandonne";
  return "a-faire";
}

function normalizeRating(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(20, n)) : null;
}

function normalizeYear(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeCover(value) {
  if (!value) return "";
  const path = String(value).trim();

  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith("./") || path.startsWith("../") || path.startsWith("/")) return path;
  return `./${path.replace(/^\/+/, "")}`;
}

function cryptoRandomFallback() {
  return `game-${Math.random().toString(36).slice(2, 10)}`;
}

function pickFeaturedGame(games) {
  const sorted = [...games].sort((a, b) => {
    const scoreA = featuredScore(a);
    const scoreB = featuredScore(b);
    return scoreB - scoreA || a.title.localeCompare(b.title, "fr");
  });

  return sorted[0] || null;
}

function featuredScore(game) {
  return (game.favorite ? 100 : 0)
    + (game.rating ?? 0) * 5
    + (game.status === "en-cours" ? 20 : 0)
    + (game.status === "fait" ? 10 : 0);
}

function getSelectedGame() {
  return state.allGames.find((game) => game.id === state.selectedGameId) || pickFeaturedGame(state.allGames);
}

function renderStats() {
  els.statTotal.textContent = state.allGames.length;
  els.statFavorites.textContent = state.allGames.filter(g => g.favorite).length;
  els.statDone.textContent = state.allGames.filter(g => g.status === "fait").length;
  els.statProgress.textContent = state.allGames.filter(g => g.status === "en-cours").length;
}

function renderFilterLists() {
  const franchises = [...new Set(state.allGames.map(game => game.franchise))].sort((a, b) => a.localeCompare(b, "fr"));

  els.franchiseFilter.innerHTML = `
    <option value="all">Toutes</option>
    ${franchises.map(franchise => `<option value="${escapeHtml(franchise)}">${escapeHtml(franchise)}</option>`).join("")}
  `;

  const platforms = [...new Set(state.allGames.map(g => g.platform).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  els.platformFilter.innerHTML = `
    <option value="all">Toutes</option>
    ${platforms.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
  `;

  const years = [...new Set(state.allGames.map(g => g.release_year).filter(Boolean))].sort((a, b) => b - a);
  els.yearFilter.innerHTML = `
    <option value="all">Toutes</option>
    ${years.map(y => `<option value="${y}">${y}</option>`).join("")}
  `;

  els.franchiseChips.innerHTML = `
    <button class="franchise-filter-chip active" data-franchise="all" type="button">Toutes</button>
    ${franchises.map(franchise => {
      const total = state.allGames.filter(game => game.franchise === franchise).length;
      return `<button class="franchise-filter-chip" data-franchise="${escapeHtml(franchise)}" type="button">${escapeHtml(franchise)} (${total})</button>`;
    }).join("")}
  `;

  syncFranchiseChips();
}

function syncFranchiseChips() {
  [...els.franchiseChips.querySelectorAll(".franchise-filter-chip")].forEach((button) => {
    button.classList.toggle("active", button.dataset.franchise === state.franchise);
  });
}

function renderHero() {
  const selected = getSelectedGame();

  if (!selected) {
    els.heroBackdrop.style.backgroundImage = "none";
    els.heroTitle.textContent = "Aucun jeu";
    els.heroFranchise.textContent = "Bibliothèque vide";
    els.heroSubtitle.textContent = "";
    els.heroMeta.innerHTML = "";
    els.heroDescription.textContent = "Ajoute des jeux dans l'admin pour remplir cette page.";
    els.heroMiniList.innerHTML = "";
    els.heroSideCover.innerHTML = `<div class="hero-mini-fallback">Aucune image</div>`;
    els.heroSideTitle.textContent = "Aucun jeu";
    els.heroSideInfo.textContent = "Ajoute du contenu dans l'admin.";
    return;
  }

  els.heroBackdrop.style.backgroundImage = selected.cover
    ? `url("${escapeAttribute(selected.cover)}")`
    : "linear-gradient(135deg, rgba(77,163,255,.35), rgba(126,198,255,.18))";

  els.heroFranchise.textContent = selected.franchise;
  els.heroTitle.textContent = formatHeroTitle(selected.title);
  els.heroSubtitle.textContent = selected.platform || "Bibliothèque de jeux";
  els.heroMeta.innerHTML = buildHeroMeta(selected);
  els.heroDescription.textContent = selected.comment || "Aucun commentaire pour ce jeu.";
  els.heroSideTitle.textContent = selected.title;
  els.heroSideInfo.textContent = buildSideInfo(selected);
  els.heroSideCover.innerHTML = renderCover(selected.cover, selected.title, "hero-mini-fallback");

  renderHeroMiniList();
  applyAmbientColor(selected);
}

function renderHeroMiniList() {
  const ranked = [...state.allGames]
    .sort((a, b) => featuredScore(b) - featuredScore(a))
    .slice(0, 12);

  els.heroMiniList.innerHTML = ranked.map((game) => `
    <button
      class="hero-mini-card ${game.id === state.selectedGameId ? "active" : ""}"
      type="button"
      data-hero-id="${escapeAttribute(game.id)}"
      aria-label="Afficher ${escapeAttribute(game.title)}"
      title="${escapeAttribute(game.title)}"
    >
      ${renderCover(game.cover, game.title, "hero-mini-fallback")}
    </button>
  `).join("");

  [...els.heroMiniList.querySelectorAll("[data-hero-id]")].forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedGameId = button.dataset.heroId;
      renderHero();
    });
  });
}

function buildHeroMeta(game) {
  const items = [];

  items.push(`<span class="hero-badge ${statusTone(game.status)}">${escapeHtml(STATUS_LABELS[game.status])}</span>`);

  if (game.favorite) {
    items.push(`<span class="hero-badge">★ Favori</span>`);
  }

  if (game.rating !== null) {
    items.push(`<span class="hero-badge">${game.rating}/20</span>`);
  }

  if (game.release_year) {
    items.push(`<span class="hero-badge">${game.release_year}</span>`);
  }

  if (game.platform) {
    items.push(`<span class="hero-badge">${escapeHtml(game.platform)}</span>`);
  }

  return items.join("");
}

function buildSideInfo(game) {
  const parts = [];
  if (game.platform) parts.push(game.platform);
  if (game.release_year) parts.push(String(game.release_year));
  if (game.rating !== null) parts.push(`${game.rating}/20`);
  return parts.join(" • ") || "Sélection automatique";
}

function renderSelectedGrid() {
  const filtered = sortGames(applyFilters(state.allGames));
  els.resultsInfo.textContent = `${filtered.length} résultat${filtered.length > 1 ? "s" : ""}`;

  if (!filtered.length) {
    els.selectedGrid.innerHTML = `<div class="empty-state">Aucun jeu ne correspond aux filtres actuels.</div>`;
    return;
  }

  const visible = filtered.slice(0, state.visibleCount);
  els.selectedGrid.innerHTML = visible.map(game => renderGameCard(game)).join("");
  bindCardClicks(els.selectedGrid);
  bindTagClicks(els.selectedGrid);
  setupTiltCards(els.selectedGrid);
  setupScrollReveal();
}

function renderFranchiseSections() {
  const filtered = applyFilters(state.allGames);

  if (!filtered.length) {
    els.franchiseSections.innerHTML = `<div class="empty-state">Aucune section disponible.</div>`;
    return;
  }

  const grouped = groupBy(filtered, game => game.franchise);

  els.franchiseSections.innerHTML = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([franchise, games]) => `
      <section class="franchise-block">
        <div class="franchise-head">
          <h3>${escapeHtml(franchise)}</h3>
          <span>${games.length} jeu${games.length > 1 ? "x" : ""}</span>
        </div>

        <div class="franchise-rail">
          ${sortGames(games).slice(0, 8).map(renderGameCard).join("")}
        </div>
      </section>
    `)
    .join("");

  bindCardClicks(els.franchiseSections);
  bindTagClicks(els.franchiseSections);
  setupTiltCards(els.franchiseSections);
  setupScrollReveal();
}

function bindCardClicks(container) {
  [...container.querySelectorAll("[data-select-id]")].forEach((element) => {
    element.addEventListener("click", () => {
      state.selectedGameId = element.dataset.selectId;
      renderHero();
      document.getElementById("heroSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function applyFilters(games) {
  let result = [...games];

  if (state.activeFilter === "favorites") {
    result = result.filter(game => game.favorite);
  } else if (state.activeFilter !== "all") {
    result = result.filter(game => game.status === state.activeFilter);
  }

  if (state.franchise !== "all") {
    result = result.filter(game => game.franchise === state.franchise);
  }

  if (state.platform !== "all") {
    result = result.filter(game => game.platform === state.platform);
  }

  if (state.year !== "all") {
    result = result.filter(game => String(game.release_year) === state.year);
  }

  if (state.tag) {
    result = result.filter(game => game.tags.includes(state.tag));
  }

  if (state.search) {
    result = result.filter((game) => {
      const text = [
        game.title,
        game.franchise,
        game.platform,
        game.comment,
        ...game.tags
      ].join(" ").toLowerCase();

      return text.includes(state.search);
    });
  }

  return result;
}

function sortGames(games) {
  const cloned = [...games];

  switch (state.sort) {
    case "rating-desc":
      return cloned.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.title.localeCompare(b.title, "fr"));

    case "title-asc":
      return cloned.sort((a, b) => a.title.localeCompare(b.title, "fr"));

    case "year-desc":
      return cloned.sort((a, b) => (b.release_year ?? 0) - (a.release_year ?? 0) || a.title.localeCompare(b.title, "fr"));

    case "featured":
    default:
      return cloned.sort((a, b) => featuredScore(b) - featuredScore(a) || a.title.localeCompare(b.title, "fr"));
  }
}

function renderGameCard(game) {
  const cover = renderCover(game.cover, game.title, "game-cover-fallback");
  const favorite = game.favorite ? `<span class="corner-badge favorite">★ Favori</span>` : "";
  const rating = game.rating !== null ? `<span class="meta-pill">${game.rating}/20</span>` : "";
  const platform = game.platform ? `<span class="meta-pill">${escapeHtml(game.platform)}</span>` : "";
  const year = game.release_year ? `<span class="meta-pill">${game.release_year}</span>` : "";
  const tags = game.tags.length
    ? `<div class="game-tags">${game.tags.slice(0, 4).map(tag => `<button class="game-tag" data-tag="${escapeAttribute(tag)}" type="button">${escapeHtml(tag)}</button>`).join("")}</div>`
    : "";

  return `
    <article class="game-card reveal" data-card-id="${escapeAttribute(game.id)}">
      <div class="game-cover" data-select-id="${escapeAttribute(game.id)}">
        ${cover}
        <div class="game-card-badges">
          <span class="corner-badge">${escapeHtml(STATUS_LABELS[game.status])}</span>
          ${favorite}
        </div>
      </div>

      <div class="game-body">
        <h3 class="game-title">${escapeHtml(game.title)}</h3>
        <p class="game-franchise">${escapeHtml(game.franchise)}</p>

        <div class="game-meta">
          <span class="meta-pill status-${escapeAttribute(game.status)}">${escapeHtml(STATUS_LABELS[game.status])}</span>
          ${rating}
          ${platform}
          ${year}
        </div>

        <p class="game-comment">${escapeHtml(game.comment || "Aucun commentaire.")}</p>
        ${tags}
      </div>
    </article>
  `;
}

function renderCover(cover, title, fallbackClass) {
  if (!cover) {
    return `<div class="${fallbackClass}">Aucune image<br>${escapeHtml(title)}</div>`;
  }

  return `<img src="${escapeAttribute(cover)}" alt="Cover de ${escapeAttribute(title)}" loading="lazy" />`;
}

function formatHeroTitle(title) {
  return title;
}

function statusTone(status) {
  if (status === "fait") return "good";
  if (status === "en-cours") return "warn";
  if (status === "abandonne") return "danger";
  return "";
}

function showGlobalError() {
  els.heroTitle.textContent = "Erreur";
  els.heroFranchise.textContent = "Chargement impossible";
  els.heroSubtitle.textContent = "";
  els.heroMeta.innerHTML = "";
  els.heroDescription.textContent = "Vérifie le fichier data/games.json.";
  els.heroMiniList.innerHTML = "";
  els.heroSideCover.innerHTML = `<div class="hero-mini-fallback">Erreur</div>`;
  els.heroSideTitle.textContent = "Impossible de charger";
  els.heroSideInfo.textContent = "Vérifie la structure JSON.";
  els.selectedGrid.innerHTML = `<div class="empty-state">Impossible de charger la bibliothèque.</div>`;
  els.franchiseSections.innerHTML = "";
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function renderFavoritesSection() {
  const favorites = state.allGames.filter(g => g.favorite);
  const section = document.getElementById("favoritesSection");

  if (!favorites.length) {
    if (section) section.hidden = true;
    return;
  }

  if (section) section.hidden = false;
  if (els.favoritesInfo) {
    els.favoritesInfo.textContent = `${favorites.length} jeu${favorites.length > 1 ? "x" : ""}`;
  }

  if (els.favoritesGrid) {
    els.favoritesGrid.innerHTML = sortGames(favorites).map(renderGameCard).join("");
    bindCardClicks(els.favoritesGrid);
    bindTagClicks(els.favoritesGrid);
    setupTiltCards(els.favoritesGrid);
  }
}

function bindTagClicks(container) {
  [...container.querySelectorAll("[data-tag]")].forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const tag = button.dataset.tag;
      if (!tag) return;

      state.tag = tag;
      state.visibleCount = 24;
      els.activeTagChip.textContent = `# ${tag}`;
      els.activeTagFilter.hidden = false;
      renderSelectedGrid();
      renderFranchiseSections();
      document.getElementById("controlPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function setViewMode(mode) {
  state.viewMode = mode;

  [...els.viewToggle.querySelectorAll(".view-btn")].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === mode);
  });

  const page = els.gamesPage;
  page.classList.remove("view-grid", "view-compact", "view-shelf");
  page.classList.add(`view-${mode}`);
}

function setupTiltCards(container) {
  if (window.matchMedia("(hover: none)").matches) return;

  [...container.querySelectorAll(".game-card")].forEach((card) => {
    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--ry", `${x * 9}deg`);
      card.style.setProperty("--rx", `${-y * 9}deg`);
    });

    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ty", "0px");
    });
  });
}

function setupScrollReveal() {
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
  }

  [...document.querySelectorAll(".reveal:not(.revealed)")].forEach((el) => {
    revealObserver.observe(el);
    revealIfVisible(el);
  });

  if (revealFallbackTimer) {
    window.clearTimeout(revealFallbackTimer);
  }

  revealFallbackTimer = window.setTimeout(() => {
    [...document.querySelectorAll(".reveal:not(.revealed)")].forEach((el) => {
      el.classList.add("revealed");
      if (revealObserver) {
        revealObserver.unobserve(el);
      }
    });
    revealFallbackTimer = null;
  }, REVEAL_FALLBACK_DELAY_MS);
}

function revealIfVisible(element) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  if (!viewportHeight) return;

  if (rect.top < viewportHeight * REVEAL_VIEWPORT_THRESHOLD_RATIO && rect.bottom > 0) {
    element.classList.add("revealed");
    if (revealObserver) {
      revealObserver.unobserve(element);
    }
  }
}

function setupInfiniteScroll() {
  if (!els.scrollSentinel || infiniteScrollObserver) return;

  infiniteScrollObserver = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;

    const filtered = sortGames(applyFilters(state.allGames));
    if (state.visibleCount >= filtered.length) return;

    state.visibleCount += 12;
    renderSelectedGrid();
  }, { rootMargin: "200px" });

  infiniteScrollObserver.observe(els.scrollSentinel);
}

function setupAmbientBg() {
  if (!document.getElementById("ambientBg")) {
    const div = document.createElement("div");
    div.id = "ambientBg";
    document.body.insertBefore(div, document.body.firstChild);
  }
}

function applyAmbientColor(game) {
  if (!game || !game.cover) return;

  extractDominantColor(game.cover).then((color) => {
    if (!color) return;
    const bg = document.getElementById("ambientBg");
    if (bg) {
      bg.style.background = `radial-gradient(ellipse at 50% 0%, ${color}22 0%, transparent 70%)`;
    }
  });
}

function extractDominantColor(imageUrl) {
  return new Promise((resolve) => {
    if (!imageUrl) { resolve(null); return; }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 40, 40);
        const data = ctx.getImageData(0, 0, 40, 40).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i + 3 < data.length; i += 16) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (count === 0) { resolve(null); return; }
        resolve(`rgb(${Math.round(r / count)},${Math.round(g / count)},${Math.round(b / count)})`);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
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

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
