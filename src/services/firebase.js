// Firebase Initialisation
// All Firebase SDK imports use the CDN ES module build — no bundler required.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBWJ7Ksrtpy5xo5TPaE0QqXVsS4U73OR0k",
  authDomain:        "cinefind-5.firebaseapp.com",
  projectId:         "cinefind-5",
  storageBucket:     "cinefind-5.firebasestorage.app",
  messagingSenderId: "217930600583",
  appId:             "1:217930600583:web:a1e175dda3279863b02822",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
