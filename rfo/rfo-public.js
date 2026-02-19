/* /rfo/rfo-public.js
   Public RFO intake (localStorage only).
   Canon (public):
   - NO gate.js usage
   - NO Firebase imports
   - NO redirects for auth/tier
*/

(function () {
  "use strict";

  const KEY = "ss_rfo_public_v1";

  function $(id) { return document.getElementById(id); }

  function safeStr(v) { return String(v ?? "").trim(); }

  function nowISO() {
    try { return new Date().toISOString(); } catch (_) { return ""; }
  }

  function readForm() {
    return {
      version: 1,
      updatedAt: nowISO(),
      court: {
        county: safeStr($("county")?.value),
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
      },
      notes: {
        currentOrder: safeStr($("currentOrder")?.value),
        whatChanged: safeStr($("whatChanged")?.value),
        ordersSought: safeStr($("ordersSought")?.value),
      }
    };
  }

  function writeForm(data) {
    $("county").value = data?.court?.county || "Orange";
    $("caseNumber").value = data?.court?.caseNumber || "";
    $("petitionerName").value = data?.parties?.petitionerName || "";
    $("respondentName").value = data?.parties?.respondentName || "";
    $("primaryRequest").value = data?.request?.primary || "";
    $("urgency").value = data?.request?.urgency || "";
    $("oneSentence").value = data?.request?.oneSentence || "";
    $("currentOrder").value = data?.notes?.currentOrder || "";
    $("whatChanged").value = data?.notes?.whatChanged || "";
    $("ordersSought").value = data?.notes?.ordersSought || "";
  }

  function loadDraft() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function saveDraft() {
    const data = readForm();
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      toast("Saved (public draft)");
      return true;
    } catch (_) {
      alert("Unable to save. Your browser may be blocking storage or is full.");
      return false;
    }
  }

  function clearDraft() {
    const ok = confirm("Clear this public draft on this device?");
    if (!ok) return;
    try { localStorage.removeItem(KEY); } catch (_) {}
    writeForm(null);
    toast("Cleared");
  }

  function toast(msg) {
    // Minimal, dependency-free toast
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

  function initButtons() {
    $("btnSave")?.addEventListener("click", saveDraft);
    $("btnClear")?.addEventListener("click", clearDraft);

    $("btnSaveContinue")?.addEventListener("click", function () {
      const ok = saveDraft();
      if (!ok) return;
      // Next page (we'll build next): draft generator
      window.location.href = "/rfo/public-draft.html";
    });
  }

  function initResume() {
    const data = loadDraft();
    const wantsResume = (window.location.hash || "") === "#resume";
    if (data) {
      writeForm(data);
      if (wantsResume) toast("Resumed public draft");
    } else if (wantsResume) {
      toast("No saved draft found");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initButtons();
    initResume();
  });
})();
