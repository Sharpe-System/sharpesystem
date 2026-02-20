// /header-loader.js
// Loads /partials/header.html into #site-header on every page.
// Canon: header mounting is shared; pages should not duplicate header logic.

(async function () {
  "use strict";

  const mount = document.getElementById("site-header");
  if (!mount) return;

  try {
    const res = await fetch("/partials/header.html", { cache: "no-store" });
    if (!res.ok) throw new Error("header fetch failed");
    mount.innerHTML = await res.text();

    // Initialize header controls (theme + auth + language)
    if (typeof window.initHeaderControls === "function") {
      window.initHeaderControls();
    }
    if (typeof window.initHeaderAuth === "function") {
      window.initHeaderAuth();
    }
  } catch (_) {
    // Fail open: no header is better than a broken page
  }
})();
