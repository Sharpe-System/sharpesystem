/ Frozen AUTH CORE gate (v1 stabilized):
// - Reads requirements from <body data-*> attributes
// - Checks auth + user profile (tier/active)
// - Redirects only when requirements are not satisfied
// - Never hides/re-hides content, never mutates UI state
//
// Body attributes:
//   data-require-auth="1"                 (optional)
//   data-require-tier="free|basic|pro|attorney" (optional; min tier)
//   data-require-active="1"               (optional; requires active === true)
//
// Redirect rules (frozen):
//   logged out            -> /login.html?reason=login_required&next=...
//   inactive (if required)-> /subscribe.html?reason=inactive_account&next=...
//   insufficient tier     -> /tier1.html?reason=insufficient_tier&next=...

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";

const TIER_RANK = {
  free: 0,
  basic: 1,
  pro: 2,
  attorney: 3,
};

function normalizeTier(tier) {
  const t = String(tier || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TIER_RANK, t) ? t : "free";
}

function requires(body) {
  const ds = body?.dataset || {};
  const reqAuth = ds.requireAuth === "1";
  const reqActive = ds.requireActive === "1";
  const reqTier = ds.requireTier ? normalizeTier(ds.requireTier) : "";
  return { reqAuth, reqActive, reqTier };
}

function currentPathWithQuery() {
  return (
    (window.location.pathname || "/") +
    (window.location.search || "") +
    (window.location.hash || "")
  );
}

// Minimal, self-contained safeNext (no external files)
// - must be a same-site path starting with "/"
// - block protocol-relative ("//")
// - block auth entry pages to avoid loops
// - fallback to "/dashboard.html"
function safeNext(raw) {
  const fallback = "/dashboard.html";
  const s = String(raw || "");
  if (!s.startsWith("/")) return fallback;
  if (s.startsWith("//")) return fallback;

  const lowerPath = (s.split("?")[0] || "").toLowerCase();
  if (lowerPath === "/login.html" || lowerPath === "/signup.html") return fallback;

  return s;
}

function redirectTo(url) {
  // Strictly controlled: a single hard navigation, no router.
  window.location.replace(url);
}

function buildUrl(path, reason) {
  const next = encodeURIComponent(safeNext(currentPathWithQuery()));
  const r = encodeURIComponent(String(reason || ""));
  return ${path}?reason=${r}&next=${next};
}

function meetsTier(requiredTier, actualTier) {
  if (!requiredTier) return true;
  const req = TIER_RANK[normalizeTier(requiredTier)];
  const act = TIER_RANK[normalizeTier(actualTier)];
  return act >= req;
}

(function gateBoot() {
  // If body not yet available, do nothing. Page will still render.
  // (All your pages place gate at the bottom, so body should exist.)
  const body = document.body;
  if (!body) return;

  // Never gate the auth entry pages (prevents loops regardless of tags).
  const p = (window.location.pathname || "").toLowerCase();
  if (p === "/login.html" || p === "/signup.html") return;

  const { reqAuth, reqActive, reqTier } = requires(body);

  // Public pages: no-op.
  if (!reqAuth && !reqActive && !reqTier) return;

  (async () => {
    // Auth required implicitly if any requirement exists.
    const { user } = await getAuthStateOnce();

    if (!user) {
      redirectTo(buildUrl("/login.html", "login_required"));
      return;
    }

    // If only auth is required, we're done.
    if (!reqActive && !reqTier) return;

    // Pull profile once. Missing doc => conservative defaults.
    const profile = await getUserProfile(user.uid);
    const active = profile?.active === true;
    const tier = normalizeTier(profile?.tier);

    if (reqActive && !active) {
      redirectTo(buildUrl("/subscribe.html", "inactive_account"));
      return;
    }

    if (reqTier && !meetsTier(reqTier, tier)) {
      redirectTo(buildUrl("/tier1.html", "insufficient_tier"));
      return;
    }

    // Passed gate: no DOM changes. No hiding. No re-rendering.
  })().catch(() => {
    // Fail closed to login for protected pages (deterministic).
    redirectTo(buildUrl("/login.html", "login_required"));
  });
})();
