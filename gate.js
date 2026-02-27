// /gate.js
// Canon rules:
// - This is the ONLY place allowed to enforce auth/tier via redirects.
// - No Firebase CDN imports here (only /firebase-config.js may import Firebase CDN).
// - Pages/modules must NOT redirect for auth/tier; they may only read gate state.
// - Gate redirects should preserve ?next=... for return navigation.

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";

(function () {
  "use strict";

  function sameOriginPath(p) {
    try {
      const url = new URL(p, window.location.origin);
      if (url.origin !== window.location.origin) return "/";
      return url.pathname + url.search + url.hash;
    } catch (_) {
      return "/";
    }
  }

  function go(url) {
    window.location.replace(url);
  }

  async function runGate() {
    const path = window.location.pathname;

    // Public routes: do not gate
    // (Routes manifest should also classify these public.)
    const isPublic =
      path === "/" ||
      path === "/index.html" ||
      path === "/home.html" ||
      path.startsWith("/rfo/") ||
      path.startsWith("/binder/") ||
      path.startsWith("/immigration/") ||
      path.startsWith("/dmv/") ||
      path === "/login.html" ||
      path === "/signup.html" ||
      path === "/billing.html" ||
      path === "/subscribe.html" ||
      path === "/high-conflict-risk-awareness.html" ||
      path === "/trees.html" ||
      path === "/status.html";

    if (isPublic) return;

    // Protected routes: require auth
    const next = encodeURIComponent(sameOriginPath(window.location.pathname + window.location.search));
    const state = await getAuthStateOnce();
    if (!state?.user) {
      go(`/login.html?reason=login_required&next=${next}`);
      return;
    }

    // If profile says inactive, send to billing (canon: gate owns this)
    const profile = await getUserProfile(state.user.uid);
    if (profile && profile.active === false) {
      go(`/billing.html?reason=inactive_account&next=${next}`);
      return;
    }

    // Tier enforcement (if present)
    // If your profile schema uses tier strings: "free" | "basic" | "pro"
    const required = document.documentElement.getAttribute("data-required-tier");
    if (required) {
      const tier = (profile?.tier || "free").toLowerCase();
      const ok =
        required === "free" ||
        (required === "basic" && (tier === "basic" || tier === "pro")) ||
        (required === "pro" && tier === "pro");

      if (!ok) {
        go(`/billing.html?reason=insufficient_tier&next=${next}`);
        return;
      }
    }
  }

  // Fail open (canon-friendly): if gate errors, do not brick site.
  runGate().catch(() => {});
})();
