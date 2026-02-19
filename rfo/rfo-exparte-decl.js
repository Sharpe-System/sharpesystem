/* /rfo/rfo-exparte-decl.js
   Ex Parte MC-030 Declaration (Public)
   Canon: localStorage only, no auth, no Firebase, single module

   Adds:
   - MC-030 overflow trigger -> auto-attach pleading paper
   - Writes attachment into ss_pleading_paper_v1
*/

(function () {
  "use strict";

  const KEY = "ss_rfo_exparte_decl_v1";
  const INTAKE = "ss_rfo_exparte_intake_v1";
  const FL300 = "ss_rfo_exparte_fl300_v1";
  const FL305 = "ss_rfo_exparte_fl305_v1";
  const NOTICE = "ss_rfo_exparte_notice_v1";

  const PLEAD_KEY = "ss_pleading_paper_v1";
  const AUTO_KEY = "ss_rfo_exparte_decl_auto_overflow_v1";

  // Conservative threshold: MC-030 practical space varies; we trigger on character count.
  const OVERFLOW_CHAR_THRESHOLD = 900; // adjust later after real PDF field sizing tests

  function $(id) { return document.getElementById(id); }
  function s(v) { return String(v ?? ""); }
  function t(v) { return s(v).trim(); }
  function iso() { try { return new Date().toISOString(); } catch (_) { return ""; } }

  function load(k) {
    try { return JSON.parse(localStorage.getItem(k) || "null"); }
    catch (_) { return null; }
  }

  function store(k, v) {
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

  function composeLong(d) {
    const parts = [];
    if (d.facts) parts.push("FACTS:\n" + d.facts);
    if (d.recent) parts.push("RECENT INCIDENTS:\n" + d.recent);
    if (d.necessity) parts.push("NECESSITY:\n" + d.necessity);
    if (d.relief) parts.push("REQUESTED RELIEF:\n" + d.relief);
    return parts.join("\n\n").trim();
  }

  function composeShort(d) {
    // Tight summary: 4 bullets max, then attachment reference
    const bullets = [];
    if (d.relief) bullets.push("• Relief requested: " + d.relief);
    if (d.necessity) bullets.push("• Necessity: " + d.necessity);
    if (d.recent) bullets.push("• Recent incident(s): " + d.recent);
    if (d.facts) bullets.push("• Background: " + d.facts);

    const trimmed = bullets.slice(0, 4).join("\n");
    return trimmed.trim();
  }

  function shouldOverflow(longText, autoEnabled) {
    if (!autoEnabled) return false;
    return longText.length > OVERFLOW_CHAR_THRESHOLD;
  }

  function writePleadingPaper(longText) {
    // Minimal, user-editable pleading paper payload
    const existing = load(PLEAD_KEY) || {};
    const payload = {
      docTitle: existing.docTitle || "DECLARATION (ATTACHMENT)",
      court: existing.court || "SUPERIOR COURT OF CALIFORNIA, COUNTY OF ORANGE",
      caseName: existing.caseName || "",
      caseNumber: existing.caseNumber || "",
      body: longText
    };
    store(PLEAD_KEY, payload);
  }

  function computeMc030(d, overflowed) {
    if (!overflowed) {
      // If not overflow, MC-030 text = compact but complete-ish (still shorter than source)
      const merged = composeLong(d);
      return merged;
    }

    const short = composeShort(d);
    const tail = "\n\nPlease see attached pleading paper declaration for full details.";
    const out = (short ? short : "Please see attached pleading paper declaration for full details.") + tail;
    return out.trim();
  }

  function renderOverflowUI(overflowed) {
    const el = $("overflowStatus");
    if (!el) return;
    el.textContent = overflowed
      ? "Overflow triggered → pleading paper auto-attached (ss_pleading_paper_v1)."
      : "No overflow → MC-030 text kept inline (no attachment required).";
    el.style.color = overflowed ? "#a60" : "#0a0";
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
    store(AUTO_KEY, { enabled: autoEnabled, updatedAt: iso() });

    const src = readSource();
    const longText = composeLong(src);
    const overflowed = shouldOverflow(longText, autoEnabled);

    if (overflowed) {
      writePleadingPaper(longText);
    }

    const mc030Text = computeMc030(src, overflowed);
    $("mc030Text").value = mc030Text;

    const out = {
      ...src,
      mc030Text,
      overflow: {
        enabled: autoEnabled,
        triggered: overflowed,
        thresholdChars: OVERFLOW_CHAR_THRESHOLD,
        longChars: longText.length,
        pleadingKey: overflowed ? PLEAD_KEY : null
      },
      version: 2,
      updatedAt: iso()
    };

    store(KEY, out);
    renderOverflowUI(overflowed);
  }

  function init() {
    // restore saved declaration
    const saved = load(KEY);
    if (saved) writeSource(saved);

    // restore overflow toggle
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
