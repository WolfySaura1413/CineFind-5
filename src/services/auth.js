// Authentication Service — Firebase Auth
// UI components must never import from firebase.js directly.

import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import { auth } from "./firebase.js";

// ---------------------------------------------------------------------------
// In-memory session cache — updated by onAuthStateChanged.
// Keeps getCurrentUser() synchronous so app.js needs no changes on reads.
// ---------------------------------------------------------------------------
let _currentUser = null;

// Promise that resolves once Firebase completes its first auth check.
// Await this in app.js before rendering auth-guarded content.
let _authReadyResolve;
export const authReady = new Promise((resolve) => {
  _authReadyResolve = resolve;
});

onAuthStateChanged(auth, (firebaseUser) => {
  _currentUser = firebaseUser
    ? {
        id:         firebaseUser.uid,
        email:      firebaseUser.email || firebaseUser.displayName || "Google User",
        displayName: firebaseUser.displayName || null,
        photoURL:   firebaseUser.photoURL   || null,
        created_at: firebaseUser.metadata.creationTime,
      }
    : null;

  // Resolve the ready-promise (no-op on subsequent calls).
  _authReadyResolve();

  // Notify the application.
  window.dispatchEvent(new Event("auth_change"));
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns the cached user object, or null if not authenticated. */
export function getCurrentUser() {
  return _currentUser;
}

/** Synchronous auth check — safe to call anywhere. */
export function isAuthenticated() {
  return _currentUser !== null;
}

/**
 * Sign in (or register) using Google OAuth popup.
 * Works for both new and returning Google users.
 */
export async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    return { id: cred.user.uid, email: cred.user.email };
  } catch (error) {
    if (error.code === "auth/popup-closed-by-user") return null; // User dismissed
    if (error.code === "auth/popup-blocked")
      throw new Error("Popup was blocked. Please allow popups for this site.");
    console.error("Google sign-in error:", error);
    throw new Error("Google sign-in failed. Please try again.");
  }
}

/** Sign the current user out. */
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
    throw new Error("Failed to log out. Please try again.");
  }
}


