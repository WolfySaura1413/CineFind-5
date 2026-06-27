import * as authService from "./services/auth.js";
import * as dbService   from "./services/db.js";
import * as watchmodeService from "./services/watchmode.js";
import { getLogoForSource } from "./utils/constants.js";

// ---------------------------------------------------------------------------
// Global App State
// ---------------------------------------------------------------------------
let currentTab            = "home";
let searchTimeout         = null;
let currentSearchType     = "";
let selectedTitle         = null; // Title currently open in detail modal
let selectedReviewRating  = 0;
let intendedScreenAfterAuth = null;
let hiddenPosterIds = new Set();   // title IDs whose poster the user has hidden
let hiddenPosterNames = {};        // id → name lookup for hidden posters

// ---------------------------------------------------------------------------
// DOM element references
// ---------------------------------------------------------------------------
const DOM = {
  tabs:    document.querySelectorAll(".nav-tab"),
  screens: document.querySelectorAll(".screen-section"),

  // Header
  userStatus: document.getElementById("header-user-status"),

  // Home
  homeSearchTrigger: document.getElementById("home-search-trigger"),
  trendingGrid:      document.getElementById("trending-grid"),

  // Search
  searchInput:       document.getElementById("search-input"),
  searchClearBtn:    document.getElementById("search-clear-btn"),
  filterTabs:        document.querySelectorAll(".filter-tab"),
  searchResultsGrid: document.getElementById("search-results-grid"),
  recentSearches:    document.getElementById("recent-searches"),

  // My Lists
  toggleWatchlistBtn: document.getElementById("toggle-watchlist-btn"),
  toggleWatchedBtn:   document.getElementById("toggle-watched-btn"),
  listsGrid:          document.getElementById("lists-grid"),
  currentListTab:     "watchlist",

  // Profile
  profileEmail:        document.getElementById("profile-email"),
  profileJoined:       document.getElementById("profile-joined"),
  logoutBtn:           document.getElementById("logout-btn"),
  profileReviewsList:  document.getElementById("profile-reviews-list"),
  profileHiddenPosters: document.getElementById("profile-hidden-posters-list"),
  displayNameOptions:  document.getElementById("display-name-options"),

  // Auth Modal
  authModal:         document.getElementById("auth-modal"),
  authCloseBtn:      document.getElementById("auth-close-btn"),
  authErrorBanner:   document.getElementById("auth-error"),
  googleSigninBtn:   document.getElementById("google-signin-btn"),

  // Detail Modal
  detailModal:              document.getElementById("detail-modal"),
  detailCloseBtn:           document.getElementById("detail-close-btn"),
  detailPoster:             document.getElementById("detail-poster"),
  detailTitle:              document.getElementById("detail-title"),
  detailYear:               document.getElementById("detail-year"),
  detailType:               document.getElementById("detail-type"),
  detailUsRating:           document.getElementById("detail-us-rating"),
  detailGenres:             document.getElementById("detail-genres"),
  detailStarsWatchmode:     document.getElementById("detail-stars-watchmode"),
  detailRatingWatchmode:    document.getElementById("detail-rating-watchmode-text"),
  detailStarsCinefind:      document.getElementById("detail-stars-cinefind"),
  detailRatingCinefind:     document.getElementById("detail-rating-cinefind-text"),
  detailBtnWatchlist:       document.getElementById("detail-btn-watchlist"),
  detailBtnWatched:         document.getElementById("detail-btn-watched"),
  detailPlot:               document.getElementById("detail-plot"),
  detailSourcesList:        document.getElementById("detail-sources-list"),
  detailReviewsContainer:   document.getElementById("detail-reviews-container"),
  starsSelector:            document.getElementById("stars-selector"),
  reviewForm:               document.getElementById("review-form"),

  reviewPublic:             document.getElementById("review-public"),

  // Loading overlay
  loadingOverlay: document.getElementById("app-loading-overlay"),
};

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();

  // Wait for Firebase to resolve the first auth state before rendering.
  await authService.authReady;

  // Ensure Firestore listeners are started (auth_change event may have
  // been dispatched before the event listener was registered above).
  const bootUser = authService.getCurrentUser();
  if (bootUser) dbService.initUserListeners(bootUser.id);

  // Hide the loading overlay with a smooth fade.
  DOM.loadingOverlay.classList.add("hidden");
  setTimeout(() => DOM.loadingOverlay.remove(), 450);

  updateUserHeader();
  // Load saved content rating filter on boot
  if (bootUser) loadContentRatingFilter(bootUser.id);
});

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------
function setupEventListeners() {
  // Bottom navigation tabs
  DOM.tabs.forEach(tab => {
    tab.addEventListener("click", () => switchScreen(tab.getAttribute("data-screen")));
  });

  // Home category buttons
  document.getElementById("home-categories").addEventListener("click", (e) => {
    const btn = e.target.closest(".category-btn");
    if (!btn) return;
    const cat = btn.dataset.category;
    if (cat === "mylists") {
      switchScreen("lists");
      return;
    }
    loadCategory(cat);
  });

  // Back button from category results
  document.getElementById("category-back-btn").addEventListener("click", () => {
    document.getElementById("home-categories").style.display = "";
    document.getElementById("home-results").style.display = "none";
    document.getElementById("trending-grid").innerHTML = "";
  });

  // Home search trigger
  DOM.homeSearchTrigger.addEventListener("click", () => {
    switchScreen("search");
    DOM.searchInput.focus();
  });

  // Search input + filter tabs
  DOM.searchInput.addEventListener("input", handleSearchInput);
  DOM.searchInput.addEventListener("focus", () => {
    if (!DOM.searchInput.value.trim()) renderRecentSearches();
  });
  DOM.searchClearBtn.addEventListener("click", () => {
    DOM.searchInput.value = "";
    DOM.searchClearBtn.style.display = "none";
    DOM.searchResultsGrid.innerHTML = emptyStateHtml("🍿", "Type a movie or TV show name to start searching.");
    DOM.recentSearches.style.display = "none";
    DOM.searchInput.focus();
  });
  DOM.recentSearches.addEventListener("click", (e) => {
    const item = e.target.closest(".recent-search-item");
    const del = e.target.closest(".recent-search-del");
    if (del) {
      e.stopPropagation();
      const q = del.dataset.query;
      const searches = getRecentSearches().filter(s => s !== q);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
      renderRecentSearches();
      return;
    }
    if (item) {
      const q = item.dataset.query;
      DOM.searchInput.value = q;
      DOM.searchClearBtn.style.display = "block";
      DOM.recentSearches.style.display = "none";
      triggerSearch();
    }
  });
  document.addEventListener("click", (e) => {
    if (DOM.recentSearches.style.display !== "none" && !e.target.closest("#screen-search .search-header-container") && !e.target.closest("#recent-searches")) {
      DOM.recentSearches.style.display = "none";
    }
  });
  DOM.filterTabs.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.filterTabs.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSearchType = btn.getAttribute("data-type");
      triggerSearch();
    });
  });

  // My Lists toggles
  DOM.toggleWatchlistBtn.addEventListener("click", () => {
    DOM.currentListTab = "watchlist";
    DOM.toggleWatchlistBtn.classList.add("active");
    DOM.toggleWatchedBtn.classList.remove("active");
    renderMyLists();
  });
  DOM.toggleWatchedBtn.addEventListener("click", () => {
    DOM.currentListTab = "watched";
    DOM.toggleWatchedBtn.classList.add("active");
    DOM.toggleWatchlistBtn.classList.remove("active");
    renderMyLists();
  });

  // Auth modal
  DOM.authCloseBtn.addEventListener("click", closeAuthModal);
  DOM.googleSigninBtn.addEventListener("click", handleGoogleSignIn);

  // Detail modal
  DOM.detailCloseBtn.addEventListener("click", () => {
    DOM.detailModal.classList.remove("active");
    DOM.detailPoster.style.display = ""; // reset hidden poster state
    selectedTitle = null;
  });

  // Star rating selector
  DOM.starsSelector.querySelectorAll("span").forEach(span => {
    span.addEventListener("click", () => setReviewRating(parseInt(span.getAttribute("data-val"), 10)));
  });

  // Review form
  DOM.reviewForm.addEventListener("submit", handleReviewSubmit);

  // Emoji picker (delegated)
  document.getElementById("emoji-grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".emoji-option");
    if (!btn) return;
    const emoji = btn.dataset.emoji;
    const user = authService.getCurrentUser();
    if (!user) return;
    // Update preview
    document.querySelector(".profile-avatar").textContent = emoji;
    document.getElementById("avatar-preview").textContent = emoji;
    // Highlight selected
    document.querySelectorAll(".emoji-option").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    // Save
    dbService.getProfile(user.id).then(p => {
      dbService.saveProfile(user.id, p.mode, p.firstName, p.lastName, p.maxContentRating, emoji).then(() => {
        // Also update header
        const headerAvatar = document.getElementById("header-avatar");
        if (headerAvatar) headerAvatar.textContent = emoji;
      });
    });
  });

  // Logout
  DOM.logoutBtn.addEventListener("click", async () => {
    await authService.logout();
    switchScreen("home");
  });

  // Auth state changes (fired by onAuthStateChanged in auth.js)
  window.addEventListener("auth_change", () => {
    const user = authService.getCurrentUser();
    dbService.initUserListeners(user?.id ?? null);
    updateUserHeader();
    if (!user && (currentTab === "lists" || currentTab === "profile")) {
      switchScreen("home");
    }
    // Load hidden posters from Firestore
    hiddenPosterIds = new Set();
    hiddenPosterNames = {};
    if (user) {
      dbService.loadHiddenPosters(user.id).then(data => {
        hiddenPosterIds = data.ids;
        hiddenPosterNames = data.names;
      });
      loadContentRatingFilter(user.id);
    }
  });

  // Firestore real-time list updates
  window.addEventListener("watchlist_change", () => {
    if (currentTab === "lists" && DOM.currentListTab === "watchlist") renderMyLists();
    if (selectedTitle) updateDetailActionsState();
    // Refresh grid save-button states
    refreshGridSaveStates();
  });
  window.addEventListener("watched_change", () => {
    if (currentTab === "lists" && DOM.currentListTab === "watched") renderMyLists();
    if (selectedTitle) updateDetailActionsState();
    refreshGridSaveStates();
  });
  window.addEventListener("reviews_change", () => {
    if (selectedTitle) renderDetailReviews();
  });
}

