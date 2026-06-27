// Database Service — Firestore
// All database operations go through this module.
// UI components must never import from firebase.js directly.

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { db } from "./firebase.js";

// ---------------------------------------------------------------------------
// In-memory caches for watchlist / watched
// Populated via real-time Firestore listeners when a user logs in.
// Allows renderGrid() to stay synchronous for UI snappiness.
// ---------------------------------------------------------------------------
let _watchlistCache = new Set(); // Set<title_id string>
let _watchedCache   = new Set(); // Set<title_id string>
let _watchlistItems = [];        // Full item objects for My Lists screen
let _watchedItems   = [];

let _unsubWatchlist = null;
let _unsubWatched   = null;

/**
 * Start (or tear down) real-time listeners for the signed-in user's lists.
 * Call this whenever auth state changes (from app.js auth_change handler).
 */
export function initUserListeners(userId) {
  // Tear down existing listeners
  if (_unsubWatchlist) { _unsubWatchlist(); _unsubWatchlist = null; }
  if (_unsubWatched)   { _unsubWatched();   _unsubWatched   = null; }

  // Reset caches
  _watchlistCache = new Set();
  _watchedCache   = new Set();
  _watchlistItems = [];
  _watchedItems   = [];

  if (!userId) return;

  // Watchlist listener
  _unsubWatchlist = onSnapshot(
    collection(db, "users", userId, "watchlist"),
    (snapshot) => {
      _watchlistItems = snapshot.docs.map(d => ({ ...d.data() }));
      _watchlistCache = new Set(_watchlistItems.map(item => String(item.title_id)));
      window.dispatchEvent(new Event("watchlist_change"));
    },
    (err) => console.error("Watchlist listener error:", err),
  );

  // Watched listener
  _unsubWatched = onSnapshot(
    collection(db, "users", userId, "watched"),
    (snapshot) => {
      _watchedItems = snapshot.docs.map(d => ({ ...d.data() }));
      _watchedCache = new Set(_watchedItems.map(item => String(item.title_id)));
      window.dispatchEvent(new Event("watched_change"));
    },
    (err) => console.error("Watched listener error:", err),
  );
}

// ---------------------------------------------------------------------------
// Watchlist — synchronous reads from cache, async writes to Firestore
// Firestore path: users/{uid}/watchlist/{titleId}
// ---------------------------------------------------------------------------

export function isInWatchlist(userId, titleId) {
  return _watchlistCache.has(String(titleId));
}

export function getWatchlistItems() {
  return _watchlistItems;
}

export async function addToWatchlist(userId, titleId, titleName, posterUrl) {
  if (!userId) throw new Error("Authentication required.");
  try {
    const ref = doc(db, "users", userId, "watchlist", String(titleId));
    await setDoc(ref, {
      user_id:    userId,
      title_id:   String(titleId),
      title_name: titleName,
      poster_url: posterUrl || "",
      added_at:   serverTimestamp(),
    });
    // Real-time listener will update cache + dispatch watchlist_change
  } catch (error) {
    console.error("addToWatchlist error:", error);
    throw new Error("Could not save to Watch List. Please try again.");
  }
}

