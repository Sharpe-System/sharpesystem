// /header-loader.js
// Hardened: fast header paint + safe caching + post-injection init calls.
// Loads /partials/header.html efficiently.
// After injection, dispatches "sharpe:header:loaded" for i18n re-apply.

(async function () {
  "use strict";

  const mount = document.getElementById("site-header");
  if (!mount) return;

  const CACHE_KEY = "sharpe_header_html_v1";
  const CACHE_TIME_KEY = "sharpe_header_html_t_v1";
  const MAX_AGE_MS = 1000 * 60 * 30; // 30 minutes
  const HEADER_EVENT = "sharpe:header:loaded";

  function dispatchHeaderLoaded() {
    try { document.dispatchEvent(new Event(HEADER_EVENT)); } catch (_) {}
  }

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
    queueMicrotask(() => {
      try { window.initHeaderControls?.(); } catch (_) {}
      try { window.initHeaderAuth?.(); } catch (_) {}
      try { window.initI18n?.(); } catch (_) {}
      dispatchHeaderLoaded();
    });
  }

  // 1) Paint cached header immediately
  const cached = getCached();
  if (cached) {
    mount.innerHTML = cached;
    initAll();
  }

  // 2) Fetch latest header
  try {
    const res = await fetch("/partials/header.html", {
      cache: "force-cache",
      credentials: "same-origin",
    });

    if (!res.ok) throw new Error("header fetch failed: " + res.status);

    const html = await res.text();

    if (!cached || html !== cached) {
      mount.innerHTML = html;
      setCached(html);
      initAll();
    }
  } catch (e) {
    console.error("Header load failed:", e);
  }
})();
