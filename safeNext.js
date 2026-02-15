// /safeNext.js
// Single source of truth for safe internal redirects.
// - Accepts only site-internal paths that start with "/"
// - Rejects "undefined", "null", "//example.com", "http..." etc.

export function safeNext(raw, fallback = "/dashboard") {
  if (!raw) return fallback;

  const v = String(raw).trim();

  if (!v || v === "undefined" || v === "null") return fallback;

  // Must be an internal absolute path
  if (!v.startsWith("/")) return fallback;

  // Block protocol-relative
  if (v.startsWith("//")) return fallback;

  // Optional extra hardening: block obvious protocols embedded
  if (v.includes("://")) return fallback;

  return v;
}

export function getNextParam(fallback = "/dashboard") {
  const params = new URLSearchParams(window.location.search);
  return safeNext(params.get("next"), fallback);
}

export function buildNextFromHere() {
  // Stores current path + query as next target
  return encodeURIComponent(window.location.pathname + window.location.search);
}

export function goTo(path) {
  window.location.assign(path);
}

export function replaceTo(path) {
  window.location.replace(path);
}