// ---------------------------------------------------------------------------
// Header helper
// ---------------------------------------------------------------------------
function updateUserHeader() {
  const user = authService.getCurrentUser();
  if (user) {
    const label = user.displayName || user.email;
    DOM.userStatus.innerHTML = `<span class="user-badge" id="header-profile-btn"><span class="user-avatar" id="header-avatar"></span>${label}</span>`;
    document.getElementById("header-profile-btn").addEventListener("click", () => switchScreen("profile"));
    dbService.getProfile(user.id).then(p => {
      const avatarEl = document.getElementById("header-avatar");
      if (avatarEl) avatarEl.textContent = p.avatarEmoji || "👤";
    }).catch(() => {});
  } else {
    DOM.userStatus.innerHTML = `<button class="login-link-btn" id="header-login-btn">Log In</button>`;
    document.getElementById("header-login-btn").addEventListener("click", openAuthModal);
  }
}

// ---------------------------------------------------------------------------
// Routing & Auth Guards
// ---------------------------------------------------------------------------
function switchScreen(screenId) {
  if ((screenId === "lists" || screenId === "profile") && !authService.isAuthenticated()) {
    intendedScreenAfterAuth = screenId;
    openAuthModal();
    return;
  }

  currentTab = screenId;

  DOM.tabs.forEach(tab =>
    tab.classList.toggle("active", tab.getAttribute("data-screen") === screenId));
  DOM.screens.forEach(screen =>
    screen.classList.toggle("active", screen.id === `screen-${screenId}`));

  // Tab-specific resets
  if (screenId === "home") {
    document.getElementById("home-categories").style.display = "";
    document.getElementById("home-results").style.display = "none";
    document.getElementById("trending-grid").innerHTML = "";
  }
  if (screenId === "lists") {
    DOM.toggleWatchlistBtn.classList.add("active");
    DOM.toggleWatchedBtn.classList.remove("active");
    DOM.currentListTab = "watchlist";
    renderMyLists();
  }
  if (screenId === "profile") {
    document.getElementById("screen-profile").scrollTop = 0;
    renderProfile();
  }
  if (screenId === "search") {
    DOM.searchInput.value = "";
    DOM.searchClearBtn.style.display = "none";
    DOM.searchResultsGrid.innerHTML = emptyStateHtml("🍿", "Type a movie or TV show name to start searching.");
    DOM.filterTabs.forEach(b => b.classList.remove("active"));
    DOM.filterTabs[0].classList.add("active");
    currentSearchType = "";
    DOM.recentSearches.style.display = "none";
  }
}

