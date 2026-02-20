// /partials/header.js
// Theme toggle only. Auth is handled by /header-auth.js (frozen layer).

(function () {
  "use strict";

  function setTheme(next) {
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ss_theme_v1", next);
  }

  function getTheme() {
    return localStorage.getItem("ss_theme_v1") || "dark";
  }

  window.initHeaderControls = function initHeaderControls() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    // Apply saved theme immediately
    setTheme(getTheme());

    btn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "dark";
      setTheme(cur === "dark" ? "light" : "dark");
    });
  };
})();
