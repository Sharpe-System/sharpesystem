/* /rfo/rfo-public-fl300.js
   Public FL-300 mapper (localStorage only; text blocks only).
   Canon (public):
   - NO gate.js usage
   - NO Firebase imports
   - NO redirects for auth/tier
*/

(function () {
  "use strict";

  const KEY_INTAKE = "ss_rfo_public_v1";
  const KEY_DRAFT = "ss_rfo_public_draft_v1";
  const KEY_FL300 = "ss_rfo_public_fl300_v1";

  function $(id) { return document.getElementById(id); }
  function safeStr(v) { return String(v ?? "").trim(); }
  function nowISO() { try { return new Date().toISOString(); } catch (_) { return ""; } }

  function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "20px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,.85)";
    el.style.color = "#fff";
    el.style.fontSize = "14px";
    el.style.zIndex = "9999";
    el.style.maxWidth = "90vw";
    document.body.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 1200);
  }

  function loadJSON(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function saveJSON(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
      return true;
    } catch (_) {
      alert("Unable to save. Your browser may be blocking storage or is full.");
      return false;
    }
  }

  function readInputs() {
    return {
      court: {
        county: safeStr($("county")?.value) || "Orange",
        caseNumber: safeStr($("caseNumber")?.value),
      },
      parties: {
        petitionerName: safeStr($("petitionerName")?.value),
        respondentName: safeStr($("respondentName")?.value),
      },
      request: {
        primary: safeStr($("primaryRequest")?.value),
        urgency: safeStr($("urgency")?.value),
        oneSentence: safeStr($("oneSentence")?.value),
      }
    };
  }

  function writeInputs(data) {
    $("county").value = data?.court?.county || "Orange";
    $("caseNumber").value = data?.court?.caseNumber || "";
    $("petitionerName").value = data?.parties?.petitionerName || "";
    $("respondentName").value = data?.parties?.respondentName || "";
    $("primaryRequest").value = data?.request?.primary || "";
    $("urgency").value = data?.request?.urgency || "";
    $("oneSentence").value = data?.request?.oneSentence || "";
  }

  function labelPrimary(primary) {
    return primary === "custody_visitation" ? "custody and visitation" :
      primary === "support_child" ? "child support" :
      primary === "support_spousal" ? "spousal support" :
      primary === "orders_other" ? "other family-law orders" :
      "orders";
  }

  function labelUrgency(urg) {
    return urg === "time_sensitive" ? "time-sensitive" :
      urg === "safety" ? "safety-related" :
      "standard";
  }

  function buildFLOrders(inputs) {
    const primary = safeStr(inputs?.request?.primary);
    const oneSentence = safeStr(inputs?.request?.oneSentence);
    const urg = safeStr(inputs?.request?.urgency);

    const lines = [];
    lines.push(`I request the Court issue orders regarding ${labelPrimary(primary)}.`);

    if (oneSentence) {
      lines.push(oneSentence);
    } else {
      lines.push("I request clear, specific orders that are workable and enforceable.");
    }

    if (urg) lines.push(`This request is ${labelUrgency(urg)}.`);

    lines.push("See attached declaration (MC-030) and exhibit index for supporting facts.");

    // Keep compact for typical FL-300 fields:
    return lines.join(" ");
  }

  function buildFLWhy(inputs, declText) {
    const primary = safeStr(inputs?.request?.primary);
    const urg = safeStr(inputs?.request?.urgency);

    const whyBase =
      primary === "custody_visitation"
        ? "Current parenting time orders are not working as written in practice, and a specific schedule is needed."
        : primary === "support_child"
        ? "A change in circumstances supports guideline recalculation and clear payment terms."
        : primary === "support_spousal"
        ? "A change in circumstances supports review and appropriate adjustment of support."
        : "Current orders are not workable and require clarification/modification.";

    const urgencyNote =
      urg === "safety" ? "This request involves safety-related concerns." :
      urg === "time_sensitive" ? "This request is time-sensitive due to upcoming events/deadlines." :
      "";

    // Pull a tiny sentence from declaration if present, but do not overstuff.
    let declHint = "";
    const dt = safeStr(declText);
    if (dt) {
      const firstLine = dt.split("\n").find((x) => safeStr(x).length > 0) || "";
      if (firstLine && firstLine.length < 140) declHint = firstLine;
    }

    const parts = [whyBase];
    if (urgencyNote) parts.push(urgencyNote);
    if (declHint) parts.push("Summary: " + declHint);
    parts.push("Full facts are in the attached declaration (MC-030).");

    return parts.join(" ");
  }

  function buildAttachLine(caseNumber) {
    const cn = safeStr(caseNumber);
    if (cn) {
      return "See attached declaration (MC-030) and exhibit index in support of this request. Case No.: " + cn + ".";
    }
    return "See attached declaration (MC-030) and exhibit index in support of this request.";
  }

  async function copyText(text) {
    const t = safeStr(text);
    if (!t) { toast("Nothing to copy"); return; }
    try {
      await navigator.clipboard.writeText(t);
      toast("Copied");
    } catch (_) {
      toast("Clipboard blocked — select + copy");
    }
  }

  function regen() {
    const inputs = readInputs();
    const draft = loadJSON(KEY_DRAFT);
    const declText = safeStr(draft?.text);

    $("flOrders").value = buildFLOrders(inputs);
    $("flWhy").value = buildFLWhy(inputs, declText);
    $("flAttach").value = buildAttachLine(inputs?.court?.caseNumber);
    $("declText").value = declText || "";

    saveJSON(KEY_FL300, {
      version: 1,
      updatedAt: nowISO(),
      inputs,
      fl: {
        orders: $("flOrders").value,
        why: $("flWhy").value,
        attach: $("flAttach").value
      }
    });
  }

  function init() {
    // Prefer intake values, then prior FL-300 values.
    const intake = loadJSON(KEY_INTAKE);
    const prior = loadJSON(KEY_FL300);

    if (prior?.inputs) {
      writeInputs(prior.inputs);
    } else if (intake) {
      writeInputs({
        court: intake.court,
        parties: intake.parties,
        request: intake.request
      });
    }

    regen();

    $("btnRegen")?.addEventListener("click", regen);

    $("btnCopyOrders")?.addEventListener("click", () => copyText($("flOrders").value));
    $("btnCopyWhy")?.addEventListener("click", () => copyText($("flWhy").value));
    $("btnCopyAttach")?.addEventListener("click", () => copyText($("flAttach").value));
    $("btnCopyDecl")?.addEventListener("click", () => copyText($("declText").value));

    $("btnCopyAll")?.addEventListener("click", () => {
      const all = [
        "FL-300 COPY PACK",
        "",
        "ORDERS REQUESTED:",
        safeStr($("flOrders").value),
        "",
        "WHY SUMMARY:",
        safeStr($("flWhy").value),
        "",
        "ATTACHMENT LINE:",
        safeStr($("flAttach").value),
        "",
        "DECLARATION (MC-030 STYLE) TEXT:",
        safeStr($("declText").value)
      ].join("\n");
      copyText(all);
    });

    $("btnSave")?.addEventListener("click", () => {
      const inputs = readInputs();
      const ok = saveJSON(KEY_FL300, {
        version: 1,
        updatedAt: nowISO(),
        inputs,
        fl: {
          orders: safeStr($("flOrders").value),
          why: safeStr($("flWhy").value),
          attach: safeStr($("flAttach").value)
        }
      });
      if (ok) toast("Saved");
    });

    // Regenerate on key changes
    ["county", "caseNumber", "petitionerName", "respondentName", "primaryRequest", "urgency", "oneSentence"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", regen);
      el.addEventListener("input", () => {
        // light debounce via rAF
        if (el.__ss_rfo_tick) return;
        el.__ss_rfo_tick = true;
        requestAnimationFrame(() => {
          el.__ss_rfo_tick = false;
          regen();
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
