// theme.js — site-wide theme toggle (dark <-> light), persisted.
// Works on static hosting (GitHub Pages / Cloudflare Pages).

(function () {
  const STORAGE_KEY = "sharpe_theme"; // "dark" | "light"

  function getSavedTheme() {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === "light" ? "light" : "dark";
  }

  function applyTheme(theme) {
    const root = document.documentElement; // <html>
    if (theme === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme"); // default dark

    // Update button label if present
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = theme === "light" ? "Dark" : "Light";
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // Apply early on load
  applyTheme(getSavedTheme());

  // Wire up click (safe if button isn't on a given page)
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.id === "themeToggle") {
      e.preventDefault();
      toggleTheme();
    }
  });
})();
