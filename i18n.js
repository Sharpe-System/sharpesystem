// i18n.js — simple EN/ES swap for static pages
// Opt-in: add data-i18n="key" to elements you want translated.
// Persists in localStorage.
// Durable: re-applies after header partial injection (MutationObserver).

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
      "toggle.lang": "ES" // button shows the *other* language
    },
    es: {
      "brand": "SharpeSystem",
      "nav.home": "Inicio",
      "nav.trees": "Árboles de decisión",
      "nav.status": "Estado",
      "nav.attorneys": "Para abogados",
      "nav.risk": "Conciencia de riesgo",
      "toggle.lang": "EN"
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

    // Translate any element that opts-in with data-i18n
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const text = map[key];
      if (typeof text === "string") el.textContent = text;
    });

    // Set <html lang=".."> for accessibility
    document.documentElement.setAttribute("lang", lang);

    // Keep toggle label correct if it exists
    const btn = document.getElementById("langToggle");
    if (btn) btn.textContent = map["toggle.lang"] || (lang === "es" ? "EN" : "ES");
  }

  function toggleLang() {
    const next = getLang() === "es" ? "en" : "es";
    setLang(next);
    applyLang(next);
  }

  // Click handler (works even if header is injected later)
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.id === "langToggle") {
      e.preventDefault();
      toggleLang();
    }
  });

  // Apply immediately
  applyLang(getLang());

  // Re-apply if the DOM changes (ex: header partial injected)
  const obs = new MutationObserver(() => {
    applyLang(getLang());
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
