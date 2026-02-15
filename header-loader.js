// header-loader.js
(function () {
  const TARGET_ID = "site-header";
  const PARTIAL_URL = "/partials/header.html"; // leading slash = always from site root
  const CACHE_KEY = "sharpe_header_html_v2";

  function inject(html) {
    const el = document.getElementById(TARGET_ID);
    if (el) el.innerHTML = html;

    // If you have these functions, this will run them after header loads.
    try { window.initTheme?.(); } catch (_) {}
    try { window.initI18n?.(); } catch (_) {}
  }

  async function loadAndCache() {
    const r = await fetch(PARTIAL_URL, { cache: "no-store" });
    if (!r.ok) throw new Error("Header partial not found: " + PARTIAL_URL);
    const html = await r.text();
    try { sessionStorage.setItem(CACHE_KEY, html); } catch (_) {}
    inject(html);
  }

  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      inject(cached);
      loadAndCache().catch(() => {});
      return;
    }
  } catch (_) {}

  loadAndCache().catch(() => {});
})();
