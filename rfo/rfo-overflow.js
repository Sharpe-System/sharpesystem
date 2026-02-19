/* /rfo/rfo-overflow.js
   Shared overflow + attachment utility (PUBLIC)
   Canon: localStorage-only, no Firebase, no redirects

   Purpose:
   - Detect when declaration text will not fit MC-030 style boxes
   - Generate MC-030-safe text (summary + "See attached pleading paper")
   - Auto-write pleading paper payload into ss_pleading_paper_v1
*/

(function () {
  "use strict";

  const DEFAULTS = {
    thresholdChars: 900,
    pleadingKey: "ss_pleading_paper_v1",
    // Conservative: if missing, we still write a usable pleading paper attachment.
    pleadingDefaults: {
      docTitle: "DECLARATION (ATTACHMENT)",
      court: "SUPERIOR COURT OF CALIFORNIA, COUNTY OF ORANGE",
      caseName: "",
      caseNumber: ""
    }
  };

  function s(v) { return String(v ?? ""); }
  function t(v) { return s(v).trim(); }

  function loadJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch (_) { return null; }
  }

  function saveJson(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  // Collapse giant text into a short MC-030 summary (bullet-ish)
  function summarizeForMc030(payload) {
    const out = [];
    const relief = t(payload.relief);
    const necessity = t(payload.necessity);
    const recent = t(payload.recent);
    const facts = t(payload.facts);

    if (relief) out.push("• Relief requested: " + relief);
    if (necessity) out.push("• Necessity: " + necessity);
    if (recent) out.push("• Recent incident(s): " + recent);
    if (facts) out.push("• Background: " + facts);

    return out.slice(0, 4).join("\n").trim();
  }

  // Compose long-form attachment text (pleading paper body)
  function composeLong(payload) {
    const parts = [];
    if (t(payload.facts)) parts.push("FACTS:\n" + t(payload.facts));
    if (t(payload.recent)) parts.push("RECENT INCIDENTS:\n" + t(payload.recent));
    if (t(payload.necessity)) parts.push("NECESSITY:\n" + t(payload.necessity));
    if (t(payload.relief)) parts.push("REQUESTED RELIEF:\n" + t(payload.relief));
    return parts.join("\n\n").trim();
  }

  function shouldOverflow(longText, thresholdChars) {
    return s(longText).length > Number(thresholdChars || DEFAULTS.thresholdChars);
  }

  // Writes/overwrites ss_pleading_paper_v1 with the long text
  function writePleadingPaper(longText, opts) {
    const pleadingKey = opts?.pleadingKey || DEFAULTS.pleadingKey;
    const existing = loadJson(pleadingKey) || {};
    const d = opts?.pleadingDefaults || DEFAULTS.pleadingDefaults;

    const payload = {
      docTitle: existing.docTitle || d.docTitle,
      court: existing.court || d.court,
      caseName: existing.caseName || d.caseName,
      caseNumber: existing.caseNumber || d.caseNumber,
      body: s(longText)
    };

    saveJson(pleadingKey, payload);
    return { pleadingKey, writtenAt: nowIso() };
  }

  // Main function: returns { mc030Text, overflow, longText }
  function computeMc030(payload, opts) {
    const thresholdChars = Number(opts?.thresholdChars || DEFAULTS.thresholdChars);
    const longText = composeLong(payload);
    const overflowed = shouldOverflow(longText, thresholdChars);

    if (!overflowed) {
      return {
        mc030Text: longText,
        longText,
        overflow: {
          triggered: false,
          thresholdChars,
          longChars: longText.length,
          pleadingKey: null
        }
      };
    }

    const short = summarizeForMc030(payload);
    const mc030Text = (short ? short + "\n\n" : "") + "Please see attached pleading paper declaration for full details.";

    let wrote = null;
    if (opts?.autoAttach !== false) {
      wrote = writePleadingPaper(longText, opts);
    }

    return {
      mc030Text: mc030Text.trim(),
      longText,
      overflow: {
        triggered: true,
        thresholdChars,
        longChars: longText.length,
        pleadingKey: wrote?.pleadingKey || (opts?.pleadingKey || DEFAULTS.pleadingKey)
      }
    };
  }

  // Expose globally for other PUBLIC scripts
  window.SS_RFO_OVERFLOW = {
    computeMc030,
    composeLong,
    summarizeForMc030,
    shouldOverflow,
    writePleadingPaper
  };
})();
