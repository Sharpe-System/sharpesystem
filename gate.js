// /gate.js
// Waits for Firebase auth resolution BEFORE redirecting.
// Body attributes control behavior:
//   data-require-auth="1"
//   data-require-tier="tier1"

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

function currentPathWithQuery() {
  return window.location.pathname + window.location.search;
}

function goLogin() {
  const next = encodeURIComponent(currentPathWithQuery());
  window.location.replace(`/login?next=${next}`);
}

async function loadUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function normalizeTier(v) {
  return (v || "").toString().trim().toLowerCase();
}

async function handleAuthed(user, requireTier) {
  if (!requireTier) return;

  try {
    const data = await loadUserDoc(user.uid);
    const tier = normalizeTier(data?.tier);
    const active = data?.active === true;

    if (tier !== normalizeTier(requireTier) || !active) {
      window.location.replace("/tier1");
    }
  } catch (e) {
    console.error("Gate doc read failed:", e);
    // fail open to dashboard instead of looping
    window.location.replace("/dashboard");
  }
}

export function runGate() {
  const requireAuth = document.body?.dataset?.requireAuth === "1";
  const requireTier = document.body?.dataset?.requireTier || "";

  if (!requireAuth && !requireTier) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (requireAuth) goLogin();
      return;
    }
    await handleAuthed(user, requireTier);
  });
}

runGate();