// ---------------------------------------------------------------------------
// Auth Modal
// ---------------------------------------------------------------------------
function openAuthModal() {
  DOM.authErrorBanner.style.display = "none";
  DOM.authModal.classList.add("active");
}

function closeAuthModal() {
  DOM.authModal.classList.remove("active");
  intendedScreenAfterAuth = null;
}

async function handleGoogleSignIn() {
  DOM.authErrorBanner.style.display = "none";
  DOM.googleSigninBtn.disabled      = true;
  DOM.googleSigninBtn.textContent   = "Opening Google…";

  try {
    const user = await authService.loginWithGoogle();
    if (user) {
      closeAuthModal();
      if (intendedScreenAfterAuth) { switchScreen(intendedScreenAfterAuth); intendedScreenAfterAuth = null; }
    }
  } catch (error) {
    DOM.authErrorBanner.textContent   = error.message;
    DOM.authErrorBanner.style.display = "block";
  } finally {
    DOM.googleSigninBtn.disabled    = false;
    DOM.googleSigninBtn.innerHTML   = `
      <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google`;
  }
}

// ---------------------------------------------------------------------------
// Trending & Search
// ---------------------------------------------------------------------------
function loadPosterForCard(container, titleId, posterUrl) {
  if (!posterUrl) return;
  const card = container.querySelector(`[data-id="${titleId}"]`);
  if (!card) return;
  const wrapper = card.querySelector(".card-poster-wrapper");
  const badge = wrapper?.querySelector(".card-media-badge");
  if (!wrapper || wrapper.querySelector(".card-poster")) return;
  const img = document.createElement("img");
  img.className = "card-poster";
  img.src = posterUrl;
  img.alt = "";
  img.loading = "lazy";
  wrapper.insertBefore(img, badge);
  const placeholder = wrapper.querySelector(".card-poster-placeholder");
  if (placeholder) placeholder.remove();
}

function updateCardStars(titleId, userRating) {
  const raw = userRating ? Math.round(Number(userRating) / 2) : 0;
  const displayRating = Math.min(5, Math.max(0, raw));
  const starsEl = document.querySelector(`.movie-card[data-id="${titleId}"] .card-rating-stars`);
  if (!starsEl) return;
  starsEl.textContent = displayRating > 0
    ? "★".repeat(displayRating) + "☆".repeat(5 - displayRating)
    : "☆☆☆☆☆";
}

// ---------------------------------------------------------------------------
// Home category loading
// ---------------------------------------------------------------------------
async function loadCategory(cat) {
  const grid     = document.getElementById("trending-grid");
  const titleEl  = document.getElementById("home-results-title");
  const catsDiv  = document.getElementById("home-categories");
  const results  = document.getElementById("home-results");

  catsDiv.style.display  = "none";
  results.style.display  = "";
  grid.innerHTML = `<div class="loading-placeholder">Loading…</div>`;

  let titles;
  try {
    titleEl.textContent = "Browse";
    titles = await watchmodeService.getTrendingTitles();
  } catch {
    grid.innerHTML = emptyStateHtml("📡", "Failed to load content.");
    return;
  }

  renderGrid(grid, titles);
  // Mark every card as unknown (-1) upfront so the filter can find it even if details fail
  grid.querySelectorAll(".movie-card").forEach(c => {
    if (!c.hasAttribute("data-content-rating")) c.setAttribute("data-content-rating", "-1");
  });
  const promises = titles.map(t =>
    watchmodeService.getTitleDetails(t.id).then(d => {
      loadPosterForCard(grid, t.id, d?.poster);
      const card = grid.querySelector(`.movie-card[data-id="${t.id}"]`);
      if (card) {
        const sev = d?.us_rating ? getContentRatingSeverity(d.us_rating) : -1;
        card.setAttribute("data-content-rating", sev);
        if (d?.user_rating) updateCardStars(t.id, d.user_rating);
      }
    }).catch(() => {/* card stays at -1 from initial markup */})
  );
  await Promise.allSettled(promises);
  applyContentRatingFilter(grid, getCurrentMaxContentRating());
}

function getCurrentMaxContentRating() {
  const sel = document.getElementById("content-rating-filter");
  return sel ? sel.value : "";
}

function handleSearchInput() {
  const q = DOM.searchInput.value;
  DOM.searchClearBtn.style.display = q.length > 0 ? "block" : "none";
  DOM.recentSearches.style.display = "none";
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(triggerSearch, 300);
}

async function triggerSearch() {
  const query = DOM.searchInput.value.trim();
  if (!query) {
    DOM.searchResultsGrid.innerHTML = emptyStateHtml("🍿", "Type a movie or TV show name to start searching.");
    return;
  }
  DOM.searchResultsGrid.innerHTML = `<div class="loading-placeholder">Searching matches…</div>`;
  saveRecentSearch(query);
  try {
    const results = await watchmodeService.searchTitles(query, currentSearchType);
    if (results.length === 0) {
      DOM.searchResultsGrid.innerHTML = emptyStateHtml("🔍", `No results found for "${query}". Try adjusting filters or check spelling.`);
    } else {
      renderGrid(DOM.searchResultsGrid, results);
      // Mark all cards unknown (-1) upfront
      DOM.searchResultsGrid.querySelectorAll(".movie-card").forEach(c => {
        if (!c.hasAttribute("data-content-rating")) c.setAttribute("data-content-rating", "-1");
      });
      const promises = results.slice(0, 10).map(t =>
        watchmodeService.getTitleDetails(t.id).then(d => {
          loadPosterForCard(DOM.searchResultsGrid, t.id, d?.poster);
          const card = DOM.searchResultsGrid.querySelector(`.movie-card[data-id="${t.id}"]`);
          if (card) {
            const sev = d?.us_rating ? getContentRatingSeverity(d.us_rating) : -1;
            card.setAttribute("data-content-rating", sev);
            if (d?.user_rating) updateCardStars(t.id, d.user_rating);
          }
        }).catch(() => {/* card stays at -1 from initial markup */})
      );
      await Promise.allSettled(promises);
      applyContentRatingFilter(DOM.searchResultsGrid, getCurrentMaxContentRating());
    }
  } catch (error) {
    console.error("Search failed:", error);
    DOM.searchResultsGrid.innerHTML = emptyStateHtml("📡", "Search unavailable. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Recent Searches
// ---------------------------------------------------------------------------
const RECENT_SEARCHES_KEY = "cinefind_recent_searches";

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)) || [];
  } catch { return []; }
}

