const STATUS_LABELS = {
  "fait": "Fait",
  "en-cours": "En cours",
  "a-faire": "À faire",
  "abandonne": "Abandonné"
};

const VIEWPORT_REVEAL_THRESHOLD = 0.98;
const REVEAL_FALLBACK_DELAY = 180;
const COUNTUP_INTERSECTION_THRESHOLD = 0.4;
const COUNTUP_ANIMATION_DURATION_MS = 900;

let revealObserver = null;
let infiniteScrollObserver = null;
let countUpObserver = null;
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
  heroMeta: document.getElementById("heroMeta"),
  heroDescription: document.getElementById("heroDescription"),
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
  filtersSummary: document.getElementById("filtersSummary"),
  clearAllFilters: document.getElementById("clearAllFilters"),
  activeTagFilter: document.getElementById("activeTagFilter"),
  activeTagChip: document.getElementById("activeTagChip"),
  clearTagFilter: document.getElementById("clearTagFilter"),
  resultsInfo: document.getElementById("resultsInfo"),
  resultsDetails: document.getElementById("resultsDetails"),
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
    setupCountUpObserver();
  } catch (error) {
    console.error(error);
    showGlobalError();
  }
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    state.visibleCount = 24;
    rerenderLibrary();
  });

  els.statusTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    state.activeFilter = button.dataset.filter;
    state.visibleCount = 24;
    [...els.statusTabs.querySelectorAll(".chip")].forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.filter === state.activeFilter);
    });

    rerenderLibrary();
  });

  els.franchiseFilter.addEventListener("change", (event) => {
    state.franchise = event.target.value;
    state.visibleCount = 24;
    syncFranchiseChips();
    rerenderLibrary();
  });

  els.platformFilter.addEventListener("change", (event) => {
    state.platform = event.target.value;
    state.visibleCount = 24;
    rerenderLibrary();
  });

  els.yearFilter.addEventListener("change", (event) => {
    state.year = event.target.value;
    state.visibleCount = 24;
    rerenderLibrary();
  });

  els.sortFilter.addEventListener("change", (event) => {
    state.sort = event.target.value;
    rerenderLibrary();
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
    rerenderLibrary();
  });

  els.clearTagFilter.addEventListener("click", () => {
    state.tag = "";
    state.visibleCount = 24;
    els.activeTagFilter.hidden = true;
    rerenderLibrary();
  });

  els.clearAllFilters.addEventListener("click", () => {
    resetFilters();
    rerenderLibrary();
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
    rerenderLibrary();
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
  const total = state.allGames.length;
  const favorites = state.allGames.filter(g => g.favorite).length;
  const done = state.allGames.filter(g => g.status === "fait").length;
  const progress = state.allGames.filter(g => g.status === "en-cours").length;

  els.statTotal.dataset.target = total;
  els.statFavorites.dataset.target = favorites;
  els.statDone.dataset.target = done;
  els.statProgress.dataset.target = progress;

  els.statTotal.textContent = total;
  els.statFavorites.textContent = favorites;
  els.statDone.textContent = done;
  els.statProgress.textContent = progress;

  renderStatusTabCounts();
}

function setupCountUpObserver() {
  const strip = document.getElementById("statsStrip");
  if (!strip) return;

  countUpObserver = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    countUpObserver.disconnect();

    [...strip.querySelectorAll(".stat-number")].forEach((el) => {
      const target = Number(el.dataset.target) || 0;
      animateCountUp(el, target);
    });
  }, { threshold: COUNTUP_INTERSECTION_THRESHOLD });

  countUpObserver.observe(strip);
}

function animateCountUp(el, target) {
  if (target === 0) { el.textContent = "0"; return; }

  const duration = COUNTUP_ANIMATION_DURATION_MS;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target;
    }
  }

  requestAnimationFrame(step);
}

