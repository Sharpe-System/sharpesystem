// /header-loader.js
// Hardened: fast header paint + safe caching + post-injection init calls.
// Does NOT modify auth layer. Just loads /partials/header.html efficiently.

(async function () {
  const mount = document.getElementById("site-header");
  if (!mount) return;

  const CACHE_KEY = "sharpe_header_html_v1";
  const CACHE_TIME_KEY = "sharpe_header_html_t_v1";
  const MAX_AGE_MS = 1000 * 60 * 30; // 30 minutes

  function getCached() {
    try {
      const html = sessionStorage.getItem(CACHE_KEY);
      const t = Number(sessionStorage.getItem(CACHE_TIME_KEY) || "0");
      if (!html) return null;
      if (!t || (Date.now() - t) > MAX_AGE_MS) return null;
      return html;
    } catch (_) {
      return null;
    }
  }

  function setCached(html) {
    try {
      sessionStorage.setItem(CACHE_KEY, html);
      sessionStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
    } catch (_) {}
  }

  function initAll() {
    // after injection, initialize header controls
    queueMicrotask(() => {
      try { window.initHeaderControls?.(); } catch (_) {}
      try { window.initHeaderAuth?.(); } catch (_) {}
      try { window.initI18n?.(); } catch (_) {}
    });
  }

  // 1) Paint cached header immediately (fast perceived performance)
  const cached = getCached();
  if (cached) {
    mount.innerHTML = cached;
    initAll();
  }

  // 2) Fetch header with caching enabled (no "no-store")
  // force-cache lets the browser reuse cache when available.
  // If the file changes, the server should serve a new version or revalidate.
  try {
    const res = await fetch("/partials/header.html", {
      cache: "force-cache",
      credentials: "same-origin",
    });

    if (!res.ok) throw new Error("header fetch failed: " + res.status);

    const html = await res.text();

    // Only update DOM if content changed (reduces layout thrash)
    if (!cached || html !== cached) {
      mount.innerHTML = html;
      setCached(html);
      initAll();
    }
  } catch (e) {
    // If fetch fails and we had cached header, we already rendered it.
    // Otherwise, fail silently (but log for debugging).
    console.error("Header load failed:", e);
  }
})();
