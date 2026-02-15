// /header-loader.js
// Injects /partials/header.html into #site-header using absolute paths.
// This prevents /binder/* pages from looking unstyled or “blank”.

(function () {
  const TARGET_ID = "site-header";
  const PARTIAL_URL = "/partials/header.html"; // ✅ ABSOLUTE
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

    // If you have header controls (theme/lang), re-init after injection
    try { window.initHeaderControls && window.initHeaderControls(); } catch (_) {}
    try { window.applyI18n && window.applyI18n(); } catch (_) {}
  }

  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      inject(cached);
      // re-init after cached inject
      try { window.initHeaderControls && window.initHeaderControls(); } catch (_) {}
      try { window.applyI18n && window.applyI18n(); } catch (_) {}
      loadAndCache().catch(() => {});
      return;
    }
  } catch (_) {}

  loadAndCache().catch(() => {});
})();
