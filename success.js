// /success.js
// Canon: no Firebase CDN imports here.
// Safe post-success handler (e.g., after checkout or signup confirmation).

import { authOnAuthStateChanged, auth, db, fsDoc, fsSetDoc } from "./firebase-config.js";

(function () {
  "use strict";

  function getParam(name) {
    try { return new URLSearchParams(window.location.search).get(name); } catch { return null; }
  }

  function safeNext(raw) {
    if (!raw) return null;
    try {
      // only allow same-origin relative paths
      if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
      return null;
    } catch {
      return null;
    }
  }

  const next = safeNext(getParam("next"));

  authOnAuthStateChanged(auth, async (user) => {
    if (!user) {
      // not logged in -> go to login, preserve next if present
      const url = next ? `/login.html?next=${encodeURIComponent(next)}` : "/login.html";
      try { window.location.href = url; } catch {}
      return;
    }

    // Write a harmless marker (do NOT touch tier/active/role here)
    try {
      const ref = fsDoc(db, "users", user.uid);
      await fsSetDoc(ref, { meta: { lastSuccessAt: new Date().toISOString() } }, { merge: true });
    } catch (e) {
      console.warn("Success marker write failed:", e);
    }

    if (next) {
      try { window.location.href = next; } catch {}
    }
  });
})();