function renderFilterLists() {
  const franchises = [...new Set(state.allGames.map(game => game.franchise))].sort((a, b) => a.localeCompare(b, "fr"));

  els.franchiseFilter.innerHTML = `
    <option value="all">Toutes licences</option>
    ${franchises.map(franchise => `<option value="${escapeHtml(franchise)}">${escapeHtml(franchise)}</option>`).join("")}
  `;

  const platforms = [...new Set(state.allGames.map(g => g.platform).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  els.platformFilter.innerHTML = `
    <option value="all">Toutes plateformes</option>
    ${platforms.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
  `;

  const years = [...new Set(state.allGames.map(g => g.release_year).filter(Boolean))].sort((a, b) => b - a);
  els.yearFilter.innerHTML = `
    <option value="all">Toutes années</option>
    ${years.map(y => `<option value="${y}">${y}</option>`).join("")}
  `;

  els.franchiseChips.innerHTML = `
    <button class="franchise-filter-chip active" data-franchise="all" type="button">Toutes</button>
    ${franchises.map(franchise => {
      const total = state.allGames.filter(game => game.franchise === franchise).length;
      return `<button class="franchise-filter-chip" data-franchise="${escapeHtml(franchise)}" type="button">${escapeHtml(franchise)} <strong>${total}</strong></button>`;
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
    els.heroMeta.innerHTML = "";
    els.heroDescription.textContent = "Ajoute des jeux dans l'admin pour remplir cette page.";
    els.heroMiniList.innerHTML = "";
    return;
  }

  els.heroBackdrop.style.backgroundImage = selected.cover
    ? `url("${escapeAttribute(selected.cover)}")`
    : "linear-gradient(135deg, rgba(77,163,255,.35), rgba(126,198,255,.18))";

  els.heroFranchise.textContent = selected.franchise;
  els.heroTitle.textContent = formatHeroTitle(selected.title);
  els.heroMeta.innerHTML = buildHeroMeta(selected);
  els.heroDescription.textContent = selected.comment || "Aucun commentaire pour ce jeu.";

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

function renderSelectedGrid() {
  const filtered = sortGames(applyFilters(state.allGames));
  const visible = filtered.slice(0, state.visibleCount);

  els.resultsInfo.textContent = `${filtered.length} résultat${filtered.length > 1 ? "s" : ""}`;
  updateFilterSummary(filtered.length, visible.length);

  if (!filtered.length) {
    els.selectedGrid.innerHTML = `<div class="empty-state">Aucun jeu ne correspond aux filtres actuels.</div>`;
    if (els.resultsDetails) {
      els.resultsDetails.textContent = "Essaie de modifier la recherche, le tri ou un filtre actif.";
    }
    return;
  }

  if (els.resultsDetails) {
    els.resultsDetails.textContent = visible.length < filtered.length
      ? `Affichage de ${visible.length} jeu${visible.length > 1 ? "x" : ""} sur ${filtered.length}. Fais défiler pour charger la suite.`
      : `Affichage complet de ${filtered.length} jeu${filtered.length > 1 ? "x" : ""}.`;
  }

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
    .map(([franchise, games], index) => `
      <section class="franchise-block ${index === 0 ? "is-open" : ""}" data-franchise-block>
        <div class="franchise-head" role="button" aria-expanded="${index === 0}" tabindex="0">
          <div class="franchise-head-left">
            <h3>${escapeHtml(franchise)}</h3>
            <span class="franchise-head-count">${games.length} jeu${games.length > 1 ? "x" : ""}</span>
          </div>
          <span class="franchise-head-chevron" aria-hidden="true">▾</span>
        </div>
        <div class="franchise-body">
          <div class="franchise-rail">
            ${sortGames(games).slice(0, 8).map(renderGameCard).join("")}
          </div>
        </div>
      </section>
    `)
    .join("");

  // Bind accordion toggles
  [...els.franchiseSections.querySelectorAll("[data-franchise-block]")].forEach((block) => {
    const head = block.querySelector(".franchise-head");
    head.addEventListener("click", () => toggleFranchiseBlock(block));
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleFranchiseBlock(block);
      }
    });
  });

  bindCardClicks(els.franchiseSections);
  bindTagClicks(els.franchiseSections);
  setupTiltCards(els.franchiseSections);
  setupScrollReveal();
}

function toggleFranchiseBlock(block) {
  const isOpen = block.classList.toggle("is-open");
  const head = block.querySelector(".franchise-head");
  head.setAttribute("aria-expanded", String(isOpen));
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
  const scoreValue = game.rating !== null ? `${game.rating}/20` : "N/R";
  const footerLine = [STATUS_LABELS[game.status], game.platform || "Plateforme à renseigner"].join(" • ");
  const tags = game.tags.length
    ? `<div class="game-tags">${game.tags.slice(0, 4).map(tag => `<button class="game-tag" data-tag="${escapeAttribute(tag)}" type="button">${escapeHtml(tag)}</button>`).join("")}</div>`
    : "";

  return `
    <article class="game-card reveal ${game.id === state.selectedGameId ? "is-selected" : ""}" data-card-id="${escapeAttribute(game.id)}">
      <div class="game-cover" data-select-id="${escapeAttribute(game.id)}">
        ${cover}
        <div class="game-card-badges">
          <span class="corner-badge">${escapeHtml(STATUS_LABELS[game.status])}</span>
          ${favorite}
        </div>
      </div>

      <div class="game-body">
        <div class="game-heading">
          <div>
            <p class="game-overline">${escapeHtml(game.franchise)}</p>
            <h3 class="game-title">${escapeHtml(game.title)}</h3>
            <p class="game-subline">${escapeHtml(game.comment ? "Résumé disponible" : "Aucun commentaire enregistré")}</p>
          </div>
          <button class="game-select-btn" data-select-id="${escapeAttribute(game.id)}" type="button">Mettre en avant</button>
        </div>

        <div class="game-meta">
          <span class="meta-pill status-${escapeAttribute(game.status)}">${escapeHtml(STATUS_LABELS[game.status])}</span>
          ${rating}
          ${platform}
          ${year}
        </div>

        <p class="game-comment">${escapeHtml(game.comment || "Aucun commentaire.")}</p>
        ${tags}

        <div class="game-footer">
          <div class="game-score">
            <span>Note perso</span>
            <strong>${scoreValue}</strong>
          </div>
          <div class="game-footer-line">${escapeHtml(footerLine)}</div>
        </div>
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
  els.heroMeta.innerHTML = "";
  els.heroDescription.textContent = "Vérifie le fichier data/games.json.";
  els.heroMiniList.innerHTML = "";
  els.selectedGrid.innerHTML = `<div class="empty-state">Impossible de charger la bibliothèque.</div>`;
  els.franchiseSections.innerHTML = "";
  if (els.resultsDetails) {
    els.resultsDetails.textContent = "Le contenu n'a pas pu être chargé.";
  }
  if (els.filtersSummary) {
    els.filtersSummary.textContent = "Impossible d'afficher les filtres tant que les données ne sont pas chargées.";
  }
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
    setupScrollReveal();
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
      rerenderLibrary();
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
  }, REVEAL_FALLBACK_DELAY);
}

