// /safeNext.js
// Single source of truth for safe internal redirects.
// Accepts only absolute internal paths starting with "/"
// Blocks protocol-relative, external, malformed, or injected values.

export function safeNext(raw, fallback = "/dashboard.html") {
  if (!raw) return fallback;

  const v = String(raw).trim();

  if (!v || v === "undefined" || v === "null") return fallback;

  // Must start with single "/"
  if (!v.startsWith("/")) return fallback;

  // Block protocol-relative (//example.com)
  if (v.startsWith("//")) return fallback;

  // Block embedded protocols
  if (v.includes("://")) return fallback;

  // Strip hash fragments for consistency
  const clean = v.split("#")[0];

  return clean || fallback;
}

export function getNextParam(fallback = "/dashboard.html") {
  const params = new URLSearchParams(window.location.search);
  return safeNext(params.get("next"), fallback);
}

export function buildNextFromHere() {
  return encodeURIComponent(
    window.location.pathname + window.location.search
  );
}

export function goTo(path) {
  window.location.assign(path);
}

export function replaceTo(path) {
  window.location.replace(path);
}