export async function removeFromWatchlist(userId, titleId) {
  if (!userId) throw new Error("Authentication required.");
  try {
    await deleteDoc(doc(db, "users", userId, "watchlist", String(titleId)));
  } catch (error) {
    console.error("removeFromWatchlist error:", error);
    throw new Error("Could not remove from Watch List. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Watched — synchronous reads from cache, async writes to Firestore
// Firestore path: users/{uid}/watched/{titleId}
// ---------------------------------------------------------------------------

export function isInWatched(userId, titleId) {
  return _watchedCache.has(String(titleId));
}

export function getWatchedItems() {
  return _watchedItems;
}

export async function addToWatched(userId, titleId, titleName, posterUrl) {
  if (!userId) throw new Error("Authentication required.");
  try {
    const ref = doc(db, "users", userId, "watched", String(titleId));
    await setDoc(ref, {
      user_id:    userId,
      title_id:   String(titleId),
      title_name: titleName,
      poster_url: posterUrl || "",
      added_at:   serverTimestamp(),
      watched_at: serverTimestamp(),
    });
    // Also remove from watchlist if present (move semantics)
    if (_watchlistCache.has(String(titleId))) {
      await removeFromWatchlist(userId, titleId);
    }
  } catch (error) {
    console.error("addToWatched error:", error);
    throw new Error("Could not mark as Watched. Please try again.");
  }
}

export async function removeFromWatched(userId, titleId) {
  if (!userId) throw new Error("Authentication required.");
  try {
    await deleteDoc(doc(db, "users", userId, "watched", String(titleId)));
  } catch (error) {
    console.error("removeFromWatched error:", error);
    throw new Error("Could not remove from Watched. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Reviews — top-level Firestore collection, shared across all users
// Firestore path: reviews/{userId}_{titleId}  (deterministic ID = one review per user/title)
// ---------------------------------------------------------------------------

/**
 * Fetch all reviews for a given title.
 * Returns public reviews from all users, plus the current user's own private ones.
 */
export async function getReviews(titleId, currentUserId = null) {
  try {
    const q = query(
      collection(db, "reviews"),
      where("title_id", "==", String(titleId)),
    );
    const snapshot = await getDocs(q);
    const all = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));

    // Show public reviews + the current user's own (even if private)
    return all.filter(r => r.is_public || (currentUserId && r.user_id === currentUserId));
  } catch (error) {
    console.error("getReviews error:", error);
    return [];
  }
}

/**
 * Fetch all reviews written by the given user (for Profile screen).
 */
export async function getUserReviews(userId) {
  if (!userId) return [];
  try {
    const q = query(
      collection(db, "reviews"),
      where("user_id", "==", userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(d => ({ ...d.data(), id: d.id }))
      .sort((a, b) => {
        // Sort newest first — serverTimestamp may not be available instantly
        const ta = a.created_at?.toMillis?.() ?? 0;
        const tb = b.created_at?.toMillis?.() ?? 0;
        return tb - ta;
      });
  } catch (error) {
    console.error("getUserReviews error:", error);
    return [];
  }
}

/**
 * Add or update a review.
 * Uses a deterministic doc ID so each user can only have one review per title.
 */
export async function addReview(userId, userEmail, titleId, titleName, rating, body, isPublic) {
  if (!userId) throw new Error("Authentication required.");
  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5 stars.");

  try {
    const docId = `${userId}_${titleId}`;
    const ref   = doc(db, "reviews", docId);
    const existing = await getDoc(ref);

    await setDoc(ref, {
      id:          docId,
      user_id:     userId,
      user_email:  userEmail,
      title_id:    String(titleId),
      title_name:  titleName,
      rating:      parseInt(rating, 10),
      body:        body || "",
      is_public:   !!isPublic,
      created_at:  existing.exists() ? existing.data().created_at : serverTimestamp(),
      updated_at:  serverTimestamp(),
    });

    window.dispatchEvent(new Event("reviews_change"));
  } catch (error) {
    console.error("addReview error:", error);
    throw new Error("Could not save your review. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Profile — display name preferences
// Firestore path: users/{uid}/profile
// ---------------------------------------------------------------------------

/**
 * Parse user email into first / last name suggestions.
 * "john.doe@gmail.com" → { first: "John", last: "Doe" }
 * "jane@gmail.com"     → { first: "Jane", last: "" }
 */
export function parseNameFromEmail(email) {
  if (!email) return { first: "", last: "" };
  const local = email.split("@")[0];
  const parts = local.split(".").filter(Boolean);
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return {
    first: capitalize(parts[0] || ""),
    last:  parts.length > 1 ? capitalize(parts.slice(1).join(" ")) : "",
  };
}

/**
 * Load the user's display-name preference from Firestore.
 * Returns { mode: "first_name"|"last_name"|"nickname"|"anonymous", nickname: "" }
 * or the default { mode: "first_name", nickname: "" }.
 */
export async function getProfile(userId) {
  if (!userId) return { mode: "first_name", nickname: "" };
  try {
    const ref = doc(db, "users", userId, "profile", "settings");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data();
      return { mode: d.mode || "first_name", nickname: d.nickname || "" };
    }
  } catch (e) {
    console.warn("getProfile fallback to default:", e);
  }
  return { mode: "first_name", nickname: "" };
}

/**
 * Save the user's display-name preference to Firestore.
 */
export async function saveProfile(userId, mode, nickname = "") {
  if (!userId) throw new Error("Authentication required.");
  const ref = doc(db, "users", userId, "profile", "settings");
  await setDoc(ref, { mode, nickname, updated_at: serverTimestamp() });
}

/**
 * Compute the effective display label for a review based on the user's profile.
 */
export function getDisplayLabel(profile, parsed, fallbackEmail) {
  switch (profile.mode) {
    case "first_name":
      return parsed.first || fallbackEmail || "User";
    case "last_name":
      return parsed.last || parsed.first || fallbackEmail || "User";
    case "nickname":
      return profile.nickname || parsed.first || fallbackEmail || "User";
    case "anonymous":
      return "Anonymous";
    default:
      return parsed.first || fallbackEmail || "User";
  }
}