function revealIfVisible(element) {
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  if (!viewportHeight) return;

  if (rect.top < viewportHeight * VIEWPORT_REVEAL_THRESHOLD && rect.bottom > 0) {
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

function renderStatusTabCounts() {
  [...els.statusTabs.querySelectorAll(".chip")].forEach((button) => {
    const filter = button.dataset.filter;
    const label = button.dataset.label || button.textContent.trim();
    const count = getFilterCount(filter);
    button.innerHTML = `<span>${escapeHtml(label)}</span><strong>${count}</strong>`;
  });
}

function getFilterCount(filter) {
  if (filter === "all") return state.allGames.length;
  if (filter === "favorites") return state.allGames.filter((game) => game.favorite).length;
  return state.allGames.filter((game) => game.status === filter).length;
}

function rerenderLibrary() {
  renderSelectedGrid();
  renderFranchiseSections();
}

function resetFilters() {
  state.activeFilter = "all";
  state.search = "";
  state.franchise = "all";
  state.platform = "all";
  state.year = "all";
  state.tag = "";
  state.sort = "featured";
  state.visibleCount = 24;

  if (els.searchInput) els.searchInput.value = "";
  if (els.franchiseFilter) els.franchiseFilter.value = "all";
  if (els.platformFilter) els.platformFilter.value = "all";
  if (els.yearFilter) els.yearFilter.value = "all";
  if (els.sortFilter) els.sortFilter.value = "featured";

  els.activeTagFilter.hidden = true;
  syncFranchiseChips();

  [...els.statusTabs.querySelectorAll(".chip")].forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === "all");
  });
}

function updateFilterSummary(totalFiltered, visibleCount) {
  if (!els.filtersSummary || !els.clearAllFilters) return;

  const segments = [];
  if (state.activeFilter !== "all") segments.push(state.activeFilter === "favorites" ? "favoris" : STATUS_LABELS[state.activeFilter]);
  if (state.search) segments.push(`recherche « ${state.search} »`);
  if (state.franchise !== "all") segments.push(state.franchise);
  if (state.platform !== "all") segments.push(state.platform);
  if (state.year !== "all") segments.push(state.year);
  if (state.tag) segments.push(`#${state.tag}`);

  if (!segments.length) {
    // No active filters — summary is intentionally left empty; the results count in the section header is sufficient
    els.filtersSummary.textContent = "";
    els.clearAllFilters.hidden = true;
    return;
  }

  els.clearAllFilters.hidden = false;
  els.filtersSummary.textContent = `${totalFiltered} jeu${totalFiltered > 1 ? "x" : ""} pour ${segments.join(" • ")}${visibleCount < totalFiltered ? " • chargement progressif actif" : ""}.`;
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
