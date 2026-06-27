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

  // My Lists
  toggleWatchlistBtn: document.getElementById("toggle-watchlist-btn"),
  toggleWatchedBtn:   document.getElementById("toggle-watched-btn"),
  listsGrid:          document.getElementById("lists-grid"),
  currentListTab:     "watchlist",

  // Profile
  profileEmail:       document.getElementById("profile-email"),
  profileJoined:      document.getElementById("profile-joined"),
  logoutBtn:          document.getElementById("logout-btn"),
  profileReviewsList: document.getElementById("profile-reviews-list"),

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
  detailGenres:             document.getElementById("detail-genres"),
  detailStarsAvg:           document.getElementById("detail-stars-avg"),
  detailRatingAvgText:      document.getElementById("detail-rating-avg-text"),
  detailBtnWatchlist:       document.getElementById("detail-btn-watchlist"),
  detailBtnWatched:         document.getElementById("detail-btn-watched"),
  detailPlot:               document.getElementById("detail-plot"),
  detailSourcesList:        document.getElementById("detail-sources-list"),
  detailReviewsContainer:   document.getElementById("detail-reviews-container"),
  starsSelector:            document.getElementById("stars-selector"),
  reviewForm:               document.getElementById("review-form"),
  reviewBody:               document.getElementById("review-body"),
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

  // Hide the loading overlay with a smooth fade.
  DOM.loadingOverlay.classList.add("hidden");
  setTimeout(() => DOM.loadingOverlay.remove(), 450);

  updateUserHeader();
  loadTrending();
});

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------
function setupEventListeners() {
  // Bottom navigation tabs
  DOM.tabs.forEach(tab => {
    tab.addEventListener("click", () => switchScreen(tab.getAttribute("data-screen")));
  });

  // Home search trigger
  DOM.homeSearchTrigger.addEventListener("click", () => {
    switchScreen("search");
    DOM.searchInput.focus();
  });

  // Search input + filter tabs
  DOM.searchInput.addEventListener("input", handleSearchInput);
  DOM.searchClearBtn.addEventListener("click", () => {
    DOM.searchInput.value = "";
    DOM.searchClearBtn.style.display = "none";
    DOM.searchResultsGrid.innerHTML = emptyStateHtml("🍿", "Type a movie or TV show name to start searching.");
    DOM.searchInput.focus();
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
    selectedTitle = null;
  });

  // Star rating selector
  DOM.starsSelector.querySelectorAll("span").forEach(span => {
    span.addEventListener("click", () => setReviewRating(parseInt(span.getAttribute("data-val"), 10)));
  });

  // Review form
  DOM.reviewForm.addEventListener("submit", handleReviewSubmit);

  // Logout
  DOM.logoutBtn.addEventListener("click", async () => {
    await authService.logout();
    switchScreen("home");
  });

  // Auth state changes (fired by onAuthStateChanged in auth.js)
  window.addEventListener("auth_change", () => {
    const user = authService.getCurrentUser();
    // Initialise / tear down Firestore real-time listeners
    dbService.initUserListeners(user?.id ?? null);
    updateUserHeader();
    if (!user && (currentTab === "lists" || currentTab === "profile")) {
      switchScreen("home");
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
    DOM.userStatus.innerHTML = `<span class="user-badge" id="header-profile-btn">${label}</span>`;
    document.getElementById("header-profile-btn").addEventListener("click", () => switchScreen("profile"));
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

  if (screenId === "lists")   renderMyLists();
  if (screenId === "profile") renderProfile();
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

async function loadTrending() {
  try {
    const titles = await watchmodeService.getTrendingTitles();
    renderGrid(DOM.trendingGrid, titles);
    titles.forEach(t => {
      watchmodeService.getTitleDetails(t.id).then(d => {
        loadPosterForCard(DOM.trendingGrid, t.id, d?.poster);
      }).catch(() => {});
    });
  } catch (error) {
    console.error("Failed to load trending titles:", error);
    DOM.trendingGrid.innerHTML = emptyStateHtml("📡", "Failed to load content. Check your internet connection.");
  }
}

function handleSearchInput() {
  const q = DOM.searchInput.value;
  DOM.searchClearBtn.style.display = q.length > 0 ? "block" : "none";
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
  try {
    const results = await watchmodeService.searchTitles(query, currentSearchType);
    if (results.length === 0) {
      DOM.searchResultsGrid.innerHTML = emptyStateHtml("🔍", `No results found for "${query}". Try adjusting filters or check spelling.`);
    } else {
      renderGrid(DOM.searchResultsGrid, results);
      results.slice(0, 10).forEach(t => {
        watchmodeService.getTitleDetails(t.id).then(d => {
          loadPosterForCard(DOM.searchResultsGrid, t.id, d?.poster);
        }).catch(() => {});
      });
    }
  } catch (error) {
    console.error("Search failed:", error);
    DOM.searchResultsGrid.innerHTML = emptyStateHtml("📡", "Search unavailable. Please try again.");
  }
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
    const posterHtml = title.poster
      ? `<img class="card-poster" src="${title.poster}" alt="${title.name}" loading="lazy">`
      : `<div class="card-poster-placeholder"><span>${title.name}</span></div>`;
    card.innerHTML = `
      <div class="card-poster-wrapper">
        ${posterHtml}
        <span class="card-media-badge">${title.type === "tv_series" ? "TV" : "Movie"}</span>
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
    .then(titles => renderGrid(DOM.listsGrid, titles))
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

  renderProfileReviews();
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
          <span class="review-card-title-name">${rev.title_name}</span>
          <span class="review-card-stars">${"★".repeat(rev.rating)}${"☆".repeat(5 - rev.rating)}</span>
        </div>
        <p class="review-card-body">${rev.body || "<i>No written review.</i>"}</p>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-top:6px;">
          <span>${rev.is_public ? "🌍 Public" : "🔒 Private"}</span>
          <span>${_formatDate(rev.created_at)}</span>
        </div>
      </div>`).join("");
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
  DOM.detailGenres.innerHTML  = "";
  DOM.detailPlot.textContent  = "Fetching details…";
  DOM.detailSourcesList.innerHTML     = `<div class="no-sources-text">Checking availability…</div>`;
  DOM.detailReviewsContainer.innerHTML = "";
  setReviewRating(0);
  DOM.reviewBody.value = "";
  DOM.reviewForm.reset();
  DOM.detailModal.classList.add("active");

  try {
    const details  = await watchmodeService.getTitleDetails(titleId);
    selectedTitle  = details;

    DOM.detailPoster.src        = details.poster;
    DOM.detailPoster.alt        = details.name;
    DOM.detailTitle.textContent = details.name;
    DOM.detailYear.textContent  = details.year;
    DOM.detailType.textContent  = details.type === "tv_series" ? "TV Series" : "Movie";
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

  // Update average rating in header
  if (reviews.length > 0) {
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const avgRounded = Math.min(5, Math.max(0, Math.round(avg)));
    DOM.detailStarsAvg.textContent      = avgRounded > 0 ? "★".repeat(avgRounded) + "☆".repeat(5 - avgRounded) : "☆☆☆☆☆";
    DOM.detailRatingAvgText.textContent = `${avg.toFixed(1)} / 5 (${reviews.length} review${reviews.length > 1 ? "s" : ""})`;
  } else {
    const val = selectedTitle.user_rating ? Math.round(selectedTitle.user_rating / 2) : 0;
    const clamped = Math.min(5, Math.max(1, val));
    DOM.detailStarsAvg.textContent      = "★".repeat(clamped) + "☆".repeat(5 - clamped);
    DOM.detailRatingAvgText.textContent = selectedTitle.user_rating
      ? `${(Number(selectedTitle.user_rating) / 2).toFixed(1)} / 5`
      : "No ratings yet";
  }

  if (!reviews.length) {
    DOM.detailReviewsContainer.innerHTML = `<div class="no-sources-text">No reviews yet. Be the first to share your thoughts!</div>`;
    return;
  }

  DOM.detailReviewsContainer.innerHTML = reviews.map(rev => {
    const isOwner = user && rev.user_id === user.id;
    const label   = isOwner ? "You" : (rev.user_email || "Anonymous");
    return `
      <div class="review-card">
        <div class="review-card-header">
          <span class="review-card-email">${label}</span>
          <span class="review-card-stars">${"★".repeat(rev.rating)}${"☆".repeat(5 - rev.rating)}</span>
        </div>
        <p class="review-card-body">${rev.body || "<i>Rated only — no written review.</i>"}</p>
        <div style="font-size:9px;color:var(--text-muted);margin-top:4px;display:flex;justify-content:space-between;">
          <span>${rev.is_public ? "🌍 Public" : "🔒 Private"}</span>
          <span>${_formatDate(rev.updated_at)}</span>
        </div>
      </div>`;
  }).join("");
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

  try {
    await dbService.addReview(
      user.id,
      user.email,
      selectedTitle.id,
      selectedTitle.name,
      selectedReviewRating,
      DOM.reviewBody.value.trim(),
      DOM.reviewPublic.checked,
    );
    setReviewRating(0);
    DOM.reviewBody.value = "";
    await renderDetailReviews();
  } catch (error) {
    console.error("Review submit error:", error);
    alert(error.message);
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = "Submit Review";
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