function saveRecentSearch(query) {
  const searches = getRecentSearches().filter(s => s !== query);
  searches.unshift(query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, 3)));
}

function renderRecentSearches() {
  const searches = getRecentSearches();
  if (searches.length === 0 || DOM.searchInput.value.trim()) {
    DOM.recentSearches.style.display = "none";
    return;
  }
  DOM.recentSearches.style.display = "block";
  DOM.recentSearches.innerHTML = `<div class="recent-searches-title">Recent</div>`
    + searches.map(q => `
      <div class="recent-search-item" data-query="${q.replace(/"/g, '&quot;')}">
        <span class="recent-search-text">${q}</span>
        <button class="recent-search-del" data-query="${q.replace(/"/g, '&quot;')}">✕</button>
      </div>
    `).join("");
}

// ---------------------------------------------------------------------------
// Grid renderer
// Reads watchlist/watched state synchronously from in-memory Firestore cache.
// ---------------------------------------------------------------------------
function renderGrid(container, titles) {
  container.innerHTML = "";
  const user = authService.getCurrentUser();

  titles.forEach(title => {
    const isWl = user ? dbService.isInWatchlist(user.id, title.id) : false;
    const isWd = user ? dbService.isInWatched(user.id,   title.id) : false;

    const raw = title.user_rating ? Math.round(Number(title.user_rating) / 2) : 0;
    const displayRating = Math.min(5, Math.max(0, raw));
    const emptyStars    = Math.max(0, 5 - displayRating);
    const starsHtml     = displayRating > 0
      ? "★".repeat(displayRating) + "☆".repeat(emptyStars)
      : "☆☆☆☆☆";

    let saveBtnClass = "", saveBtnText = "+";
    if (isWl)      { saveBtnClass = "active-watchlist"; saveBtnText = "✓"; }
    else if (isWd) { saveBtnClass = "active-watched";   saveBtnText = "★"; }

    const card = document.createElement("div");
    card.className = "movie-card";
    card.setAttribute("data-id", title.id);
    if (hiddenPosterIds.has(title.id)) card.classList.add("poster-hidden");
    const posterHtml = title.poster
      ? `<img class="card-poster" src="${title.poster}" alt="${title.name}" loading="lazy">`
      : `<div class="card-poster-placeholder"><span>${title.name}</span></div>`;
    card.innerHTML = `
      <div class="card-poster-wrapper" data-title="${title.name.replace(/"/g, '&quot;')}">
        ${posterHtml}
        <span class="card-media-badge">${title.type === "tv_series" ? "TV" : "Movie"}</span>
        <button class="card-hide-poster-btn" title="Hide poster">🙈</button>
        <button class="card-save-btn ${saveBtnClass}" data-id="${title.id}" title="Save to Watch List">${saveBtnText}</button>
      </div>
      <div class="card-details">
        <h4 class="card-title">${title.name}</h4>
        <div class="card-meta-row">
          <span class="card-rating-stars">${starsHtml}</span>
          <div class="card-logos-container" id="logos-card-${title.id}"></div>
        </div>
      </div>`;

    // Async load logos without blocking render
    watchmodeService.getTitleSources(title.id).then(srcs => {
      const el = document.getElementById(`logos-card-${title.id}`);
      if (el) el.innerHTML = srcs.slice(0, 2).map(s => getLogoForSource(s.source_id, s.name)).join("");
    });

    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("card-save-btn")) {
        e.stopPropagation();
        handleQuickSave(title);
      } else if (e.target.classList.contains("card-hide-poster-btn")) {
        e.stopPropagation();
        card.classList.toggle("poster-hidden");
        if (card.classList.contains("poster-hidden")) {
          hiddenPosterIds.add(title.id);
          hiddenPosterNames[title.id] = title.name;
        } else {
          hiddenPosterIds.delete(title.id);
          delete hiddenPosterNames[title.id];
        }
        const u = authService.getCurrentUser();
        if (u) dbService.saveHiddenPosters(u.id, hiddenPosterIds, hiddenPosterNames);
      } else {
        openDetailModal(title.id);
      }
    });

    container.appendChild(card);
  });
}

/** Re-paint save button states on already-rendered cards (after list changes). */
function refreshGridSaveStates() {
  const user = authService.getCurrentUser();
  document.querySelectorAll(".card-save-btn").forEach(btn => {
    const titleId = btn.getAttribute("data-id");
    const isWl    = user ? dbService.isInWatchlist(user.id, titleId) : false;
    const isWd    = user ? dbService.isInWatched(user.id,   titleId) : false;
    btn.className = "card-save-btn" + (isWl ? " active-watchlist" : isWd ? " active-watched" : "");
    btn.textContent = isWl ? "✓" : isWd ? "★" : "+";
  });
}

// ---------------------------------------------------------------------------
// Quick save from grid cards
// ---------------------------------------------------------------------------
async function handleQuickSave(title) {
  const user = authService.getCurrentUser();
  if (!user) { intendedScreenAfterAuth = currentTab; openAuthModal(); return; }

  const isWl = dbService.isInWatchlist(user.id, title.id);
  const isWd = dbService.isInWatched(user.id,   title.id);

  try {
    if (isWl)      await dbService.addToWatched(user.id, title.id, title.name, title.poster);
    else if (isWd) await dbService.removeFromWatched(user.id, title.id);
    else           await dbService.addToWatchlist(user.id, title.id, title.name, title.poster);
    // Real-time listener updates cache & dispatches events → refreshGridSaveStates fires
  } catch (error) {
    console.error("Quick save error:", error);
    alert(error.message);
  }
}

// ---------------------------------------------------------------------------
// My Lists Screen
// ---------------------------------------------------------------------------
function renderMyLists() {
  const user = authService.getCurrentUser();
  if (!user) return;

  const isWatchlist = DOM.currentListTab === "watchlist";
  const items  = isWatchlist ? dbService.getWatchlistItems() : dbService.getWatchedItems();
  const emptyMsg = isWatchlist
    ? "Your Watch List is empty. Discover trending titles or search to add them!"
    : "You haven't marked any movies or TV shows as watched yet.";
  const icon = isWatchlist ? "🍿" : "🎬";

  if (items.length === 0) {
    DOM.listsGrid.innerHTML = emptyStateHtml(icon, emptyMsg);
    return;
  }

  DOM.listsGrid.innerHTML = `<div class="loading-placeholder">Loading saved titles…</div>`;

  Promise.all(items.map(item => watchmodeService.getTitleDetails(item.title_id)))
    .then(titles => renderGrid(DOM.listsGrid, titles.filter(Boolean)))
    .catch(err => {
      console.error("Failed to render lists:", err);
      DOM.listsGrid.innerHTML = emptyStateHtml("📡", "Could not retrieve your saved titles.");
    });
}

