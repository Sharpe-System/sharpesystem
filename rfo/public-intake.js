(function () {
  "use strict";

  const KEY = "ss:draft:rfo:v1";

  function $(id) { return document.getElementById(id); }

  function nowISO() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  function safeStr(v) { return String(v ?? "").trim(); }

  function readDraft() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : null;
    } catch (_) {
      return null;
    }
  }

  function writeDraft(draft) {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
      return true;
    } catch (_) {
      alert("Unable to save draft. Your browser may be blocking storage or is full.");
      return false;
    }
  }

  function buildDraftFromForm() {
    return {
      version: 1,
      updatedAt: nowISO(),
      rfo: {
        county: safeStr($("county")?.value),
        branch: safeStr($("branch")?.value),
        caseNumber: safeStr($("caseNumber")?.value),
        role: safeStr($("role")?.value),
        reqCustody: !!$("reqCustody")?.checked,
        reqSupport: !!$("reqSupport")?.checked,
        reqOther: !!$("reqOther")?.checked,
        requestDetails: safeStr($("requestDetails")?.value)
      }
    };
  }

  function hydrateFormFromDraft(draft) {
    const r = (draft && draft.rfo && typeof draft.rfo === "object") ? draft.rfo : {};

    if ($("county")) $("county").value = r.county || "";
    if ($("branch")) $("branch").value = r.branch || "";
    if ($("caseNumber")) $("caseNumber").value = r.caseNumber || "";
    if ($("role")) $("role").value = r.role || "";

    if ($("reqCustody")) $("reqCustody").checked = !!r.reqCustody;
    if ($("reqSupport")) $("reqSupport").checked = !!r.reqSupport;
    if ($("reqOther")) $("reqOther").checked = !!r.reqOther;

    if ($("requestDetails")) $("requestDetails").value = r.requestDetails || "";
  }

  function persist() {
    const draft = buildDraftFromForm();
    writeDraft(draft);
  }

  function clearDraft() {
    const ok = confirm("Clear the public draft saved on this device?");
    if (!ok) return;
    try { localStorage.removeItem(KEY); } catch (_) {}

    hydrateFormFromDraft({ rfo: {} });
    persist();
  }

  function init() {
    const existing = readDraft();
    if (existing) hydrateFormFromDraft(existing);

    const ids = [
      "county","branch","caseNumber","role",
      "reqCustody","reqSupport","reqOther",
      "requestDetails"
    ];

    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", persist);
      el.addEventListener("change", persist);
    });

    const btnClear = $("btnClear");
    if (btnClear) btnClear.addEventListener("click", clearDraft);

    persist();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
