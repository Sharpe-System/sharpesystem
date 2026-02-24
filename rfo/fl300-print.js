/* /rfo/fl300-print.js
   FL-300 Populate (v0.2) — OPTION 1: Direct-stamp the template (NO copyPages)
   Goal: Load the official template PDF directly, then fill fields / draw text on it.

   This avoids pdf-lib copyPages() failures on certain court PDFs.

   Assumptions:
   - pdf-lib is loaded globally as window.PDFLib (via /rfo/pdf-lib.min.js)
   - Template is served at /templates/jcc/fl300/FL-300.pdf (or set in HTML via data-template)

   Output:
   - Generates a filled PDF blob URL
   - Enables Open/Download
*/

(function () {
  "use strict";

  const { PDFDocument, rgb, StandardFonts } = window.PDFLib || {};
  if (!PDFDocument) {
    console.error("pdf-lib not loaded (window.PDFLib missing).");
    return;
  }

  // ---------- DOM helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setText(el, txt) {
    if (!el) return;
    el.textContent = String(txt ?? "");
  }

  function setHTML(el, html) {
    if (!el) return;
    el.innerHTML = String(html ?? "");
  }

  // ---------- State ----------
  const url = new URL(location.href);
  const jobId = url.searchParams.get("job") || "";
  const flow = url.searchParams.get("flow") || "rfo";

  // Template path can be overridden by the page
  const templateEl = $("#tplPath");
  const templatePath =
    (templateEl && (templateEl.dataset && templateEl.dataset.template)) ||
    "/templates/jcc/fl300/FL-300.pdf";

  // UI hooks (these exist in your latest fl300-print.html)
  const inputBox = $("#inputBox");
  const debugBox = $("#debugBox");
  const payloadBox = $("#payloadBox");
  const outFrame = $("#outFrame");
  const statusEl = $("#outStatus");
  const btnGen = $("#btnGenerate");
  const btnOpen = $("#btnOpen");
  const btnDl = $("#btnDownload");

  let latestBlobUrl = "";

  // ---------- Draft/job loading ----------
  function tryParseJSON(s) {
    try {
      return JSON.parse(s);
    } catch (_) {
      return null;
    }
  }

  // Best-effort: find a local draft that contains .rfo
  function loadLocalDraft() {
    // Common keys we might have used
    const candidates = [
      "ss:draft",
      "ss:draft:rfo",
      "sharpesystem:draft",
      "sharpesystem:draft:rfo",
      "draft",
      "draft:rfo",
      "rfo:draft",
    ];

    for (const k of candidates) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = tryParseJSON(raw);
      if (obj && typeof obj === "object") {
        if (obj.rfo && typeof obj.rfo === "object") return { source: `localStorage:${k}`, data: obj };
        if (obj.flow === "rfo" && obj.data) return { source: `localStorage:${k}`, data: obj.data };
      }
    }

    // Last resort: scan keys for "rfo" + "draft"
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const lk = k.toLowerCase();
      if (!(lk.includes("rfo") && lk.includes("draft"))) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const obj = tryParseJSON(raw);
      if (obj && typeof obj === "object") {
        if (obj.rfo && typeof obj.rfo === "object") return { source: `localStorage:${k}`, data: obj };
        if (obj.flow === "rfo" && obj.data) return { source: `localStorage:${k}`, data: obj.data };
      }
    }

    return { source: "local draft: none found", data: { rfo: {} } };
  }

  // Jobs API is still evolving in your repo; keep it best-effort and never block.
  async function loadJobDraft(jobId) {
    if (!jobId) return null;

    const probes = [
      `/jobs/${encodeURIComponent(jobId)}.json`,
      `/jobs/${encodeURIComponent(jobId)}`,
      `/print/jobs/${encodeURIComponent(jobId)}.json`,
      `/print/jobs/${encodeURIComponent(jobId)}`,
    ];

    for (const p of probes) {
      try {
        const r = await fetch(p, { cache: "no-store" });
        if (!r.ok) continue;
        const j = await r.json();
        // Expect something like { flow, draft, data, payload }
        const data =
          j.data ||
          j.draft ||
          j.payload ||
          (j.flow ? j : null);

        if (data) return { source: `job:${p}`, data };
      } catch (_) {
        // ignore
      }
    }
    return null;
  }

  function normalizeInput(raw) {
    const out = { rfo: {} };

    const src = raw && raw.data ? raw.data : raw;

    // Accept shapes:
    // { rfo: {...} }
    // { data: { rfo: {...} } }
    // { flow:"rfo", data:{...} }
    // { payload:{...} }
    let root = src;

    if (root && root.flow === "rfo" && root.data) root = root.data;
    if (root && root.data && root.data.rfo) root = root.data;
    if (root && root.payload && root.payload.rfo) root = root.payload;

    if (root && root.rfo && typeof root.rfo === "object") out.rfo = { ...root.rfo };

    // Normalize expected keys
    const r = out.rfo;

    r.county = String(r.county || "").trim();
    r.branch = String(r.branch || "").trim();
    r.caseNumber = String(r.caseNumber || "").trim();
    r.role = String(r.role || "").trim(); // petitioner/respondent/other

    r.reqCustody = !!r.reqCustody;
    r.reqSupport = !!r.reqSupport;
    r.reqOther = !!r.reqOther;

    r.requestDetails = String(r.requestDetails || "").trim();

    return out;
  }

  function roleLabel(role) {
    const v = String(role || "").toLowerCase();
    if (v === "petitioner") return "Petitioner";
    if (v === "respondent") return "Respondent";
    if (v === "other") return "Other";
    return role ? String(role) : "";
  }

  // ---------- PDF fill strategy ----------
  function buildValueMap(input) {
    const r = input.rfo || {};
    return {
      county: r.county,
      branch: r.branch,
      caseNumber: r.caseNumber,
      role: roleLabel(r.role),
      custody: r.reqCustody ? "Yes" : "No",
      support: r.reqSupport ? "Yes" : "No",
      other: r.reqOther ? "Yes" : "No",
      details: r.requestDetails,
    };
  }

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[\s:_\-\/\\]+/g, " ")
      .trim();
  }

  function pickFieldByHeuristic(names, wants) {
    // names: string[]
    // wants: array of patterns (strings or regex)
    for (const w of wants) {
      if (w instanceof RegExp) {
        const hit = names.find((n) => w.test(n));
        if (hit) return hit;
      } else {
        const wn = norm(w);
        const hit = names.find((n) => norm(n).includes(wn));
        if (hit) return hit;
      }
    }
    return null;
  }

  function clampText(s, max) {
    const t = String(s ?? "");
    if (t.length <= max) return t;
    return t.slice(0, max - 1) + "…";
  }

  async function fetchBytes(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(`Failed to fetch ${path} (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  }

  async function generateFilledPdf(input) {
    const valueMap = buildValueMap(input);

    // Load template directly (no copyPages)
    const tplBytes = await fetchBytes(templatePath);

    // NOTE: ignoreEncryption handles many “permissions” cases.
    // If it still fails, it’s usually structural incompatibility for editing.
    const pdfDoc = await PDFDocument.load(tplBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const black = rgb(0, 0, 0);

    const debug = {
      templatePath,
      jobId,
      flow,
      fieldStrategy: "acroform-first-then-draw",
      mappedFields: {},
      drawFallbackUsed: false,
      notes: [],
    };

    // 1) Try AcroForm fill (best: keeps the official look)
    let form = null;
    try {
      form = pdfDoc.getForm();
    } catch (e) {
      debug.notes.push(`getForm() failed: ${String(e && e.message ? e.message : e)}`);
      form = null;
    }

    if (form) {
      const fields = form.getFields();
      const names = fields.map((f) => f.getName());

      // Heuristic matches (these vary wildly between official PDFs)
      const fieldMap = {
        county: pickFieldByHeuristic(names, [
          "County of",
          "County",
          /county/i,
        ]),
        branch: pickFieldByHeuristic(names, [
          "Branch Name",
          "Branch",
          "Courthouse",
          /branch/i,
        ]),
        caseNumber: pickFieldByHeuristic(names, [
          "Case Number",
          "Case No",
          /case\s*(no|number)/i,
        ]),
        // These may not exist on FL-300 as direct fields in many templates:
        petitioner: pickFieldByHeuristic(names, ["Petitioner", /petitioner/i]),
        respondent: pickFieldByHeuristic(names, ["Respondent", /respondent/i]),
      };

      // Set text where we can
      function safeSetText(fieldName, valueKey) {
        if (!fieldName) return;
        try {
          const f = form.getTextField(fieldName);
          f.setText(String(valueMap[valueKey] || ""));
          debug.mappedFields[valueKey] = fieldName;
        } catch (_) {
          // maybe checkbox or different type; try generic
          try {
            const fAny = fields.find((x) => x.getName() === fieldName);
            if (fAny && fAny.setText) {
              fAny.setText(String(valueMap[valueKey] || ""));
              debug.mappedFields[valueKey] = fieldName;
            }
          } catch (e) {
            debug.notes.push(`Failed setting ${valueKey} -> ${fieldName}: ${String(e && e.message ? e.message : e)}`);
          }
        }
      }

      safeSetText(fieldMap.county, "county");
      safeSetText(fieldMap.branch, "branch");
      safeSetText(fieldMap.caseNumber, "caseNumber");

      // Try to force appearances (important so it prints “machine”)
      try {
        form.updateFieldAppearances(font);
      } catch (e) {
        debug.notes.push(`updateFieldAppearances failed: ${String(e && e.message ? e.message : e)}`);
      }
    }

    // 2) If AcroForm didn’t map anything meaningful, draw text in known places
    // This is a proof-of-effort fallback, not the final mapping strategy.
    const mappedKeys = Object.keys(debug.mappedFields || {});
    const needsDrawFallback =
      !mappedKeys.includes("county") &&
      !mappedKeys.includes("branch") &&
      !mappedKeys.includes("caseNumber");

    if (needsDrawFallback) {
      debug.drawFallbackUsed = true;

      const pages = pdfDoc.getPages();
      const p1 = pages[0];

      // Coordinates are approximate; adjust once you confirm the template’s exact layout.
      // US Letter coordinate system: origin bottom-left.
      const draw = (text, x, y, size = 10) => {
        p1.drawText(String(text || ""), { x, y, size, font, color: black });
      };

      // Top-right court box
      draw(valueMap.county ? `COUNTY OF ${valueMap.county}` : "", 335, 700, 10);
      draw(valueMap.branch ? `BRANCH: ${valueMap.branch}` : "", 335, 660, 10);

      // Case information box (mid-page)
      draw(valueMap.caseNumber ? valueMap.caseNumber : "", 120, 545, 11);
      draw(valueMap.role ? valueMap.role : "", 360, 545, 11);

      // Orders Requested (high-level)
      draw(`Custody/Visitation: ${valueMap.custody}`, 95, 420, 10);
      draw(`Support: ${valueMap.support}`, 95, 404, 10);
      draw(`Other: ${valueMap.other}`, 95, 388, 10);

      // Details box (truncate; you want MC-030 auto-attach later)
      draw(clampText(valueMap.details, 180), 95, 250, 9);

      debug.notes.push("Draw fallback used (AcroForm names not found / not settable).");
    }

    // Flattening is tricky; pdf-lib doesn’t have a perfect “flatten all” for all PDFs,
    // but we can at least attempt to lock appearances by saving as-is.
    const outBytes = await pdfDoc.save({ useObjectStreams: false });

    return { outBytes, debug, valueMap };
  }

  // ---------- UI render ----------
  function renderInputPanel(srcLabel, input) {
    const r = input.rfo || {};
    const rows = [
      ["Job ID", jobId || "—"],
      ["County", r.county || "—"],
      ["Branch", r.branch || "—"],
      ["Case #", r.caseNumber || "—"],
      ["Role", r.role || "—"],
      ["Custody", r.reqCustody ? "Yes" : "No"],
      ["Support", r.reqSupport ? "Yes" : "No"],
      ["Other", r.reqOther ? "Yes" : "No"],
      ["Details", r.requestDetails || "—"],
    ];

    const lines = rows
      .map(([k, v]) => `<div class="kv"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`)
      .join("");

    setHTML(
      inputBox,
      `<div class="muted" style="margin-bottom:6px;">Loaded from: <strong>${esc(srcLabel)}</strong></div>${lines}`
    );
  }

  function renderDebug(obj) {
    setText(debugBox, JSON.stringify(obj, null, 2));
  }

  function renderPayload(obj) {
    setText(payloadBox, JSON.stringify(obj, null, 2));
  }

  function setOutputStatus(text) {
    if (statusEl) statusEl.textContent = String(text || "");
  }

  function setButtonsEnabled(hasPdf) {
    if (btnOpen) btnOpen.disabled = !hasPdf;
    if (btnDl) btnDl.disabled = !hasPdf;
  }

  function setFrameUrl(blobUrl) {
    if (!outFrame) return;
    outFrame.src = blobUrl || "about:blank";
  }

  function revokeBlobUrl() {
    if (latestBlobUrl) {
      try {
        URL.revokeObjectURL(latestBlobUrl);
      } catch (_) {}
      latestBlobUrl = "";
    }
  }

  // ---------- Boot ----------
  async function boot() {
    // Load job if possible, else local
    let src = null;

    const job = await loadJobDraft(jobId);
    if (job) src = job;
    else src = loadLocalDraft();

    const input = normalizeInput(src);
    renderInputPanel(src.source || "unknown", input);

    // Pre-render payload for sanity
    renderPayload({
      ok: true,
      jobId: jobId || null,
      source: src.source || "unknown",
      templatePath,
      data: input,
    });

    // Wire buttons
    if (btnGen) {
      btnGen.addEventListener("click", async () => {
        revokeBlobUrl();
        setButtonsEnabled(false);
        setFrameUrl("about:blank");
        setOutputStatus("Generating…");

        const dbg = {
          source: src.source || "unknown",
          templatePath,
          jobId: jobId || null,
          flow,
        };

        try {
          const res = await generateFilledPdf(input);

          // Debug output
          renderDebug({
            ...dbg,
            ...res.debug,
          });

          // Blob output
          const blob = new Blob([res.outBytes], { type: "application/pdf" });
          latestBlobUrl = URL.createObjectURL(blob);

          setFrameUrl(latestBlobUrl);
          setButtonsEnabled(true);
          setOutputStatus("Generated");

        } catch (e) {
          renderDebug({
            ...dbg,
            error: String(e && e.message ? e.message : e),
            hint: "Template may be structurally incompatible for editing. If this fails persistently, we pivot to Option 2 (render-from-scratch).",
          });
          setButtonsEnabled(false);
          setOutputStatus(`Failed: ${String(e && e.message ? e.message : e)}`);
        }
      });
    }

    if (btnOpen) {
      btnOpen.addEventListener("click", () => {
        if (!latestBlobUrl) return;
        window.open(latestBlobUrl, "_blank", "noopener,noreferrer");
      });
    }

    if (btnDl) {
      btnDl.addEventListener("click", () => {
        if (!latestBlobUrl) return;
        const a = document.createElement("a");
        a.href = latestBlobUrl;
        a.download = `FL-300-filled-${jobId || "draft"}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    }

    // Initial status
    setButtonsEnabled(false);
    setOutputStatus("Not generated");
    renderDebug({
      ready: true,
      mode: "direct-template-stamp (no copyPages)",
      templatePath,
      jobId: jobId || null,
      flow,
      note: "Click Generate filled PDF.",
    });
  }

  boot();
})();
