// /gate.js
// Canonical gate for all protected pages.
// Usage: put these on <body>:
//   data-require-auth="1"
//   data-require-tier="tier1"   (optional)
//   data-next="/dashboard.html" (optional)

import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { safeNext } from "/safeNext.js";

const auth = getAuth(app);
const db = getFirestore(app);

function getBodyAttr(name) {
  return document.body?.getAttribute(name) || "";
}

function isEnabled(name) {
  return getBodyAttr(name) === "1";
}

function requiredTier() {
  const t = getBodyAttr("data-require-tier");
  return t ? String(t).toLowerCase() : "";
}

function nextTarget() {
  // Prefer explicit data-next, else current path+query
  const explicit = getBodyAttr("data-next");
  if (explicit) return explicit;

  const path = window.location.pathname || "/";
  const qs = window.location.search || "";
  return path + qs;
}

function go(url) {
  window.location.replace(url);
}

async function checkTier(user, tierReq) {
  if (!tierReq) return true;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return false;

  const data = snap.data() || {};
  const userTier = String(data.tier || "").toLowerCase();

  return userTier === tierReq;
}

(function initGate() {
  // If page doesn't require auth, do nothing.
  if (!isEnabled("data-require-auth")) return;

  // Prevent gate running on login page (safety)
  if ((window.location.pathname || "").startsWith("/login")) return;

  const tierReq = requiredTier();
  const next = safeNext(nextTarget(), "/dashboard.html");

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        go(`/login.html?next=${encodeURIComponent(next)}`);
        return;
      }

      // If tier required, enforce it
      if (tierReq) {
        const ok = await checkTier(user, tierReq);
        if (!ok) {
          go("/tier1.html");
          return;
        }
      }

      // Auth ok + tier ok => allow page to render
      // (No-op)

    } catch (e) {
      console.log("gate error", e);
      go(`/login.html?next=${encodeURIComponent(next)}`);
    }
  });
})();
