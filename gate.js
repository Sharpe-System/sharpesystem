// /gate.js
// Page guard that waits for auth resolution before redirecting.

import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

function getNext() {
  const url = new URL(window.location.href);
  return url.pathname + url.search;
}

function goLogin() {
  const next = encodeURIComponent(getNext());
  window.location.replace(`/login?next=${next}`);
}

async function getUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Usage: <body data-require-auth="1" data-require-tier="tier1">
export function runGate() {
  const requireAuth = document.body?.dataset?.requireAuth === "1";
  const requireTier = document.body?.dataset?.requireTier || "";

  if (!requireAuth && !requireTier) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (requireAuth) goLogin();
      return;
    }

    if (!requireTier) return;

    try {
      const data = await getUserDoc(user.uid);
      const tier = data?.tier || "none";
      const active = data?.active === true;

      // Tier rules: must match tier AND active
      if (tier !== requireTier || !active) {
        window.location.replace("/tier1");
      }
    } catch (e) {
      console.error(e);
      // If firestore fails, don't brick the user with loops—send to dashboard
      window.location.replace("/dashboard");
    }
  });
}

// Auto-run if included as a module on the page
runGate();
