// /tiers.js
// Canonical tier vocabulary for SharpeSystem (AUTH-owned)

export const TIERS = ["free", "basic", "pro", "attorney"];

export const TIER_RANK = {
  free: 0,
  basic: 1,     // Marketing: "Tier 1"
  pro: 2,
  attorney: 3,
};

export function normalizeTier(tier) {
  const t = String(tier || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(TIER_RANK, t) ? t : "free";
}

export function meetsTier(requiredTier, actualTier) {
  if (!requiredTier) return true;
  const req = TIER_RANK[normalizeTier(requiredTier)];
  const act = TIER_RANK[normalizeTier(actualTier)];
  return act >= req;
}
