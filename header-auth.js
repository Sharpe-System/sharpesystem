// /header-auth.js
// Frozen header auth layer.
// Canon rules:
// - NO redirects for auth/tier here (gate.js owns gating/redirects)
// - NO Firebase CDN imports
// - Auth state via getAuthStateOnce() only (no onAuthStateChanged here)

import { getAuthStateOnce, signOutUser } from "/firebase-config.js";

(function () {
  "use strict";

  window.initHeaderAuth = async function initHeaderAuth() {
    const a = document.getElementById("navAccount");
    const btnLogout = document.getElementById("navLogout");
    if (!a || !btnLogout) return;

    try {
      const state = await getAuthStateOnce();
      const user = state?.user;

      if (user) {
        a.textContent = "Dashboard";
        a.href = "/dashboard.html";
        btnLogout.style.display = "";
        btnLogout.onclick = async () => {
          try {
            await signOutUser();
          } catch (_) {}
          // No redirect: let user continue; optional manual refresh.
          window.location.reload();
        };
      } else {
        a.textContent = "Log in";
        a.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        btnLogout.style.display = "none";
      }
    } catch (_) {
      // Fail open: leave default links
    }
  };
})();