// ---------------------------------------------------------------------------
// Profile Screen
// ---------------------------------------------------------------------------
function renderProfile() {
  const user = authService.getCurrentUser();
  if (!user) return;

  DOM.profileEmail.textContent = user.displayName ? `${user.displayName} (${user.email})` : user.email;
  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "Recently";
  DOM.profileJoined.textContent = `Member since: ${joined}`;

  dbService.getProfile(user.id).then(profile => {
    document.querySelector(".profile-avatar").textContent = profile.avatarEmoji || "👤";
    renderAvatarPicker(profile.avatarEmoji || "");
  });

  renderDisplayNameOptions(user);
  renderContentRatingFilter(user);
  renderHiddenPosters();
  renderProfileReviews();
}

// ---------------------------------------------------------------------------
// Content rating filter
// ---------------------------------------------------------------------------
const CONTENT_RATING_SEVERITY = {
  "g":         0, "tv-y":  0, "tv-g":  0,
  "pg":        1, "tv-pg": 1, "tv-y7": 1, "tv-y7-fv": 1,
  "pg-13":     2, "tv-14": 2,
  "r":         3, "tv-ma": 3,
  "nc-17":     4,
  "not rated": -1, "unrated": -1, "nr": -1,
};

function getContentRatingSeverity(rating) {
  const key = (rating || "").toLowerCase().trim();
  return CONTENT_RATING_SEVERITY[key] ?? -1; // -1 = unknown/unrated
}

function applyContentRatingFilter(container, maxLevel) {
  if (maxLevel === "" || maxLevel === undefined || maxLevel === null) {
    // No filter — show all
    container.querySelectorAll("[data-content-rating]").forEach(c => c.style.display = "");
    return;
  }
  const max = parseInt(maxLevel, 10);
  container.querySelectorAll("[data-content-rating]").forEach(c => {
    const severity = parseInt(c.getAttribute("data-content-rating"), 10);
    c.style.display = (severity >= 0 && severity > max) ? "none" : "";
  });
}

function renderDisplayNameOptions(user) {
  const local   = (user.email || "").split("@")[0];
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  // Generate all possible substrings as (start, end, text) triples
  const substrings = [];
  for (let start = 0; start < local.length; start++) {
    for (let end = start + 1; end <= local.length; end++) {
      const text = capitalize(local.slice(start, end));
      substrings.push({ start: start + 1, end, text }); // 1-indexed for humans
    }
  }

  function renderSelectOptions(sel, currentVal) {
    sel.innerHTML = `<option value="">—</option>`
      + substrings.map(s => `<option value="${s.text}">Chars ${s.start}–${s.end} → ${s.text}</option>`).join("");
    // restore if still valid
    if ([...sel.options].some(o => o.value === currentVal)) sel.value = currentVal;
    else sel.value = "";
  }

  const firstNameEl = document.getElementById("select-first-name");
  const lastNameEl  = document.getElementById("select-last-name");

  dbService.getProfile(user.id).then(profile => {
    renderSelectOptions(firstNameEl, profile.firstName || "");
    renderSelectOptions(lastNameEl,  profile.lastName  || "");

    const modes = [
      { value: "first_name", label: "First Name" },
      { value: "last_name",  label: "Last Name" },
      { value: "anonymous",  label: "Anonymous" },
    ];

    DOM.displayNameOptions.innerHTML = modes.map(m => `
      <label class="name-option${profile.mode === m.value ? " selected" : ""}">
        <input type="radio" name="display-name" value="${m.value}"
          ${profile.mode === m.value ? "checked" : ""}>
        <span>${m.label}</span>
      </label>
    `).join("");

    function saveDisplaySettings() {
      const mode = document.querySelector("input[name='display-name']:checked")?.value || "first_name";
      const fn   = firstNameEl.value;
      const ln   = lastNameEl.value;
      dbService.saveProfile(user.id, mode, fn, ln).then(() => {
        document.getElementById("name-saved-msg").textContent = "Saved!";
        setTimeout(() => document.getElementById("name-saved-msg").textContent = "", 2000);
      }).catch(() => {});
    }

    firstNameEl.addEventListener("change", saveDisplaySettings);
    lastNameEl.addEventListener("change", saveDisplaySettings);

    DOM.displayNameOptions.querySelectorAll("input[name='display-name']").forEach(radio => {
      radio.addEventListener("change", () => {
        DOM.displayNameOptions.querySelectorAll(".name-option").forEach(el => el.classList.remove("selected"));
        radio.closest(".name-option").classList.add("selected");
        saveDisplaySettings();
      });
    });
  }).catch(() => {});
}

function loadContentRatingFilter(userId) {
  if (!userId) return;
  const sel = document.getElementById("content-rating-filter");
  if (!sel) return;
  dbService.getProfile(userId).then(profile => {
    const val = profile.maxContentRating ?? "";
    sel.value = val;
    // Apply to any visible grids
    applyContentRatingFilter(DOM.trendingGrid, val);
    applyContentRatingFilter(DOM.searchResultsGrid, val);
  }).catch(() => {});
}

function renderContentRatingFilter(user) {
  const sel = document.getElementById("content-rating-filter");
  const savedMsg = document.getElementById("rating-filter-saved");

  dbService.getProfile(user.id).then(profile => {
    sel.value = profile.maxContentRating ?? "";
    savedMsg.textContent = "";

    sel.addEventListener("change", () => {
      const val = sel.value;
      savedMsg.textContent = "Saving…";
      // Merge with existing profile so we don't overwrite display name settings
      dbService.saveProfile(user.id, profile.mode, profile.firstName, profile.lastName, val).then(() => {
        savedMsg.textContent = "Saved!";
        setTimeout(() => savedMsg.textContent = "", 2000);
        // Re-apply filter to visible grids
        applyContentRatingFilter(DOM.trendingGrid, val);
        applyContentRatingFilter(DOM.searchResultsGrid, val);
      }).catch(() => {
        savedMsg.textContent = "Save failed";
      });
    });
  }).catch(() => {});
}

