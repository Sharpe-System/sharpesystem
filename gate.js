// /gate.js
// Auth Core v1 — Frozen Gate (deterministic routing)
// Reads requirements from <body data-*> attributes and redirects ONLY when unmet.
// No DOM mutations. No UI state changes. No Firebase init here.
//
// Body attributes (all optional):
//   data-require-auth="1"
//   data-require-tier="free|basic|pro|attorney"
//   data-require-active="1"
//
// Redirect rules (frozen):
//   logged out                    -> /login.html?reason=login_required&next=...
//   logged in but inactive        -> /subscribe.html?reason=inactive_account&next=...
//   logged in but insufficient    -> /tier1.html?reason=insufficient_tier&next=...

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

function tierMeets(requiredTier, actualTier) {
  if (!requiredTier) return true;
  const req = TIER_RANK[normalizeTier(requiredTier)];
  const act = TIER_RANK[normalizeTier(actualTier)];
  return act >= req;
}

function currentPathWithQuery() {
  return (
    (window.location.pathname || "/") +
    (window.location.search || "") +
    (window.location.hash || "")
  );
}

// Safe next:
// - must start with "/"
// - block protocol-relative ("//")
// - block login/signup to prevent loops
// - fallback to "/dashboard.html"
function safeNext(rawNext, fallback = "/dashboard.html") {
  const n = String(rawNext || "").trim();
  if (!n.startsWith("/")) return fallback;
  if (n.startsWith("//")) return fallback;
  const lower = n.toLowerCase();
  if (lower.startsWith("/login") || lower.startsWith("/signup")) return fallback;
  return n;
}

function redirectTo(url) {
  window.location.replace(url);
}

function buildUrl(path, params) {
  const usp = new URLSearchParams(params || {});
  const qs = usp.toString();
  return qs ? `${path}?${qs}` : path;
}

function requires(body) {
  const ds = body?.dataset || {};
  const reqAuth = ds.requireAuth === "1";
  const reqActive = ds.requireActive === "1";
  const reqTier = ds.requireTier ? normalizeTier(ds.requireTier) : "";
  return { reqAuth, reqActive, reqTier };
}

(function bootGate() {
  const body = document.body;
  if (!body) return; // If body isn't ready, do nothing (page still renders).

  const { reqAuth, reqActive, reqTier } = requires(body);

  // No requirements => public page => no-op.
  if (!reqAuth && !reqActive && !reqTier) return;

  // Never gate auth entry pages (prevents loops).
  const p = (window.location.pathname || "").toLowerCase();
  if (p === "/login.html" || p === "/signup.html") return;

  const next = safeNext(currentPathWithQuery(), "/dashboard.html");

  (async () => {
    // 1) Auth check once
    const { user } = await getAuthStateOnce();
    if (!user) {
      redirectTo(
        buildUrl("/login.html", {
          reason: "login_required",
          next,
        })
      );
      return;
    }

    // 2) If no tier/active requirements, auth-only page is satisfied.
    if (!reqActive && !reqTier) return;

    // 3) Load profile for entitlements
    const profile = await getUserProfile(user.uid);
    const active = profile?.active === true;
    const tier = normalizeTier(profile?.tier);

    // 4) Active enforcement (only if required)
    if (reqActive && !active) {
      redirectTo(
        buildUrl("/subscribe.html", {
          reason: "inactive_account",
          next,
        })
      );
      return;
    }

    // 5) Tier enforcement
    if (reqTier && !tierMeets(reqTier, tier)) {
      redirectTo(
        buildUrl("/tier1.html", {
          reason: "insufficient_tier",
          next,
        })
      );
      return;
    }

    // Passed gate: no DOM changes.
  })().catch(() => {
    // Conservative fallback: treat as not logged in
    redirectTo(
      buildUrl("/login.html", {
        reason: "login_required",
        next,
      })
    );
  });
})();
