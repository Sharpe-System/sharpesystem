// /header.js
// Theme only. Language handled by i18n.js
// Hardened: idempotent init + supports missing elements gracefully.

(function () {
  "use strict";

  const STORAGE_KEY = "sharpe_theme";

  function getSaved() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "dark";
    } catch (_) {
      return "dark";
    }
  }

  function setSaved(v) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch (_) {}
  }

  function applyTheme(mode) {
    const m = mode === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", m);
    setSaved(m);

    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = (m === "light" ? "Light" : "Dark");
  }

  function bindThemeToggle() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  function initTheme() {
    applyTheme(getSaved());
    bindThemeToggle();
  }

  // Called after header partial is injected
  window.initHeaderControls = function () {
    initTheme();
  };

  // Also run once on DOM ready in case header is not loaded via partials
  document.addEventListener("DOMContentLoaded", initTheme);
})();