const AVATAR_EMOJIS = [
  "😀","😎","🤩","🥳","😺","😸","😻","🙂","🤗","🤔",
  "🦊","🐱","🐶","🐼","🐨","🦁","🐯","🐸","🐵","🦄",
  "🌈","🔥","⭐","🌙","☀️","🌸","🌺","🍕","🍦","🎂",
  "🎮","🎸","🎧","🎨","📚","🚀","🏀","⚽","🎯","🏆",
  "💎","🧩","🎪","🎭","💡","🔮","💜","💙","💚","❤️"
];

function renderAvatarPicker(currentEmoji) {
  const grid = document.getElementById("emoji-grid");
  if (!grid) return;
  grid.innerHTML = AVATAR_EMOJIS.map(e =>
    `<button class="emoji-option${e === currentEmoji ? " selected" : ""}" data-emoji="${e}">${e}</button>`
  ).join("");
}

function renderHiddenPosters() {
  const container = DOM.profileHiddenPosters;
  const ids = [...hiddenPosterIds];
  if (ids.length === 0) {
    container.innerHTML = `<p class="empty-state-sm">No hidden posters.</p>`;
    return;
  }

  // Fetch names for any IDs missing one
  const needNames = ids.filter(id => !hiddenPosterNames[id]);
  if (needNames.length > 0) {
    Promise.all(needNames.map(id =>
      watchmodeService.getTitleDetails(id).then(d => {
        if (d && d.name) {
          hiddenPosterNames[id] = d.name;
          return { id, name: d.name };
        }
      }).catch(() => {})
    )).then(() => {
      // Re-render with fetched names
      const u = authService.getCurrentUser();
      if (u) dbService.saveHiddenPosters(u.id, hiddenPosterIds, hiddenPosterNames);
      renderHiddenPosters();
    });
  }

  container.innerHTML = ids.map(id => {
    const name = hiddenPosterNames[id] || `Title ${id}`;
    return `<button class="hidden-poster-item" data-id="${id}">🙈 ${name}</button>`;
  }).join("");

  container.querySelectorAll(".hidden-poster-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      hiddenPosterIds.delete(id);
      delete hiddenPosterNames[id];
      const u = authService.getCurrentUser();
      if (u) dbService.saveHiddenPosters(u.id, hiddenPosterIds, hiddenPosterNames);
      // Re-render remaining list
      renderHiddenPosters();
      // Also unhide any card currently showing this title
      document.querySelectorAll(`.movie-card[data-id="${id}"]`).forEach(c => {
        c.classList.remove("poster-hidden");
      });
    });
  });
}

async function renderProfileReviews() {
  const user = authService.getCurrentUser();
  if (!user) return;

  DOM.profileReviewsList.innerHTML = `<div class="loading-placeholder">Loading your reviews…</div>`;

  try {
    const reviews = await dbService.getUserReviews(user.id);
    if (reviews.length === 0) {
      DOM.profileReviewsList.innerHTML = `
        <div class="no-sources-text" style="text-align:center;margin-top:20px;">
          You haven't written any reviews yet. Tap any title to write one!
        </div>`;
      return;
    }
    DOM.profileReviewsList.innerHTML = reviews.map(rev => `
      <div class="review-card">
        <div class="review-card-header">
          <span class="review-card-title-link" data-title-id="${rev.title_id}" style="cursor:pointer;">${rev.title_name}</span>
          <span class="review-card-stars">${"★".repeat(rev.rating)}${"☆".repeat(5 - rev.rating)}</span>
        </div>
        <div class="review-card-criteria">${(rev.criteria || []).map(c => `<span class="criteria-tag">${c}</span>`).join("") || '<span class="no-criteria">No criteria selected</span>'}</div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:6px;">
          <span>${rev.is_public ? "🌍 Public" : "🔒 Private"}</span>
          <span>${_formatDate(rev.created_at)}</span>
        </div>
      </div>`).join("");
    // Click to open detail modal
    DOM.profileReviewsList.querySelectorAll(".review-card-title-link").forEach(el => {
      el.addEventListener("click", () => openDetailModal(el.dataset.titleId));
    });
  } catch (error) {
    console.error("Failed to load profile reviews:", error);
    DOM.profileReviewsList.innerHTML = emptyStateHtml("📡", "Could not load your reviews.");
  }
}

// ---------------------------------------------------------------------------
// Detail Modal
// ---------------------------------------------------------------------------
async function openDetailModal(titleId) {
  selectedTitle = null;
  DOM.detailPoster.src        = "";
  DOM.detailTitle.textContent = "Loading…";
  DOM.detailYear.textContent  = "";
  DOM.detailType.textContent  = "";
  DOM.detailUsRating.style.display = "none";
  DOM.detailGenres.innerHTML  = "";
  DOM.detailPlot.textContent  = "Fetching details…";
  DOM.detailSourcesList.innerHTML     = `<div class="no-sources-text">Checking availability…</div>`;
  DOM.detailReviewsContainer.innerHTML = "";
  editingReviewTitleId = null;
  setReviewRating(0);
  document.querySelectorAll("#review-criteria-list input").forEach(cb => cb.checked = false);
  DOM.reviewForm.reset();
  const editor = document.getElementById("review-editor-block");
  editor.querySelector("h4").textContent = "Write a Review";
  const cancelBtn = editor.querySelector(".cancel-edit-btn");
  if (cancelBtn) cancelBtn.style.display = "none";
  const submitBtn = editor.querySelector("button[type=submit]");
  if (submitBtn) submitBtn.textContent = "Submit Review";
  DOM.detailModal.classList.add("active");

  try {
    const details  = await watchmodeService.getTitleDetails(titleId);
    if (!details) {
      DOM.detailModal.classList.remove("active");
      showToast("Could not load title details. Please try again.");
      return;
    }
    selectedTitle  = details;

    DOM.detailPoster.src        = details.poster;
    DOM.detailPoster.alt        = details.name;
    DOM.detailPoster.style.display = hiddenPosterIds.has(titleId) ? "none" : "";
    DOM.detailTitle.textContent = details.name;
    DOM.detailYear.textContent  = details.year;
    DOM.detailType.textContent  = details.type === "tv_series" ? "TV Series" : "Movie";
    if (details.us_rating) {
      DOM.detailUsRating.textContent = details.us_rating;
      DOM.detailUsRating.style.display = "inline-block";
    } else {
      DOM.detailUsRating.style.display = "none";
    }
    DOM.detailGenres.innerHTML  = (details.genre_names || [])
      .map(g => `<span class="genre-badge">${g}</span>`).join("");
    DOM.detailPlot.textContent  = details.plot_overview || "No description available.";

    updateDetailActionsState();
    loadSources(titleId);
    renderDetailReviews();
  } catch (error) {
    console.error("Detail modal error:", error);
    DOM.detailTitle.textContent = "Error Loading Title";
    DOM.detailPlot.textContent  = "Could not retrieve details.";
  }
}

