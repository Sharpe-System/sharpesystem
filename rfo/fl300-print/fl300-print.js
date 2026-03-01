// rfo/fl300-print/fl300-print.js
(function () {
  "use strict";

  const KEY = "ss_rfo_public_fl300_v1";

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
      const raw = localStorage.getItem(KEY);
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

  function renderNoDraft() {
    setStatus("No draft found");
    setPreview("");
    setDownload("");
    setDebug({
      ok: false,
      note: `No public FL-300 found at localStorage["${KEY}"].`,
      action: "Return to Public FL-300 and click Save, then come back here.",
      intakeUrl: "/rfo/public-fl300.html",
    });

    const list = $("#inputList");
    if (list) {
      list.innerHTML = `
        <div><strong>No draft found.</strong></div>
        <div style="margin-top:10px;">
          <a class="btn primary" href="/rfo/public-fl300.html">Go to Public FL-300</a>
        </div>
        <div class="muted" style="margin-top:10px;">
          Expected key: <code>${esc(KEY)}</code>
        </div>
      `;
    }

    const btn = $("#btnGen");
    if (btn) btn.disabled = true;
  }

  function hydratePanel(draft) {
    const r = draft || {};
    const cnum = (r.case && r.case.number) ? r.case.number : (r.caseNumber || "");
    const pet = (r.party && r.party.petitioner) ? r.party.petitioner : (r.petitioner || "");
    const resp = (r.party && r.party.respondent) ? r.party.respondent : (r.respondent || "");

    const list = $("#inputList");
    if (list) {
      list.innerHTML = `
        <div><strong>Loaded from:</strong> localStorage:${esc(KEY)}</div>
        <div style="margin-top:10px; line-height:1.35;">
          <div><strong>County</strong>: ${esc(r.county || "—")}</div>
          <div><strong>Branch</strong>: ${esc(r.branch || "—")}</div>
          <div><strong>Case #</strong>: ${esc(cnum || "—")}</div>
          <div><strong>Role</strong>: ${esc(r.role || "—")}</div>
          <div><strong>Custody</strong>: ${r.reqCustody ? "Yes" : "No"}</div>
          <div><strong>Support</strong>: ${r.reqSupport ? "Yes" : "No"}</div>
          <div><strong>Other</strong>: ${r.reqOther ? "Yes" : "No"}</div>
          <div><strong>Details</strong>: ${esc(r.requestDetails || "—")}</div>
        </div>
      `;
    }

    setDebug({});
    setStatus("Not generated");
    setPreview("");
    setDownload("");
  }

  async function generateFilledPdf(draft) {
    const btn = $("#btnGen");
    if (btn) btn.disabled = true;

    try {
      setStatus("Generating…");

      const res = await fetch("/api/render/fl300", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rfo: (draft || {}) }),
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
      if (btn) btn.disabled = false;
    }
  }

  function boot() {
    const draft = readLocalDraft();
    if (!draft || typeof draft !== "object") {
      renderNoDraft();
      return;
    }

    hydratePanel(draft);

    const btn = $("#btnGen");
    if (btn) btn.addEventListener("click", () => generateFilledPdf(draft));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
