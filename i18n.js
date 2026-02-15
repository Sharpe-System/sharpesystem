// /i18n.js
// English default. Spanish optional.
// Re-applies once after header partial injection.

(function () {
  const STORAGE_KEY = "sharpe_lang"; // "en" | "es"
  const HEADER_EVENT = "sharpe:header:loaded";

  const dict = {
    en: {
      brand: "SharpeSystem",
      "nav.home": "Home",
      "nav.trees": "Decision Trees",
      "nav.status": "Status",
      "nav.attorneys": "For Attorneys",
      "nav.attorneyPortal": "Attorney Portal",
      "nav.risk": "Risk Awareness",
      "toggle.lang": "ES"
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

  // Click handler (works even if header injected later)
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.id === "langToggle") {
      e.preventDefault();
      toggleLang();
    }
  });

  // Apply now
  applyLang(getLang());

  // Re-apply once after header injection
  let reapplied = false;
  document.addEventListener(HEADER_EVENT, () => {
    if (reapplied) return;
    reapplied = true;
    applyLang(getLang());
  });
})();
