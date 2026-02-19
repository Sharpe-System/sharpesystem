/* /rfo/rfo-exparte-start.js
   Ex Parte Start (Public)
   Canon: localStorage only; no auth/tier; no gate.js; no Firebase; single page owner.
*/

(function () {
  "use strict";

  const KEY = "ss_rfo_exparte_intake_v1";

  function $(id) { return document.getElementById(id); }
  function s(v) { return String(v ?? "").trim(); }
  function nowISO() { try { return new Date().toISOString(); } catch (_) { return ""; } }

  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function save(obj) {
    try {
      localStorage.setItem(KEY, JSON.stringify(obj));
      return true;
    } catch (_) {
      alert("Unable to save locally. Storage may be blocked or full.");
      return false;
    }
  }

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
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 1100);
  }

  function ensureShape(existing) {
    const d = (existing && typeof existing === "object") ? existing : {};
    if (d.version !== 1) d.version = 1;
    if (!d.urgency || typeof d.urgency !== "object") d.urgency = {};
    if (!d.notice || typeof d.notice !== "object") d.notice = {}; // notice slice lives in separate key, but keep placeholder
    if (!d.routing || typeof d.routing !== "object") d.routing = { required: {}, firstUrl: "" };
    if (!d.meta || typeof d.meta !== "object") d.meta = {};
    return d;
  }

  function readForm() {
    return {
      urgencyType: s($("urgencyType")?.value),
      urgencyWhy: s($("urgencyWhy")?.value),
    };
  }

  function writeForm(x) {
    if (!x) return;
    if ($("urgencyType")) $("urgencyType").value = x.urgencyType || "";
    if ($("urgencyWhy")) $("urgencyWhy").value = x.urgencyWhy || "";
  }

  function persist() {
    const prior = ensureShape(load());
    const x = readForm();

    prior.updatedAt = nowISO();
    prior.urgency.type = x.urgencyType;
    prior.urgency.why = x.urgencyWhy;

    // Do not set meetsStandard here; explain page owns that decision checkpoint.
    // Router will compute required forms later.
    prior.meta.lastPage = "/rfo/exparte-start.html";

    save(prior);
  }

  function init() {
    const prior = load();
    const shaped = ensureShape(prior);
    writeForm({
      urgencyType: shaped?.urgency?.type,
      urgencyWhy: shaped?.urgency?.why,
    });

    persist();

    $("btnSave")?.addEventListener("click", () => {
      persist();
      toast("Saved");
    });

    ["urgencyType", "urgencyWhy"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", persist);
      el.addEventListener("input", () => {
        if (el.__ss_tick) return;
        el.__ss_tick = true;
        requestAnimationFrame(() => {
          el.__ss_tick = false;
          persist();
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
