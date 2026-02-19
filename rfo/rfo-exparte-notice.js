/* /rfo/rfo-exparte-notice.js
   Ex Parte Notice (Public)
   Canon: localStorage only; no auth/tier; no gate.js; no Firebase; single page owner.
*/

(function () {
  "use strict";

  const KEY = "ss_rfo_exparte_notice_v1";

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

  function readForm() {
    return {
      noticeGiven: s($("noticeGiven")?.value),
      noticeMethod: s($("noticeMethod")?.value),
      noticeWhen: s($("noticeWhen")?.value),
      noticeResult: s($("noticeResult")?.value),
      noticeWhyNot: s($("noticeWhyNot")?.value),
    };
  }

  function writeForm(x) {
    if (!x) return;
    if ($("noticeGiven")) $("noticeGiven").value = x.noticeGiven || "";
    if ($("noticeMethod")) $("noticeMethod").value = x.noticeMethod || "";
    if ($("noticeWhen")) $("noticeWhen").value = x.noticeWhen || "";
    if ($("noticeResult")) $("noticeResult").value = x.noticeResult || "";
    if ($("noticeWhyNot")) $("noticeWhyNot").value = x.noticeWhyNot || "";
  }

  function persist() {
    const prior = load();
    const base = (prior && typeof prior === "object") ? prior : {};
    const x = readForm();

    const out = {
      version: 1,
      updatedAt: nowISO(),
      noticeGiven: x.noticeGiven,
      noticeMethod: x.noticeMethod,
      noticeWhen: x.noticeWhen,
      noticeResult: x.noticeResult,
      noticeWhyNot: x.noticeWhyNot
    };

    save(out);
  }

  function init() {
    const prior = load();
    writeForm(prior);

    persist();

    $("btnSave")?.addEventListener("click", () => {
      persist();
      toast("Saved");
    });

    ["noticeGiven", "noticeMethod", "noticeWhen", "noticeResult", "noticeWhyNot"].forEach((id) => {
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
