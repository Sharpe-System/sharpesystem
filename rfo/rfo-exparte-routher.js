/* /rfo/rfo-exparte-router.js
   Ex Parte Router (Public)
   Canon: localStorage only; no auth/tier; no gate.js; no Firebase; single page owner.

   Requirement: One flow, many mappings, one packet.
   Router writes deterministic routing plan into ss_rfo_exparte_intake_v1.
*/

(function () {
  "use strict";

  const KEY_INTAKE = "ss_rfo_exparte_intake_v1";
  const KEY_NOTICE = "ss_rfo_exparte_notice_v1";

  function $(id) { return document.getElementById(id); }
  function s(v) { return String(v ?? "").trim(); }
  function nowISO() { try { return new Date().toISOString(); } catch (_) { return ""; } }

  function load(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function save(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
      return true;
    } catch (_) {
      alert("Unable to save locally. Storage may be blocked or full.");
      return false;
    }
  }

  function ensureIntake(existing) {
    const d = (existing && typeof existing === "object") ? existing : {};
    if (d.version !== 1) d.version = 1;
    if (!d.urgency || typeof d.urgency !== "object") d.urgency = {};
    if (!d.routing || typeof d.routing !== "object") d.routing = { required: {}, firstUrl: "" };
    if (!d.meta || typeof d.meta !== "object") d.meta = {};
    return d;
  }

  function isNoticeComplete(n) {
    if (!n || typeof n !== "object") return false;
    const given = s(n.noticeGiven);
    if (!given) return false;

    // Deterministic completion rule:
    // - If yes/attempted: require at least method OR when.
    // - If no: require whyNot.
    if (given === "yes" || given === "attempted") {
      return !!(s(n.noticeMethod) || s(n.noticeWhen));
    }
    if (given === "no") {
      return !!s(n.noticeWhyNot);
    }
    return false;
  }

  function computeRequired(intake, notice) {
    // Deterministic required set for ex parte packet.
    // Baseline always required: FL-300, FL-305, Notice, Proposed, Declaration
    // (You can later adjust based on local rules; keep deterministic defaults now.)

    const required = {
      fl300: true,
      fl305: true,
      notice: true,
      proposed: true,
      decl: true
    };

    // If the user self-identifies "not emergency", keep required set but hint pivot.
    const meets = s(intake?.urgency?.meetsStandard);
    const urgencyWhy = s(intake?.urgency?.why);
    const urgencyType = s(intake?.urgency?.type);

    const hints = [];
    if (meets === "no") hints.push("You selected: not emergency. Consider pivoting to standard RFO.");
    if (!urgencyType) hints.push("Urgency category is missing (go back to Start).");
    if (!urgencyWhy) hints.push("Urgency explanation is missing (go back to Start).");
    if (!isNoticeComplete(notice)) hints.push("Notice facts are incomplete (complete Notice page).");

    return { required, hints };
  }

  function firstRequiredUrl(required) {
    // Canon routing order for mappings (public):
    // notice already captured; next mapping should start with FL-300 then FL-305 then declaration then proposed.
    // These mapping pages will be created next.
    if (required.fl300) return "/rfo/exparte-fl300.html";
    if (required.fl305) return "/rfo/exparte-fl305.html";
    if (required.decl) return "/rfo/exparte-decl.html";
    if (required.proposed) return "/rfo/exparte-proposed.html";
    return "/rfo/exparte-public-print.html";
  }

  function renderList(required) {
    const ul = $("reqList");
    if (!ul) return;
    ul.innerHTML = "";

    const items = [
      ["fl300", "FL-300 mapping (Request for Order)"],
      ["fl305", "FL-305 mapping (Temporary Emergency Orders)"],
      ["notice", "Notice facts (already captured here)"],
      ["decl", "Declaration (MC-030)"],
      ["proposed", "Proposed order"]
    ];

    for (const [k, label] of items) {
      if (!required[k]) continue;
      const li = document.createElement("li");
      li.textContent = label;
      ul.appendChild(li);
    }
  }

  function renderHints(hints) {
    const el = $("hintText");
    if (!el) return;
    if (!hints || !hints.length) {
      el.textContent = "No blocking issues detected. Proceed to first required mapping.";
      return;
    }
    el.textContent = "Notes: " + hints.join(" ");
  }

  function recompute() {
    const intake = ensureIntake(load(KEY_INTAKE));
    const notice = load(KEY_NOTICE);

    const { required, hints } = computeRequired(intake, notice);
    const firstUrl = firstRequiredUrl(required);

    intake.updatedAt = nowISO();
    intake.routing.required = required;
    intake.routing.firstUrl = firstUrl;
    intake.meta.lastPage = "/rfo/exparte-router.html";

    save(KEY_INTAKE, intake);

    renderList(required);
    renderHints(hints);

    const a = $("btnStart");
    if (a) a.href = firstUrl;
  }

  function init() {
    recompute();
    $("btnRecalc")?.addEventListener("click", recompute);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
