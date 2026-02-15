// /header.js
// Theme only. Language handled by i18n.js

(function () {
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
    if (btn) btn.textContent = m === "light" ? "Light" : "Dark";
  }

  function initTheme() {
    applyTheme(getSaved());

    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    if (btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    btn.addEventListener("click", () => {
      const current =
        document.documentElement.getAttribute("data-theme") || "dark";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  window.initHeaderControls = function () {
    initTheme();
  };

  document.addEventListener("DOMContentLoaded", initTheme);
})();