function updateDetailActionsState() {
  const user = authService.getCurrentUser();
  if (!user || !selectedTitle) {
    DOM.detailBtnWatchlist.className = "btn btn-action";
    DOM.detailBtnWatched.className   = "btn btn-action";
    DOM.detailBtnWatchlist.innerHTML = `<span class="btn-icon">+</span> Watch List`;
    DOM.detailBtnWatched.innerHTML   = `<span class="btn-icon">✓</span> Mark Watched`;
    return;
  }

  const isWl = dbService.isInWatchlist(user.id, selectedTitle.id);
  const isWd = dbService.isInWatched(user.id,   selectedTitle.id);

  DOM.detailBtnWatchlist.className = `btn btn-action${isWl ? " active-watchlist" : ""}`;
  DOM.detailBtnWatchlist.innerHTML = isWl
    ? `<span class="btn-icon">✓</span> Watch List`
    : `<span class="btn-icon">+</span> Watch List`;

  DOM.detailBtnWatched.className = `btn btn-action${isWd ? " active-watched" : ""}`;
  DOM.detailBtnWatched.innerHTML = isWd
    ? `<span class="btn-icon">★</span> Watched`
    : `<span class="btn-icon">✓</span> Mark Watched`;

  DOM.detailBtnWatchlist.onclick = async () => {
    try {
      if (isWl) await dbService.removeFromWatchlist(user.id, selectedTitle.id);
      else      await dbService.addToWatchlist(user.id, selectedTitle.id, selectedTitle.name, selectedTitle.poster);
    } catch (err) { alert(err.message); }
  };
  DOM.detailBtnWatched.onclick = async () => {
    try {
      if (isWd) await dbService.removeFromWatched(user.id, selectedTitle.id);
      else      await dbService.addToWatched(user.id, selectedTitle.id, selectedTitle.name, selectedTitle.poster);
    } catch (err) { alert(err.message); }
  };
}

async function loadSources(titleId) {
  try {
    const sources = await watchmodeService.getTitleSources(titleId);
    if (!sources.length) {
      DOM.detailSourcesList.innerHTML = `<div class="no-sources-text">Not currently available to stream</div>`;
      return;
    }
    const isIOS     = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);

    DOM.detailSourcesList.innerHTML = sources.map(source => {
      let link = "#";
      if (isIOS && source.deeplink_ios)         link = source.deeplink_ios;
      else if (isAndroid && source.deeplink_android) link = source.deeplink_android;
      else link = `https://www.google.com/search?q=Watch+${encodeURIComponent(selectedTitle?.name ?? "")}+on+${encodeURIComponent(source.name)}`;

      return `
        <a href="${link}" target="_blank" class="source-item">
          <div class="source-left">
            <span class="source-name">${source.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="source-type ${source.type}">${source.type}</span>
            <span class="source-link-arrow">➔</span>
          </div>
        </a>`;
    }).join("");
  } catch (error) {
    console.error("Failed to load sources:", error);
    DOM.detailSourcesList.innerHTML = `<div class="no-sources-text">Failed to retrieve streaming availability.</div>`;
  }
}

// ---------------------------------------------------------------------------
// Reviews (universal — fetched from top-level Firestore collection)
// ---------------------------------------------------------------------------
async function renderDetailReviews() {
  if (!selectedTitle) return;

  const user    = authService.getCurrentUser();
  const reviews = await dbService.getReviews(selectedTitle.id, user?.id ?? null);

  // Load the current user's display-name preference
  let myProfile = { mode: "first_name", nickname: "" };
  if (user) {
    try { myProfile = await dbService.getProfile(user.id); } catch (_) {}
  }
  const myParsed = dbService.parseNameFromEmail(user?.email || "");

  // --- Watchmode rating (yellow stars) ---
  const wmRating = selectedTitle.user_rating ? Math.round(selectedTitle.user_rating / 2) : 0;
  const wmClamped = Math.min(5, Math.max(0, wmRating));
  DOM.detailStarsWatchmode.textContent = wmClamped > 0
    ? "★".repeat(wmClamped) + "☆".repeat(5 - wmClamped)
    : "☆☆☆☆☆";
  DOM.detailRatingWatchmode.textContent = selectedTitle.user_rating
    ? `${(Number(selectedTitle.user_rating) / 2).toFixed(1)} / 5`
    : "Not rated";

  // --- CineFind user rating (blue stars) ---
  if (reviews.length > 0) {
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const avgRounded = Math.min(5, Math.max(0, Math.round(avg)));
    DOM.detailStarsCinefind.textContent = avgRounded > 0
      ? "★".repeat(avgRounded) + "☆".repeat(5 - avgRounded)
      : "☆☆☆☆☆";
    DOM.detailRatingCinefind.textContent = `${avg.toFixed(1)} / 5 (${reviews.length} review${reviews.length > 1 ? "s" : ""})`;
  } else {
    DOM.detailStarsCinefind.textContent  = "☆☆☆☆☆";
    DOM.detailRatingCinefind.textContent = "No reviews yet";
  }

  if (!reviews.length) {
    DOM.detailReviewsContainer.innerHTML = `<div class="no-sources-text">No reviews yet. Be the first to share your thoughts!</div>`;
    return;
  }

  DOM.detailReviewsContainer.innerHTML = reviews.map(rev => {
    const isOwner = user && rev.user_id === user.id;
    const label   = isOwner
      ? dbService.getDisplayLabel(myProfile, myParsed, rev.user_email)
      : (rev.user_email || "Anonymous");
    return `
      <div class="review-card">
        <div class="review-card-header">
          <span class="review-card-email">${label}</span>
          <span class="review-card-stars">${"★".repeat(rev.rating)}${"☆".repeat(5 - rev.rating)}</span>
        </div>
        <div class="review-card-criteria">${(rev.criteria || []).map(c => `<span class="criteria-tag">${c}</span>`).join("") || '<span class="no-criteria">No criteria selected</span>'}</div>
        <div style="font-size:9px;color:var(--text-muted);margin-top:4px;display:flex;justify-content:space-between;">
          <span>${rev.is_public ? "🌍 Public" : "🔒 Private"}</span>
          <span>${_formatDate(rev.updated_at)}</span>
        </div>
        ${isOwner ? `
        <div class="review-actions">
          <button class="review-btn edit" data-title-id="${selectedTitle.id}" title="Edit review">✏️</button>
          <button class="review-btn toggle-vis" data-title-id="${selectedTitle.id}" data-current="${rev.is_public ? "1" : "0"}" title="${rev.is_public ? "Make private" : "Make public"}">${rev.is_public ? "🔒" : "🌍"}</button>
          <button class="review-btn delete" data-title-id="${selectedTitle.id}" title="Delete review">🗑️</button>
        </div>` : ""}
      </div>`;
  }).join("");

  // Wire up review action buttons
  DOM.detailReviewsContainer.querySelectorAll(".review-btn.edit").forEach(btn => {
    btn.addEventListener("click", () => editReview(btn.dataset.titleId));
  });
  DOM.detailReviewsContainer.querySelectorAll(".review-btn.toggle-vis").forEach(btn => {
    btn.addEventListener("click", async () => {
      const tid = btn.dataset.titleId;
      const makePublic = btn.dataset.current === "0";
      await dbService.toggleReviewVisibility(user.id, tid, makePublic);
      await renderDetailReviews();
    });
  });
  DOM.detailReviewsContainer.querySelectorAll(".review-btn.delete").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete your review?")) return;
      await dbService.deleteReview(user.id, btn.dataset.titleId);
      await renderDetailReviews();
    });
  });
}

