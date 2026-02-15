// header-loader.js
// Loads /partials/header.html, caches per-tab, injects into #site-header,
// and then initializes theme + language toggles AFTER injection.

(function () {
  const TARGET_ID = "site-header";

  // Prefer absolute for Cloudflare Pages (works from /binder/* too)
  // Fallback to relative (useful if someone hosts under a subpath).
  const CANDIDATE_URLS = [
    "/partials/header.html",
    "partials/header.html",
    "../partials/header.html",
  ];

  // Bump this if you change header markup and want cache invalidation
  const CACHE_KEY = "sharpe_header_html_v2";

  function inject(html) {
    const el = document.getElementById(TARGET_ID);
    if (el) el.innerHTML = html;
  }

  // After header HTML is in the DOM, run init hooks:
  // - Theme toggle (optional)
  // - Language/i18n rebind (optional)
  function initHeaderControls() {
    // If you have your own init functions, call them here.
    // Theme
    if (typeof window.initThemeToggle === "function") {
      try { window.initThemeToggle(); } catch (_) {}
    } else if (typeof window.Theme === "object" && typeof window.Theme.init === "function") {
      try { window.Theme.init(); } catch (_) {}
    }

    // i18n / language toggle
    if (typeof window.initI18n === "function") {
      try { window.initI18n(); } catch (_) {}
    } else if (typeof window.I18N === "object" && typeof window.I18N.init === "function") {
      try { window.I18N.init(); } catch (_) {}
    }

    // Also broadcast an event so any page script can listen.
    try { window.dispatchEvent(new CustomEvent("header:loaded")); } catch (_) {}
  }

  async function fetchFirstWorkingUrl() {
    let lastErr = null;

    for (const url of CANDIDATE_URLS) {
      try {
        const r = await fetch(url, { cache: "force-cache" });
        if (!r.ok) throw new Error(`Header fetch failed (${r.status}) for ${url}`);
        const html = await r.text();
        return { html, url };
      } catch (e) {
        lastErr = e;
      }
    }

    throw lastErr || new Error("Header partial not found.");
  }

  async function loadAndCache() {
    const { html } = await fetchFirstWorkingUrl();
    try { sessionStorage.setItem(CACHE_KEY, html); } catch (_) {}
    inject(html);
    initHeaderControls();
  }

  // 1) Instant injection from per-tab cache
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      inject(cached);
      initHeaderControls();

      // Refresh quietly (non-blocking)
      loadAndCache().catch(() => {});
      return;
    }
  } catch (_) {}

  // 2) First page in tab: fetch once
  loadAndCache().catch(() => {
    // Silent fail — page still renders without header
  });
})();
