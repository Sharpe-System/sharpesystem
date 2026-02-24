/* /rfo/fl300-print.js
   FL-300 Print + Populate (v0) — "Raster background + text overlay" generator.

   Why: pdf-lib cannot reliably parse some Judicial Council PDFs (invalid object refs).
   Fix: Render official PDF pages via PDF.js into images, then build a NEW PDF with pdf-lib
        using those images as backgrounds + overlay text/checkmarks.

   Output: Visually matches official form (flattened). Not an interactive AcroForm.
*/

(function () {
  "use strict";

  // -----------------------------
  // Utilities
  // -----------------------------
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

  function clamp(n, a, b) {
    n = Number(n);
    if (Number.isNaN(n)) return a;
    return Math.max(a, Math.min(b, n));
  }

  async function loadScriptOnce(src) {
    // If already loaded, skip
    const existing = Array.from(document.scripts).some(s => s.src === src);
    if (existing) return;

    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Failed to load script: " + src));
      document.head.appendChild(s);
    });
  }

  function getJobId() {
    const url = new URL(location.href);
    return url.searchParams.get("job") || "";
  }

  // Try multiple endpoints because your repo has moved this around over time.
  async function fetchJob(jobId) {
    if (!jobId) return null;

    const candidates = [
      `/api/jobs?job=${encodeURIComponent(jobId)}`,
      `/functions/api/jobs?job=${encodeURIComponent(jobId)}`,
      `/${encodeURIComponent(jobId)}`, // sometimes jobs are served at root by workers
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const json = await res.json();
        // Expect shape like { ok:true, jobId, renderUrl, pdfUrl, data? }
        return json;
      } catch (_) {}
    }
    return null;
  }

  function readLocalDraft() {
    // Try a few plausible keys. Keep this permissive.
    const keys = [
      "sharpesystem:draft",
      "draft",
      "draft:rfo",
      "rfo:draft",
      "sharpesystem:rfo:draft",
    ];
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k);
        if (!v) continue;
        const obj = JSON.parse(v);
        if (obj && typeof obj === "object") return obj;
      } catch (_) {}
    }
    return {};
  }

  function normalizeDraft(d) {
    d = d && typeof d === "object" ? d : {};
    d.rfo = d.rfo && typeof d.rfo === "object" ? d.rfo : {};
    return d;
  }

  function coerceBool(v) {
    return v === true || v === "true" || v === 1 || v === "1";
  }

  function toFieldModel(draft) {
    const r = (draft && draft.rfo) || {};
    return {
      county: String(r.county || "").trim(),
      branch: String(r.branch || "").trim(),
      caseNumber: String(r.caseNumber || "").trim(),
      role: String(r.role || "").trim(), // "petitioner"|"respondent"|"other"|etc
      reqCustody: coerceBool(r.reqCustody),
      reqSupport: coerceBool(r.reqSupport),
      reqOther: coerceBool(r.reqOther),
      details: String(r.requestDetails || "").trim(),
    };
  }

  // -----------------------------
  // PDF generation (Raster + overlay)
  // -----------------------------
  async function ensurePdfLib() {
    // PDFLib global from https://unpkg.com/pdf-lib/dist/pdf-lib.min.js
    if (window.PDFLib) return;
    await loadScriptOnce("https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js");
    if (!window.PDFLib) throw new Error("pdf-lib failed to load.");
  }

  async function ensurePdfJs() {
    // pdfjsLib global from https://cdnjs.cloudflare.com/ajax/libs/pdf.js/<ver>/pdf.min.js
    if (window.pdfjsLib) return;
    await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.js");
    if (!window.pdfjsLib) throw new Error("PDF.js failed to load.");
    // Required worker
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js";
  }

  async function fetchArrayBuffer(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch: ${url} (${res.status})`);
    return await res.arrayBuffer();
  }

  async function renderPdfToPngs(pdfArrayBuffer, scale = 2) {
    // Returns [{pngBytes, width, height}] per page.
    const pdf = await window.pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
    const out = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { alpha: false });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
      const pngBytes = new Uint8Array(await blob.arrayBuffer());

      out.push({
        pngBytes,
        width: canvas.width,
        height: canvas.height,
      });
    }
    return out;
  }

  function drawCheckmark(page, x, y) {
    // Simple "X" mark, small.
    const size = 10;
    page.drawLine({ start: { x, y }, end: { x: x + size, y: y + size }, thickness: 1 });
    page.drawLine({ start: { x: x + size, y }, end: { x, y: y + size }, thickness: 1 });
  }

  function drawWrappedText(page, text, x, y, maxWidth, lineHeight, font, size) {
    text = String(text || "").trim();
    if (!text) return;

    const words = text.split(/\s+/);
    const lines = [];
    let line = "";

    for (const w of words) {
      const test = line ? line + " " + w : w;
      const width = font.widthOfTextAtSize(test, size);
      if (width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);

    let yy = y;
    for (const ln of lines.slice(0, 10)) { // cap
      page.drawText(ln, { x, y: yy, size, font });
      yy -= lineHeight;
    }
  }

  async function generateFilledPdf(fields) {
    await ensurePdfJs();
    await ensurePdfLib();

    // Load official template (your repo has this path)
    const templateUrl = "/templates/jcc/fl300/FL-300.pdf";

    const templateBytes = await fetchArrayBuffer(templateUrl);
    const pngPages = await renderPdfToPngs(templateBytes, 2);

    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const doc = await PDFDocument.create();

    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // Create each page from the rendered PNG background, scaled to Letter points.
    // Letter in points: 612 x 792.
    // Our png sizes depend on render scale; we’ll fit background to 612x792 exactly.
    const PAGE_W = 612;
    const PAGE_H = 792;

    for (let i = 0; i < pngPages.length; i++) {
      const { pngBytes } = pngPages[i];
      const bg = await doc.embedPng(pngBytes);
      const page = doc.addPage([PAGE_W, PAGE_H]);

      // Draw background to full page
      page.drawImage(bg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

      // Overlay only on Page 1 for v0 (first page has the key header fields)
      if (i === 0) {
        const textColor = rgb(0, 0, 0);

        // These coordinates are approximate; adjust after you see output.
        // Origin in pdf-lib is bottom-left.
        // Header right block (County/Branch)
        if (fields.county) {
          page.drawText(fields.county.toUpperCase(), {
            x: 365, y: 708, size: 10, font: fontBold, color: textColor
          });
        }
        if (fields.branch) {
          page.drawText(fields.branch, {
            x: 340, y: 630, size: 10, font, color: textColor
          });
        }

        // Case number box (left mid)
        if (fields.caseNumber) {
          page.drawText(fields.caseNumber, {
            x: 120, y: 505, size: 11, font: fontBold, color: textColor
          });
        }

        // Role near case info (your vertical summary uses role)
        if (fields.role) {
          page.drawText(fields.role, {
            x: 360, y: 505, size: 11, font: fontBold, color: textColor
          });
        }

        // Orders requested checkboxes — approximate positions in your render
        // (These are for your minimal "High-level" block in the print-perfect section.)
        // If you want them on the actual official form checkboxes later, we’ll remap.
        // For v0, mark them in the "Orders Requested" area on page 1:
        if (fields.reqCustody) drawCheckmark(page, 95, 405);
        if (fields.reqSupport) drawCheckmark(page, 95, 388);
        if (fields.reqOther) drawCheckmark(page, 95, 371);

        // Details text block — write into a big open area lower on page 1.
        if (fields.details) {
          drawWrappedText(page, fields.details, 90, 305, 430, 12, font, 10);
        }
      }
    }

    return await doc.save();
  }

  // -----------------------------
  // UI wiring
  // -----------------------------
  async function boot() {
    const jobId = getJobId();

    // UI elements (these exist in your fl300-print.html after recent changes)
    const elInput = $("#inputBox") || $("#input"); // permissive
    const elDebug = $("#debugBox") || $("#debug");
    const elRaw = $("#rawBox") || $("#raw");
    const btnGen = $("#btnGenerate") || $("#generateFilled");
    const btnOpen = $("#btnOpen") || $("#openFilled");
    const btnDl = $("#btnDownload") || $("#downloadFilled");

    const setDebug = (obj) => {
      if (elDebug) elDebug.textContent = JSON.stringify(obj, null, 2);
    };
    const setRaw = (obj) => {
      if (elRaw) elRaw.textContent = obj ? JSON.stringify(obj, null, 2) : "—";
    };

    // Load data: job first, fallback to local draft
    let job = null;
    if (jobId) job = await fetchJob(jobId);

    const localDraft = normalizeDraft(readLocalDraft());
    const jobDraft = normalizeDraft(job && job.data ? job.data : {});
    const draft = (jobDraft && Object.keys(jobDraft.rfo || {}).length) ? jobDraft : localDraft;
    const fields = toFieldModel(draft);

    // Fill the input summary panel if present
    if (elInput) {
      elInput.innerHTML = `
        <div><strong>Job ID</strong>: ${esc(jobId || "—")}</div>
        <div><strong>County</strong>: ${esc(fields.county || "—")}</div>
        <div><strong>Branch</strong>: ${esc(fields.branch || "—")}</div>
        <div><strong>Case #</strong>: ${esc(fields.caseNumber || "—")}</div>
        <div><strong>Role</strong>: ${esc(fields.role || "—")}</div>
        <div><strong>Custody</strong>: ${fields.reqCustody ? "Yes" : "No"}</div>
        <div><strong>Support</strong>: ${fields.reqSupport ? "Yes" : "No"}</div>
        <div><strong>Other</strong>: ${fields.reqOther ? "Yes" : "No"}</div>
        <div><strong>Details</strong>: ${esc(fields.details ? fields.details.slice(0, 120) : "—")}</div>
      `;
    }

    setRaw(job || null);

    let lastBlobUrl = null;

    async function doGenerate() {
      try {
        setDebug({ status: "working", hint: "Generating flattened PDF (PDF.js render + pdf-lib overlay)..." });

        const pdfBytes = await generateFilledPdf(fields);
        const blob = new Blob([pdfBytes], { type: "application/pdf" });

        if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
        lastBlobUrl = URL.createObjectURL(blob);

        // Enable open/download if buttons exist
        if (btnOpen) btnOpen.disabled = false;
        if (btnDl) btnDl.disabled = false;

        setDebug({ ok: true, status: "generated", note: "Flattened PDF generated successfully.", url: lastBlobUrl });

      } catch (err) {
        setDebug({
          error: String(err && err.message ? err.message : err),
          hint: "If this fails, we stop and return to spine work."
        });
        console.error(err);
      }
    }

    function doOpen() {
      if (!lastBlobUrl) return;
      window.open(lastBlobUrl, "_blank", "noopener,noreferrer");
    }

    function doDownload() {
      if (!lastBlobUrl) return;
      const a = document.createElement("a");
      a.href = lastBlobUrl;
      a.download = `FL-300-filled-${jobId || "draft"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    if (btnGen) btnGen.addEventListener("click", doGenerate);
    if (btnOpen) btnOpen.addEventListener("click", doOpen);
    if (btnDl) btnDl.addEventListener("click", doDownload);

    // If buttons not found, still expose globally for console use
    window.__fl300 = { doGenerate, doOpen, doDownload, fields };
  }

  // Start
  boot().catch(console.error);
})();
