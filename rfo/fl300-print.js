// rfo/fl300-print.js
(function () {
  "use strict";

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function readLocalDraft() {
    try {
      const raw = localStorage.getItem("ss:draft:rfo");
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : null;
    } catch (_) {
      return null;
    }
  }

  function setDebug(obj) {
    const pre = $("#debugOut");
    if (!pre) return;
    pre.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function setStatus(s) {
    const el = $("#pdfStatus");
    if (el) el.textContent = String(s || "");
  }

  function setPreview(url) {
    const iframe = $("#pdfPreview");
    if (iframe) iframe.src = url || "";
  }

  function setDownload(blobUrl) {
    const a = $("#btnDownload");
    if (!a) return;
    if (!blobUrl) {
      a.setAttribute("href", "#");
      a.setAttribute("aria-disabled", "true");
      a.classList.add("disabled");
      return;
    }
    a.classList.remove("disabled");
    a.removeAttribute("aria-disabled");
    a.setAttribute("href", blobUrl);
    a.setAttribute("download", "FL-300-filled.pdf");
  }

  async function generateFilledPdf() {
    const btn = $("#btnGen");
    if (btn) btn.disabled = true;

    try {
      setStatus("Generating…");

      const draft = readLocalDraft() || {};
      const res = await fetch("/api/render/fl300", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setStatus("Failed");
        setDebug({ ok: false, status: res.status, body: txt.slice(0, 4000) });
        return;
      }

      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      setPreview(blobUrl);
      setDownload(blobUrl);
      setStatus("Generated");

      const dbgHeader = res.headers.get("x-sharpesystem-debug");
      if (dbgHeader) {
        try {
          setDebug(JSON.parse(decodeURIComponent(dbgHeader)));
        } catch (_) {
          setDebug({ note: "debug header present (could not parse)" });
        }
      } else {
        setDebug({ ok: true, note: "PDF returned (no debug header)." });
      }
    } catch (e) {
      setStatus("Failed");
      setDebug({ ok: false, error: String(e?.message || e) });
    } finally {
      const btn = $("#btnGen");
      if (btn) btn.disabled = false;
    }
  }

  function hydratePanel() {
    const draft = readLocalDraft() || {};
    const r = draft.rfo || {};

    const list = $("#inputList");
    if (!list) return;

    list.innerHTML = `
      <div><strong>Loaded from:</strong> localStorage:ss:draft:rfo</div>
      <div style="margin-top:10px; line-height:1.35;">
        <div><strong>County</strong>: ${esc(r.county || "—")}</div>
        <div><strong>Branch</strong>: ${esc(r.branch || "—")}</div>
        <div><strong>Case #</strong>: ${esc(r.caseNumber || "—")}</div>
        <div><strong>Role</strong>: ${esc(r.role || "—")}</div>
        <div><strong>Custody</strong>: ${r.reqCustody ? "Yes" : "No"}</div>
        <div><strong>Support</strong>: ${r.reqSupport ? "Yes" : "No"}</div>
        <div><strong>Other</strong>: ${r.reqOther ? "Yes" : "No"}</div>
        <div><strong>Details</strong>: ${esc(r.requestDetails || "—")}</div>
      </div>
    `;

    setDebug({});
    setStatus("Not generated");
    setPreview("");
    setDownload("");
  }

  function boot() {
    hydratePanel();

    const btn = $("#btnGen");
    if (btn) btn.addEventListener("click", generateFilledPdf);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
