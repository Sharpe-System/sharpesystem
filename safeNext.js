// /safeNext.js
// Purpose: sanitize ?next= so nobody can send users off-site or into weird loops.

export function safeNext(raw, fallback = "/dashboard.html") {
  if (!raw) return fallback;

  // Handle accidental string "null"/"undefined"
  if (raw === "null" || raw === "undefined") return fallback;

  // Must be a relative path starting with "/"
  if (typeof raw !== "string" || !raw.startsWith("/")) return fallback;

  // Block protocol-relative //evil.com
  if (raw.startsWith("//")) return fallback;

  // Optional: block redirecting back to login itself
  if (raw.startsWith("/login")) return fallback;

  return raw;
}
