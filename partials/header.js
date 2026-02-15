// /header.js
// Works even when header is injected as a partial.
// - Theme: sets html[data-theme="dark|light"] + localStorage
// - Lang: sets html[data-lang="en|es"] + localStorage (i18n can read it)

function getSaved(key, fallback) {
  const v = localStorage.getItem(key);
  return v && v !== "undefined" && v !== "null" ? v : fallback;
}

/* ---------------- THEME ---------------- */
function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("theme", mode);

  const btn = document.getElementById("hdrTheme");
  if (btn) btn.textContent = mode === "light" ? "Light" : "Dark";
}

function initTheme() {
  const saved = getSaved("theme", "dark");
  applyTheme(saved);

  document.getElementById("hdrTheme")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

/* ---------------- LANGUAGE ----------------
   This does NOT force your translation system.
   It just sets a durable attribute your i18n can use.
*/
function applyLang(lang) {
  document.documentElement.setAttribute("data-lang", lang);
  localStorage.setItem("lang", lang);

  const btn = document.getElementById("hdrLang");
  if (btn) btn.textContent = (lang || "en").toUpperCase();

  // If you already have an i18n hook, call it here safely:
  // if (window.applyI18n) window.applyI18n(lang);
}

function initLang() {
  const saved = getSaved("lang", "en");
  applyLang(saved);

  document.getElementById("hdrLang")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-lang") || "en";
    applyLang(current === "en" ? "es" : "en");
  });
}

/* ---------------- INIT ---------------- */
initTheme();
initLang();