// ---------------------------------------------------------------------------
// Review edit mode
// ---------------------------------------------------------------------------
let editingReviewTitleId = null;
const REVIEW_CRITERIA = ["Great plot", "Great characters", "Great acting", "Great visuals", "Great soundtrack", "Great voice acting", "Great for binge-watching", "Good value"];

async function editReview(titleId) {
  editingReviewTitleId = titleId;
  const cu = authService.getCurrentUser();

  // Fetch existing review to pre-fill
  let existing = null;
  if (cu) {
    existing = await dbService.getReview(cu.id, titleId);
  }

  if (existing) {
    setReviewRating(existing.rating || 0);
    document.querySelectorAll("#review-criteria-list input").forEach(cb => {
      cb.checked = (existing.criteria || []).includes(cb.value);
    });
    DOM.reviewPublic.checked = existing.is_public !== false;
  }

  const editor = document.getElementById("review-editor-block");
  const heading = editor.querySelector("h4");
  heading.textContent = "Edit Your Review";

  // Change submit button text
  const submitBtn = editor.querySelector("button[type=submit]");
  if (submitBtn) submitBtn.textContent = "Update Review";

  // Add/show cancel button
  let cancelBtn = editor.querySelector(".cancel-edit-btn");
  if (!cancelBtn) {
    cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-outline cancel-edit-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.marginLeft = "8px";
    cancelBtn.addEventListener("click", cancelEditReview);
    (submitBtn || editor.querySelector(".review-rating-input")).after(cancelBtn);
  }
  cancelBtn.style.display = "inline-block";

  // Scroll to editor
  editor.scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelEditReview() {
  editingReviewTitleId = null;
  setReviewRating(0);
  document.querySelectorAll("#review-criteria-list input").forEach(cb => cb.checked = false);
  DOM.reviewPublic.checked = true;
  const editor = document.getElementById("review-editor-block");
  editor.querySelector("h4").textContent = "Write a Review";
  const cancelBtn = editor.querySelector(".cancel-edit-btn");
  if (cancelBtn) cancelBtn.style.display = "none";
  const submitBtn = editor.querySelector("button[type=submit]");
  if (submitBtn) submitBtn.textContent = "Submit Review";
}

// ---------------------------------------------------------------------------
// Star rating selector
// ---------------------------------------------------------------------------
function setReviewRating(rating) {
  selectedReviewRating = rating;
  DOM.starsSelector.querySelectorAll("span").forEach(span => {
    span.classList.toggle("active", parseInt(span.getAttribute("data-val"), 10) <= rating);
  });
}

// ---------------------------------------------------------------------------
// Submit review
// ---------------------------------------------------------------------------
async function handleReviewSubmit(e) {
  e.preventDefault();

  const user = authService.getCurrentUser();
  if (!user) { DOM.detailModal.classList.remove("active"); intendedScreenAfterAuth = currentTab; openAuthModal(); return; }
  if (!selectedTitle) return;
  if (selectedReviewRating === 0) { alert("Please select a star rating before submitting."); return; }

  const submitBtn      = DOM.reviewForm.querySelector("button[type=submit]");
  submitBtn.disabled   = true;
  submitBtn.textContent = "Saving…";

  const criteria = Array.from(
    document.querySelectorAll("#review-criteria-list input:checked")
  ).map(cb => cb.value);

  try {
    await dbService.addReview(
      user.id,
      user.email,
      editingReviewTitleId || selectedTitle.id,
      selectedTitle.name,
      selectedReviewRating,
      criteria,
      DOM.reviewPublic.checked,
    );
    editingReviewTitleId = null;
    setReviewRating(0);
    document.querySelectorAll("#review-criteria-list input").forEach(cb => cb.checked = false);
    const editor = document.getElementById("review-editor-block");
    editor.querySelector("h4").textContent = "Write a Review";
    const cancelBtn = editor.querySelector(".cancel-edit-btn");
    if (cancelBtn) cancelBtn.style.display = "none";
    await renderDetailReviews();
  } catch (error) {
    console.error("Review submit error:", error);
    alert(error.message);
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = editingReviewTitleId ? "Update Review" : "Submit Review";
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function emptyStateHtml(icon, message) {
  return `<div class="empty-state"><span class="empty-icon">${icon}</span><p>${message}</p></div>`;
}

function _formatDate(tsOrStr) {
  if (!tsOrStr) return "";
  // Firestore Timestamp objects have .toDate(); ISO strings work with new Date()
  const d = tsOrStr?.toDate ? tsOrStr.toDate() : new Date(tsOrStr);
  return isNaN(d) ? "" : d.toLocaleDateString();
}
