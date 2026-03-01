/* /rfo/rfo-public-fl300.js
   Public FL-300 mapping + shared MC-030 overflow handling
   Canon: localStorage only, no auth, no Firebase
*/

(function () {
  "use strict";

  async function mountFieldAssist() {
    try {
      const mod = await import("/core/assist/assist.js");
      const root = document.querySelector("main") || document.body;

      mod.mountAssist(root, {
        flow: "rfo",
        stage: "fl300",
        jurisdiction: "CA",
        getAnswers: () => ({ ...readCore(), ...readDecl() })
      });

      root.addEventListener("click", (e) => {
        const applyBtn = root.querySelector('[data-field="fl300.ordersRequested"][data-apply-to="ordersRequested"]');
        if (!applyBtn) return;

        const panel = root.querySelector("#ss_assist_fl300\.ordersRequested");
        if (!panel) return;

        const card = e.target && e.target.closest ? e.target.closest("#ss_assist_fl300\.ordersRequested .ss-card") : null;
        if (!card) return;

        const txtEl = $("ordersRequested");
        if (!txtEl) return;

        const t = (card.textContent || "").trim();
        if (!t) return;

        txtEl.value = t;
        persist();
      });
    } catch (_) {}
  }


  const KEY_FL300 = "ss_rfo_fl300_v1";
  const KEY_DECL  = "ss_rfo_decl_v1";
  const KEY_PUB_FL300 = "ss_rfo_public_fl300_v1";
  const KEY_PUB_DRAFT = "ss_rfo_public_draft_v1";
  const KEY_AUTO  = "ss_rfo_decl_auto_overflow_v1";

  function $(id) { return document.getElementById(id); }
  function s(v) { return String(v ?? ""); }
  function t(v) { return s(v).trim(); }
  function iso() { try { return new Date().toISOString(); } catch (_) { return ""; } }


  function buildPublicDraft(core, decl) {
    const parts = [];
    if (core) {
      if (core.ordersRequested) parts.push("ORDERS REQUESTED\n" + s(core.ordersRequested));
      if (core.whyNeeded) parts.push("WHY NEEDED\n" + s(core.whyNeeded));
    }
    if (decl) {
      if (decl.facts) parts.push("FACTS\n" + s(decl.facts));
      if (decl.recent) parts.push("RECENT\n" + s(decl.recent));
      if (decl.necessity) parts.push("NECESSITY\n" + s(decl.necessity));
      if (decl.relief) parts.push("RELIEF\n" + s(decl.relief));
    }
    return parts.join("\n\n").trim();
  }


  function load(k) {
    try { return JSON.parse(localStorage.getItem(k) || "null"); }
    catch (_) { return null; }
  }

  function save(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  }

  function readCore() {
    return {
      caseNumber: t($("caseNumber").value),
      county: t($("county").value),
      petitioner: t($("petitioner").value),
      respondent: t($("respondent").value),
      ordersRequested: t($("ordersRequested").value),
      whyNeeded: t($("whyNeeded").value)
    };
  }

  function writeCore(d) {
    if (!d) return;
    $("caseNumber").value = d.caseNumber || "";
    $("county").value = d.county || "";
    $("petitioner").value = d.petitioner || "";
    $("respondent").value = d.respondent || "";
    $("ordersRequested").value = d.ordersRequested || "";
    $("whyNeeded").value = d.whyNeeded || "";
  }

  function readDecl() {
    return {
      facts: t($("facts").value),
      recent: t($("recent").value),
      necessity: t($("necessity").value),
      relief: t($("relief").value)
    };
  }

  function writeDecl(d) {
    if (!d) return;
    $("facts").value = d.facts || "";
    $("recent").value = d.recent || "";
    $("necessity").value = d.necessity || "";
    $("relief").value = d.relief || "";
  }

  function renderOverflowStatus(overflow) {
    const el = $("overflowStatus");
    if (!el) return;

    if (!overflow?.triggered) {
      el.textContent = "No overflow → MC-030 text kept inline (no attachment required).";
      el.style.color = "#0a0";
      return;
    }

    el.textContent = "Overflow triggered → pleading paper auto-attached (ss_pleading_paper_v1).";
    el.style.color = "#a60";
  }

  function persist() {
    const autoEnabled = !!$("autoOverflow")?.checked;
    save(KEY_AUTO, { enabled: autoEnabled, updatedAt: iso() });

    const core = readCore();
    const decl = readDecl();

    // Build MC-030 output using shared util
    const opts = {
      autoAttach: autoEnabled,
      // Optional: you can tighten this once you test actual PDFs
      thresholdChars: 900,
      pleadingDefaults: {
        docTitle: "DECLARATION (ATTACHMENT)",
        court: core.county ? `SUPERIOR COURT OF CALIFORNIA, COUNTY OF ${core.county.toUpperCase()}` : "SUPERIOR COURT OF CALIFORNIA",
        caseName: core.petitioner && core.respondent
          ? `In re: ${core.petitioner} (Petitioner) and ${core.respondent} (Respondent)`
          : "",
        caseNumber: core.caseNumber || ""
      }
    };

    let calc = { mc030Text: "", overflow: { triggered: false } };
    try {
      if (window.SS_RFO_OVERFLOW && typeof window.SS_RFO_OVERFLOW.computeMc030 === "function") {
        calc = window.SS_RFO_OVERFLOW.computeMc030(decl, opts);
      }
    } catch (_) {
      calc = { mc030Text: "", overflow: { triggered: false } };
    }

    $("mc030Text").value = (calc && calc.mc030Text) ? calc.mc030Text : "";
    renderOverflowStatus(calc && calc.overflow ? calc.overflow : { triggered: false });

    // Persist FL-300 slice
    save(KEY_FL300, {
      ...core,
      version: 1,
      updatedAt: iso()
    });

    // Persist declaration slice (with computed mc030Text + overflow metadata)
    save(KEY_DECL, {
      ...decl,
      mc030Text: calc.mc030Text,
      overflow: calc.overflow,
      version: 2,
      updatedAt: iso()
    });

    // Public twin contract (used by rfo-public-print.js)
    try {
      save(KEY_PUB_FL300, {
        ...core,
        version: 1,
        updatedAt: iso()
      });

      const preview = buildPublicDraft(core, decl);
      save(KEY_PUB_DRAFT, {
        text: preview,
        version: 1,
        updatedAt: iso()
      });
    } catch (_) {}
  }

  function init() {
    // restore
    const f = load(KEY_FL300);
    if (f) writeCore(f);

    const d = load(KEY_DECL);
    if (d) writeDecl(d);

    const auto = load(KEY_AUTO);
    $("autoOverflow").checked = auto?.enabled !== false; // default true

    // listeners
    [
      "caseNumber","county","petitioner","respondent",
      "ordersRequested","whyNeeded",
      "facts","recent","necessity","relief"
    ].forEach((id) => {
      const el = $(id);
      el.addEventListener("input", persist);
      el.addEventListener("change", persist);
    });

    $("autoOverflow").addEventListener("change", persist);
    $("btnSave").addEventListener("click", persist);

    mountFieldAssist();
    persist();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
