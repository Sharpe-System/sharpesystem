// /header-loader.js
// Loads /partials/header.html once per tab, caches it, and injects into #site-header.
// IMPORTANT: uses absolute "/partials/header.html" so it works from /binder/* pages too.

(function () {
  const TARGET_ID = "site-header";
  const PARTIAL_URL = "/partials/header.html"; // <-- ABSOLUTE PATH (fix)
  const CACHE_KEY = "sharpe_header_html_v1";

  function inject(html) {
    const el = document.getElementById(TARGET_ID);
    if (el) el.innerHTML = html;
  }

  async function loadAndCache() {
    const r = await fetch(PARTIAL_URL, { cache: "no-store" });
    if (!r.ok) throw new Error("Header partial not found: " + PARTIAL_URL);
    const html = await r.text();
    try { sessionStorage.setItem(CACHE_KEY, html); } catch (_) {}
    inject(html);

    // If you wired header controls, run after injection (safe if missing)
    try { window.initHeaderControls?.(); } catch (_) {}
  }

  // 1) Instant injection if cached
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      inject(cached);
      try { window.initHeaderControls?.(); } catch (_) {}
      // Refresh quietly
      loadAndCache().catch(() => {});
      return;
    }
  } catch (_) {}

  // 2) First page: fetch
  loadAndCache().catch(() => {
    // Fail silently — page still renders without header
  });
})();
