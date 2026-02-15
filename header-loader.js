// /header-loader.js  (COPY/PASTE WHOLE FILE)
(function () {
  const TARGET_ID = "site-header";
  const PARTIAL_URL = "/partials/header.html"; // ABSOLUTE PATH
  const CACHE_KEY = "sharpe_header_html_v2";   // bump key to flush bad cached header

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

    try { window.initHeaderControls?.(); } catch (_) {}
  }

  // Instant injection if cached
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      inject(cached);
      try { window.initHeaderControls?.(); } catch (_) {}
      loadAndCache().catch(() => {});
      return;
    }
  } catch (_) {}

  loadAndCache().catch(() => {});
})();
