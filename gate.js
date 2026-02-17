// /gate.js
// Frozen AUTH CORE gate:
// - Reads requirements from <body data-*> attributes
// - Checks auth + user profile (tier/active)
// - Redirects only when requirements not satisfied
// - Never hides/re-hides content, never mutates UI state

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";
import { normalizeTier, meetsTier } from "/tiers.js";

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
  window.location.replace(url);
}

function buildLoginUrl() {
  const next = encodeURIComponent(currentPathWithQuery());
  return `/login.html?reason=login_required&next=${next}`;
}

function buildTierUrl(reason) {
  const next = encodeURIComponent(currentPathWithQuery());
  const r = encodeURIComponent(reason || "insufficient_tier");
  return `/tier1.html?reason=${r}&next=${next}`;
}

function buildSubscribeUrl(reason) {
  const next = encodeURIComponent(currentPathWithQuery());
  const r = encodeURIComponent(reason || "inactive_account");
  return `/subscribe.html?reason=${r}&next=${next}`;
}

(async function gateBoot() {
  const body = document.body;
  if (!body) return;

  const { reqAuth, reqActive, reqTier } = requires(body);

  // Public pages: do nothing.
  if (!reqAuth && !reqActive && !reqTier) return;

  const { user } = await getAuthStateOnce();
  if (!user) {
    redirectTo(buildLoginUrl());
    return;
  }

  const profile = await getUserProfile(user.uid);
  const active = !!profile?.active;
  const tier = normalizeTier(profile?.tier);

  if (reqActive && !active) {
    redirectTo(buildSubscribeUrl("inactive_account"));
    return;
  }

  if (reqTier && !meetsTier(reqTier, tier)) {
    redirectTo(buildTierUrl("insufficient_tier"));
    return;
  }
})();
