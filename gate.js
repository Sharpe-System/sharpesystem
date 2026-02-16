// /gate.js
// Frozen AUTH CORE gate:
// - Reads requirements from <body data-*> attributes
// - Checks auth + user profile (tier/active)
// - Redirects only if requirements not satisfied
// - Never hides/re-hides content, never mutates UI state

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";

const TIER_RANK = {
  free: 0,
  basic: 1,
  pro: 2,
  attorney: 3,
};

function normalizeTier(tier) {
  const t = (tier || "").toString().toLowerCase();
  return TIER_RANK.hasOwnProperty(t) ? t : "free";
}

function requires(body) {
  const reqAuth = body?.dataset?.requireAuth === "1";
  const reqActive = body?.dataset?.requireActive === "1";
  const reqTier = body?.dataset?.requireTier ? normalizeTier(body.dataset.requireTier) : null;
  return { reqAuth, reqActive, reqTier };
}

function currentPathWithQuery() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function redirectTo(url) {
  // Strictly controlled: a single hard navigation, no fancy router.
  window.location.replace(url);
}

function buildLoginUrl() {
  const next = encodeURIComponent(currentPathWithQuery());
  return `/login.html?next=${next}`;
}

function buildSubscribeUrl(reason) {
  const next = encodeURIComponent(currentPathWithQuery());
  const r = encodeURIComponent(reason || "upgrade_required");
  return `/subscribe.html?reason=${r}&next=${next}`;
}

function meetsTier(requiredTier, actualTier) {
  if (!requiredTier) return true;
  const req = TIER_RANK[normalizeTier(requiredTier)];
  const act = TIER_RANK[normalizeTier(actualTier)];
  return act >= req;
}

(async function gateBoot() {
  const body = document.body;
  if (!body) return; // if no body yet, do nothing; page will still render.

  const { reqAuth, reqActive, reqTier } = requires(body);

  // Public pages: do nothing.
  if (!reqAuth && !reqActive && !reqTier) return;

  // Auth required: check signed-in state once.
  const { user } = await getAuthStateOnce();
  if (!user) {
    redirectTo(buildLoginUrl());
    return;
  }

  // Profile required for tier/active enforcement.
  // If doc missing/unreadable, treat as free+inactive conservatively only if required.
  const profile = await getUserProfile(user.uid);
  const active = !!profile?.active;
  const tier = normalizeTier(profile?.tier);

  if (reqActive && !active) {
    redirectTo(buildSubscribeUrl("inactive_account"));
    return;
  }

  if (reqTier && !meetsTier(reqTier, tier)) {
    redirectTo(buildSubscribeUrl("insufficient_tier"));
    return;
  }

  // Passed gate: no DOM changes. No hiding. No re-rendering.
})();
