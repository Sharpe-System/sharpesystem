/* /gate.js
   Frozen AUTH CORE gate
   - Reads requirements from <body data-*>
   - Checks auth + user profile
   - Redirects only if necessary
   - Never mutates UI
*/

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";

const TIER_RANK = {
  free: 0,
  basic: 1,     // Tier 1
  pro: 2,
  attorney: 3,
};

function normalizeTier(tier) {
  const t = (tier || "").toString().toLowerCase();
  return TIER_RANK.hasOwnProperty(t) ? t : "free";
}

function requires(body) {
  return {
    reqAuth: body?.dataset?.requireAuth === "1",
    reqActive: body?.dataset?.requireActive === "1",
    reqTier: body?.dataset?.requireTier
      ? normalizeTier(body.dataset.requireTier)
      : null,
  };
}

function currentPath() {
  return window.location.pathname + window.location.search + window.location.hash;
}

function redirectTo(url) {
  window.location.replace(url);
}

function buildLoginUrl() {
  const next = encodeURIComponent(currentPath());
  return `/login.html?next=${next}`;
}

function buildSubscribeUrl(reason) {
  const next = encodeURIComponent(currentPath());
  const r = encodeURIComponent(reason || "upgrade_required");
  return `/subscribe.html?reason=${r}&next=${next}`;
}

function meetsTier(required, actual) {
  if (!required) return true;
  return TIER_RANK[normalizeTier(actual)] >= TIER_RANK[required];
}

(async function gateBoot() {
  const body = document.body;
  if (!body) return;

  const { reqAuth, reqActive, reqTier } = requires(body);

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
    redirectTo(buildSubscribeUrl("insufficient_tier"));
    return;
  }
})();
