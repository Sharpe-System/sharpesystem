/* /rfo/rfo-exparte-decl.js
   Ex Parte MC-030 Declaration (Public) — now uses /rfo/rfo-overflow.js
   Canon: localStorage only, no auth, no Firebase, single module
*/

(function () {
  "use strict";

  const KEY = "ss_rfo_exparte_decl_v1";
  const AUTO_KEY = "ss_rfo_exparte_decl_auto_overflow_v1";

  const INTAKE = "ss_rfo_exparte_intake_v1";
  const FL300 = "ss_rfo_exparte_fl300_v1";
  const FL305 = "ss_rfo_exparte_fl305_v1";
  const NOTICE = "ss_rfo_exparte_notice_v1";

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

  function readSource() {
    return {
      facts: t($("facts").value),
      recent: t($("recent").value),
      necessity: t($("necessity").value),
      relief: t($("relief").value)
    };
  }

  function writeSource(d) {
    if (!d) return;
    $("facts").value = d.facts || "";
    $("recent").value = d.recent || "";
    $("necessity").value = d.necessity || "";
    $("relief").value = d.relief || "";
  }

  function renderOverflowUI(overflow) {
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

  function previewContext() {
    const i = load(INTAKE) || {};
    const f300 = load(FL300) || {};
    const f305 = load(FL305) || {};
    const n = load(NOTICE) || {};

    $("urgencyPreview").textContent = (i.urgency?.type || "") + " — " + (i.urgency?.why || "");
    $("fl300Preview").textContent = (f300.ordersRequested || "") + " " + (f300.harmIfDelayed || "");
    $("fl305Preview").textContent = (f305.orders || "") + " " + (f305.necessity || "");
    $("noticePreview").textContent = (n.noticeGiven || "") + " " + (n.noticeMethod || "") + " " + (n.noticeWhen || "");
  }

  function persist() {
    const autoEnabled = !!$("autoOverflow")?.checked;
    save(AUTO_KEY, { enabled: autoEnabled, updatedAt: iso() });

    const src = readSource();

    const calc = window.SS_RFO_OVERFLOW.computeMc030(src, {
      autoAttach: autoEnabled,
      thresholdChars: 900,
      pleadingDefaults: {
        docTitle: "DECLARATION (EX PARTE ATTACHMENT)",
        court: "SUPERIOR COURT OF CALIFORNIA, COUNTY OF ORANGE",
        caseName: "",
        caseNumber: ""
      }
    });

    $("mc030Text").value = calc.mc030Text;
    renderOverflowUI(calc.overflow);

    save(KEY, {
      ...src,
      mc030Text: calc.mc030Text,
      overflow: {
        enabled: autoEnabled,
        ...calc.overflow
      },
      version: 3,
      updatedAt: iso()
    });
  }

  function init() {
    const saved = load(KEY);
    if (saved) writeSource(saved);

    const auto = load(AUTO_KEY);
    $("autoOverflow").checked = auto?.enabled !== false; // default true

    previewContext();
    persist();

    ["facts", "recent", "necessity", "relief"].forEach((id) => {
      const el = $(id);
      el.addEventListener("input", persist);
      el.addEventListener("change", persist);
    });

    $("autoOverflow").addEventListener("change", persist);
    $("btnSave").addEventListener("click", persist);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
