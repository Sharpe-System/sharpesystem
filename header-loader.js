// /header-loader.js
// Injects /partials/header.html into #site-header, then signals ready via event.
// This prevents race conditions where i18n runs before header exists.

(function () {
  const TARGET_ID = "site-header";
  const PARTIAL_URL = "/partials/header.html";
  const EVENT_NAME = "sharpe:header:loaded";

  async function inject() {
    const mount = document.getElementById(TARGET_ID);
    if (!mount) return;

    // Idempotent: if header already injected, do nothing.
    if (mount.dataset.loaded === "1") {
      document.dispatchEvent(new CustomEvent(EVENT_NAME));
      return;
    }

    try {
      const r = await fetch(PARTIAL_URL, { cache: "no-store" });
      if (!r.ok) throw new Error(`Header fetch failed: ${r.status}`);
      const html = await r.text();
      mount.innerHTML = html;
      mount.dataset.loaded = "1";

      // Signal: header is now in DOM
      document.dispatchEvent(new CustomEvent(EVENT_NAME));
    } catch (e) {
      // Fail silently (but still signal so i18n can proceed)
      console.log(e);
      document.dispatchEvent(new CustomEvent(EVENT_NAME));
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
