(function () {
  "use strict";

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function setStatus(msg) {
    const el = $("#status");
    if (el) el.textContent = msg;
  }

  function setDebug(objOrText) {
    const el = $("#debug");
    if (!el) return;
    el.textContent =
      typeof objOrText === "string" ? objOrText : JSON.stringify(objOrText, null, 2);
  }

  function getDraftPayload() {
    // Try a few likely keys. If none exist, send empty payload.
    const keys = [
      "rfoDraft",
      "ss_rfo_draft",
      "ss:rfo",
      "sharpesystem:rfo",
      "flow:rfo",
      "draft:rfo",
    ];

    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        return parsed;
      } catch (_) {
        // ignore
      }
    }

    return {};
  }

  async function generatePdf() {
    setStatus("Generating PDF...");
    setDebug("");

    const payload = getDraftPayload();

    let res;
    try {
      res = await fetch("/api/render/fl300", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      setStatus("Network error");
      setDebug(String(e?.message || e));
      return;
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();

    if (!res.ok) {
      // likely JSON error
      let txt = "";
      try {
        txt = await res.text();
      } catch (_) {}
      setStatus("Server error");
      setDebug(txt || ("HTTP " + res.status));
      return;
    }

    if (ct.includes("application/pdf")) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Open in a new tab (best for PDFs)
      window.open(url, "_blank", "noopener,noreferrer");
      setStatus("PDF generated.");
      return;
    }

    // unexpected: maybe JSON ok
    const text = await res.text();
    setStatus("Unexpected response (not PDF).");
    setDebug(text);
  }

  function ensureUi() {
    // If the HTML already has a button, use it. Otherwise create one.
    let btn = $("#btn-generate");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "btn-generate";
      btn.type = "button";
      btn.textContent = "Generate FL-300 PDF";
      btn.style.padding = "10px 14px";
      btn.style.fontSize = "16px";
      btn.style.cursor = "pointer";
      const mount = $("#mount") || document.body;
      mount.prepend(btn);
    }

    if (!$("#status")) {
      const s = document.createElement("div");
      s.id = "status";
      s.style.marginTop = "12px";
      s.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
      s.style.whiteSpace = "pre-wrap";
      const mount = $("#mount") || document.body;
      mount.insertBefore(s, btn.nextSibling);
    }

    if (!$("#debug")) {
      const d = document.createElement("pre");
      d.id = "debug";
      d.style.marginTop = "12px";
      d.style.padding = "12px";
      d.style.border = "1px solid #ddd";
      d.style.borderRadius = "8px";
      d.style.overflow = "auto";
      d.style.maxHeight = "40vh";
      const mount = $("#mount") || document.body;
      mount.appendChild(d);
    }

    btn.addEventListener("click", generatePdf);
  }

  document.addEventListener("DOMContentLoaded", ensureUi);
})();
