/* /rfo/rfo-public-print.js
   Public print gate (localStorage only).
   Canon (public):
   - NO gate.js usage
   - NO Firebase imports
   - NO redirects for auth/tier
*/

(function () {
  "use strict";

  const KEY_INTAKE = "ss_rfo_public_v1";
  const KEY_DRAFT = "ss_rfo_public_draft_v1";
  const KEY_EXHIBITS = "ss_rfo_public_exhibits_v1";

  function $(id) { return document.getElementById(id); }
  function safeStr(v) { return String(v ?? "").trim(); }

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

  function alphaLabel(idx) {
    let n = idx;
    let s = "";
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }

  function buildExhibitIndex(exObj) {
    const items = Array.isArray(exObj?.items) ? exObj.items : [];
    let exhibitCount = 0;
    const lines = [];
    lines.push("EXHIBIT INDEX (PUBLIC DRAFT)");
    lines.push("");

    items.forEach((it) => {
      if (it?.kind === "divider") {
        const title = safeStr(it.title) || "Section";
        lines.push(title.toUpperCase());
        lines.push("-".repeat(Math.min(36, title.length)));
        return;
      }
      if (it?.kind === "exhibit") {
        const label = "Exhibit " + alphaLabel(exhibitCount);
        exhibitCount += 1;

        const title = safeStr(it.title) || "[Untitled]";
        const rel = safeStr(it.relevance);
        const date = safeStr(it.dateRange);
        const pages = safeStr(it.pages);

        const metaBits = [];
        if (it.type) metaBits.push(it.type);
        if (date) metaBits.push(date);
        if (pages) metaBits.push(pages + " pages");

        const meta = metaBits.length ? " (" + metaBits.join(" • ") + ")" : "";
        lines.push(label + ": " + title + meta);
        if (rel) lines.push("  - Relevance: " + rel);
        lines.push("");
      }
    });

    if (exhibitCount === 0) {
      lines.push("[No exhibits added yet]");
    }

    return lines.join("\n");
  }

  function setStatus(elId, ok, text) {
    const el = $(elId);
    if (!el) return;
    el.textContent = (ok ? "✅ " : "⚠️ ") + text;
  }

  function init() {
    const intake = loadJSON(KEY_INTAKE);
    const draft = loadJSON(KEY_DRAFT);
    const exhibits = loadJSON(KEY_EXHIBITS);

    const hasIntake = !!intake;
    const hasDraft = !!(draft && safeStr(draft.text));
    const hasExhibits = Array.isArray(exhibits?.items) && exhibits.items.length > 0;

    setStatus("statusIntake", hasIntake, hasIntake ? "Saved on this device" : "Missing — complete Public Intake");
    setStatus("statusDraft", hasDraft, hasDraft ? "Generated / saved" : "Missing — generate Public Draft");
    setStatus("statusExhibits", hasExhibits, hasExhibits ? "Organized (metadata)" : "Optional — add exhibits for support");

    const packetReady = hasIntake && hasDraft;
    setStatus("statusPacket", packetReady, packetReady ? "Ready for paid export/print" : "Incomplete — finish intake + draft");

    // Preview draft text (read-only)
    $("previewDraft").value = hasDraft ? draft.text : "";

    $("btnCopyDraft")?.addEventListener("click", async function () {
      const text = safeStr($("previewDraft")?.value);
      if (!text) { toast("No draft to copy"); return; }
      try {
        await navigator.clipboard.writeText(text);
        toast("Copied draft");
      } catch (_) {
        const ta = $("previewDraft");
        if (ta) { ta.focus(); ta.select(); toast("Select + copy"); }
      }
    });

    $("btnCopyExhibits")?.addEventListener("click", async function () {
      const idxText = buildExhibitIndex(exhibits);
      try {
        await navigator.clipboard.writeText(idxText);
        toast("Copied exhibit index");
      } catch (_) {
        alert(idxText);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
