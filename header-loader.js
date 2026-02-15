// header-loader.js
// Loads /partials/header.html once per tab, caches it, and injects immediately on future pages.
// This eliminates the "every page does an extra fetch" slowdown.

(function () {
  const TARGET_ID = "site-header";
  const PARTIAL_URL = "partials/header.html"; // relative (works on GH Pages + Cloudflare Pages)
  const CACHE_KEY = "sharpe_header_html_v1";

  function inject(html) {
    const el = document.getElementById(TARGET_ID);
    if (el) el.innerHTML = html;
  }

  async function loadAndCache() {
    const r = await fetch(PARTIAL_URL, { cache: "force-cache" });
    if (!r.ok) throw new Error("Header partial not found: " + PARTIAL_URL);
    const html = await r.text();
    try { sessionStorage.setItem(CACHE_KEY, html); } catch (_) {}
    inject(html);
  }

  // 1) Instant injection if cached (this is the speed win)
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      inject(cached);
      // Refresh quietly in background for this page only (non-blocking)
      loadAndCache().catch(() => {});
      return;
    }
  } catch (_) {}

  // 2) First page in the tab: fetch once
  loadAndCache().catch(() => {
    // Fail silently — pages still render without header
  });
})();
