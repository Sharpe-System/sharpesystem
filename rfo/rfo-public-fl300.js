/* /rfo/rfo-public-fl300.js
   Public FL-300 mapping + shared MC-030 overflow handling
   Canon: localStorage only, no auth, no Firebase
*/

(function () {
  "use strict";

  const KEY_FL300 = "ss_rfo_fl300_v1";
  const KEY_DECL  = "ss_rfo_decl_v1";
  const KEY_AUTO  = "ss_rfo_decl_auto_overflow_v1";

  function $(id) { return document.getElementById(id); }
  function s(v) { return String(v ?? ""); }
  function t(v) { return s(v).trim(); }
  function iso() { try { return new Date().toISOString(); } catch (_) { return ""; } }

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

    const calc = window.SS_RFO_OVERFLOW.computeMc030(decl, opts);

    $("mc030Text").value = calc.mc030Text;
    renderOverflowStatus(calc.overflow);

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

    persist();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
