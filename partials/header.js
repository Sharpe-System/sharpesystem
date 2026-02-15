// /header.js
// Safe for injected partials: call window.initHeaderControls() after header HTML is injected.
// Also runs once on DOMContentLoaded, and can be called again safely.

// Storage helpers
function getSaved(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v && v !== "undefined" && v !== "null" ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

function setSaved(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

/* ---------------- THEME ----------------
   Uses: html[data-theme="dark"|"light"]
   Button (optional): id="themeToggle" OR id="hdrTheme"
*/
function applyTheme(mode) {
  const m = (mode === "light") ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", m);
  setSaved("theme", m);

  const btn =
    document.getElementById("themeToggle") ||
    document.getElementById("hdrTheme");

  if (btn) btn.textContent = (m === "light") ? "Light" : "Dark";
}

function wireThemeToggle() {
  const btn =
    document.getElementById("themeToggle") ||
    document.getElementById("hdrTheme");

  if (!btn) return;

  // prevent double-binding if initHeaderControls is called multiple times
  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

/* ---------------- LANGUAGE ----------------
   Uses: html[data-lang="en"|"es"]
   Your header uses: id="langToggle"
*/
function applyLang(lang) {
  const l = (lang === "es") ? "es" : "en";
  document.documentElement.setAttribute("data-lang", l);
  setSaved("lang", l);

  const btn = document.getElementById("langToggle");
  if (btn) btn.textContent = (l === "en") ? "ES" : "EN"; // button shows what you can switch to

  // If your i18n exposes a function, call it safely:
  // if (window.applyI18n) window.applyI18n(l);
}

function wireLangToggle() {
  const btn = document.getElementById("langToggle");
  if (!btn) return;

  if (btn.dataset.bound === "1") return;
  btn.dataset.bound = "1";

  btn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-lang") || "en";
    applyLang(current === "en" ? "es" : "en");
  });
}

/* ---------------- INIT (safe for partial injection) ---------------- */
function initHeaderControls() {
  // Apply saved settings every time (idempotent)
  applyTheme(getSaved("theme", "dark"));
  applyLang(getSaved("lang", "en"));

  // Then wire buttons if present
  wireThemeToggle();
  wireLangToggle();
}

// Expose so header-loader can call it after injection
window.initHeaderControls = initHeaderControls;

// Run once for pages where header is already present
document.addEventListener("DOMContentLoaded", () => {
  initHeaderControls();
});
