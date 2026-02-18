// /firebase-config.js
// Frozen AUTH CORE module: initializes Firebase exactly once and exposes
// auth + firestore + SAFE helper exports for other modules.
// Canon rule: Other files may import from HERE, but must NOT import Firebase CDN directly.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/**
 * ✅ Replace with your actual Firebase config.
 * Keep it here only; do not duplicate init elsewhere.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyDhpiApUlhDz-hADnBfGE5Q9FLCGgkk9d4",
  authDomain: "sharpe-legal.firebaseapp.com",
  projectId: "sharpe-legal",
  storageBucket: "sharpe-legal.firebasestorage.app",
  messagingSenderId: "770027799385",
  appId: "1:770027799385:web:64c3f7bd4b7a140f5c0248",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// --- Shared, single-flight auth state (prevents multiple listeners across modules) ---
let _authStatePromise = null;

/**
 * Resolves once with { user } where user is Firebase user or null.
 * Never rejects. Never blocks UI rendering.
 */
export function getAuthStateOnce() {
  if (_authStatePromise) return _authStatePromise;

  _authStatePromise = new Promise((resolve) => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        try { unsub(); } catch {}
        resolve({ user: user || null });
      },
      () => resolve({ user: null })
    );
  });

  return _authStatePromise;
}

/**
 * Reads /users/{uid}. Returns null if missing/unreadable.
 * Expected fields:
 * - tier: "free" | "basic" | "pro" | "attorney"
 * - active: boolean
 */
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return snap.data() || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------
   Canon re-exports:
   These let other modules use Firebase functionality WITHOUT importing
   Firebase CDN directly. This keeps all Firebase imports centralized here.
------------------------------------------------------------------- */

// Auth helpers
export const authOnAuthStateChanged = onAuthStateChanged;

// IMPORTANT: wrapper so callers do NOT pass auth around (prevents drift)
export const authSignOut = () => signOut(auth);

// Firestore helpers
export const fsDoc = doc;
export const fsGetDoc = getDoc;
export const fsSetDoc = setDoc;
export const fsUpdateDoc = updateDoc;
export const fsCollection = collection;

// ✅ Compatibility default export
export default {
  firebaseConfig,
  app,
  auth,
  db,
  getAuthStateOnce,
  getUserProfile,
  authOnAuthStateChanged,
  authSignOut,
  fsDoc,
  fsGetDoc,
  fsSetDoc,
  fsUpdateDoc,
  fsCollection,
};
