// i18n.js — simple EN/ES text swap for static pages.
// Opt-in: add data-i18n="key" to elements you want translated.
// Persists in localStorage.

(function () {
  const STORAGE_KEY = "sharpe_lang"; // "en" | "es"

  const dict = {
    en: {
      "brand": "SharpeSystem",
      "nav.home": "Home",
      "nav.trees": "Decision Trees",
      "nav.status": "Status",
      "nav.attorneys": "For Attorneys",
      "nav.risk": "Risk Awareness",
    },
    es: {
      "brand": "SharpeSystem",
      "nav.home": "Inicio",
      "nav.trees": "Árboles de decisión",
      "nav.status": "Estado",
      "nav.attorneys": "Para abogados",
      "nav.risk": "Conciencia de riesgo",
    }
  };

  function getLang() {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "es" ? "es" : "en";
  }

  function setLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
  }

  function applyLang(lang) {
    const map = dict[lang] || dict.en;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const text = map[key];
      if (typeof text === "string") el.textContent = text;
    });

    // Button label: show the *other* language as the action
    const btn = document.getElementById("langToggle");
    if (btn) btn.textContent = (lang === "es") ? "EN" : "ES";

    // Optional: set lang attribute for accessibility
    document.documentElement.setAttribute("lang", lang);
  }

  function toggleLang() {
    const current = getLang();
    const next = current === "es" ? "en" : "es";
    setLang(next);
    applyLang(next);
  }

  // Apply on load
  applyLang(getLang());

  // Click handler (safe if button isn't present)
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.id === "langToggle") {
      e.preventDefault();
      toggleLang();
    }
  });
})();
