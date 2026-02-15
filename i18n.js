// /i18n.js
// English default. Spanish optional. Re-applies after header partial inject.

(function () {
  const STORAGE_KEY = "sharpe_lang"; // "en" | "es"

  const dict = {
    en: {
      brand: "SharpeSystem",
      "nav.home": "Home",
      "nav.trees": "Decision Trees",
      "nav.status": "Status",
      "nav.attorneys": "For Attorneys",
      "nav.attorneyPortal": "Attorney Portal",
      "nav.risk": "Risk Awareness",
      "toggle.lang": "ES" // button shows what you can switch to
    },
    es: {
      brand: "SharpeSystem",
      "nav.home": "Inicio",
      "nav.trees": "Árboles de decisión",
      "nav.status": "Estado",
      "nav.attorneys": "Para abogados",
      "nav.attorneyPortal": "Portal de abogados",
      "nav.risk": "Conciencia de riesgo",
      "toggle.lang": "EN"
    }
  };

  function getLang() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === "es" ? "es" : "en";
    } catch (_) {
      return "en";
    }
  }

  function setLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
  }

  function applyLang(lang) {
    const map = dict[lang] || dict.en;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (map[key]) el.textContent = map[key];
    });

    document.documentElement.setAttribute("lang", lang);

    const btn = document.getElementById("langToggle");
    if (btn) btn.textContent = map["toggle.lang"];
  }

  function toggleLang() {
    const next = getLang() === "es" ? "en" : "es";
    setLang(next);
    applyLang(next);
  }

  // Works even if header is injected later
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.id === "langToggle") {
      e.preventDefault();
      toggleLang();
    }
  });

  // Apply now
  applyLang(getLang());

  // Re-apply when header.html is injected
  const obs = new MutationObserver(() => applyLang(getLang()));
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
