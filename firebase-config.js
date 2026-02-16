// /firebase-config.js
// Frozen AUTH CORE module: initializes Firebase exactly once and exposes
// a shared auth state promise + helper to read the user doc.

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/**
 * ✅ Replace with your actual Firebase config.
 * Keep it here only; do not duplicate init elsewhere.
 */
const firebaseConfig = {
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
 * Expected fields (AUTH-owned semantics only):
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
