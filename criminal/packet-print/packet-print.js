// rfo/packet-print/packet-print.js
(function () {
  "use strict";

  const KEY = "ss_criminal_packet_v1";

  function $(sel, root = document) {
    return root.querySelector(sel);
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
    a.setAttribute("download", "DV-100-filled.pdf");
  }

  function renderNoDraft() {
    setStatus("No draft found");
    setPreview("");
    setDownload("");
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

        setStatus("Not generated");
    setPreview("");
    setDownload("");
  }

  async function generateFilledPdf(draft) {
    const btn = $("#btnGen");
    if (btn) btn.disabled = true;

    try {
      setStatus("Generating…");

      const res = await fetch("/api/render/packet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rfo: (draft || {}) }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setStatus("Failed");
                return;
      }

      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);

      setPreview(blobUrl);
      setDownload(blobUrl);
      setStatus("Generated");

              } catch (_) {
                  }
      } else {
              }
    } catch (e) {
      setStatus("Failed");
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

  // AUTO-GENERATE immediately (doorway behavior)
  generateFilledPdf(draft);

  // hide manual button (legacy)
  const btn = $("#btnGen");
  if (btn) btn.style.display = "none";
})();
