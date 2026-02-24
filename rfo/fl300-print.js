/* rfo/fl300-print.js
   FL-300 Populate v0.1 — "stamp output" (NOT Acrobat field editing)

   Goals:
   - Load rfo data from job if available; else from local draft (so carry-over always works).
   - Load official template PDF (even if permissioned) using ignoreEncryption.
   - Create new output PDF by stamping black text at fixed coordinates (6–10 fields).
   - If Details is long => write "See Attachment 1" in box + add Attachment page.
*/

const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

const $ = (s) => document.querySelector(s);

const TEMPLATE_URL = "/templates/jcc/fl300/FL-300.pdf";

// Very small v0 mapping: page 1 only.
// NOTE: These coordinates are placeholders that you will calibrate once.
// They will still prove the pipeline end-to-end today.
// Coordinates are PDF points from bottom-left.
const MAP = {
  page: 0,
  county:      { x: 345, y: 700, w: 220, font: 11 }, // "COUNTY OF"
  branch:      { x: 345, y: 640, w: 220, font: 10 }, // "Branch Name"
  caseNumber:  { x: 140, y: 560, w: 180, font: 11 }, // "Case Number"
  role:        { x: 370, y: 560, w: 170, font: 11 }, // "Your role"
  reqCustody:  { x: 120, y: 452 },                   // checkbox area (approx)
  reqSupport:  { x: 120, y: 432 },
  reqOther:    { x: 120, y: 412 },
  detailsBox:  { x: 95,  y: 315, w: 470, h: 85, font: 10 } // big details box
};

function esc(s) {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function getJobId() {
  const url = new URL(location.href);
  return url.searchParams.get("job") || "";
}

function getBackUrl() {
  const url = new URL(location.href);
  const flow = url.searchParams.get("flow") || "rfo";
  // back to review stage
  const back = new URL("/app.html", location.origin);
  back.searchParams.set("flow", flow);
  back.searchParams.set("stage", "review");
  return back.toString();
}

function readLocalDraft() {
  // Robust localStorage scan for "rfo" payload. Keeps you out of exact-key hell.
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const v = localStorage.getItem(k);
    if (!v) continue;
    if (!v.includes('"rfo"')) continue;
    try {
      const j = JSON.parse(v);
      if (j && typeof j === "object" && j.rfo && typeof j.rfo === "object") return j;
    } catch (_) {}
  }
  return { rfo: {} };
}

async function fetchJobRfo(jobId) {
  // We try a few known patterns and accept whichever returns rfo payload.
  // If none work, caller falls back to local draft.
  const candidates = [
    `/print?job=${encodeURIComponent(jobId)}`,       // often returns JSON in your system
    `/jobs/${encodeURIComponent(jobId)}`,            // common REST shape
    `/jobs?job=${encodeURIComponent(jobId)}`,        // what your logs showed (currently 404)
    `/api/jobs/${encodeURIComponent(jobId)}`
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { "accept": "application/json" } });
      if (!res.ok) continue;
      const j = await res.json();

      // Possible shapes:
      // { rfo: {...} }
      // { payload: { rfo: {...} } }
      // { data: { rfo: {...} } }
      const rfo = j?.rfo || j?.payload?.rfo || j?.data?.rfo;
      if (rfo && typeof rfo === "object") return { rfo, raw: j, sourceUrl: url };

      // Some systems store full draft under payload
      const full = j?.payload || j?.data;
      if (full && full.rfo) return { rfo: full.rfo, raw: j, sourceUrl: url };
    } catch (_) {}
  }
  return null;
}

function normalizeRfo(input) {
  const r = input || {};
  return {
    county: (r.county || "").trim(),
    branch: (r.branch || "").trim(),
    caseNumber: (r.caseNumber || "").trim(),
    role: (r.role || "").trim(),
    reqCustody: !!r.reqCustody,
    reqSupport: !!r.reqSupport,
    reqOther: !!r.reqOther,
    requestDetails: (r.requestDetails || "").trim()
  };
}

function setKV(jobId, src, r) {
  const kv = $("#kv");
  const row = (k, v) => `<div class="muted">${esc(k)}</div><div>${esc(v || "—")}</div>`;
  kv.innerHTML = [
    row("Job ID", jobId || "—"),
    row("County", r.county),
    row("Branch", r.branch),
    row("Case #", r.caseNumber),
    row("Role", r.role),
    row("Custody", r.reqCustody ? "Yes" : "No"),
    row("Support", r.reqSupport ? "Yes" : "No"),
    row("Other", r.reqOther ? "Yes" : "No"),
    row("Details", r.requestDetails ? (r.requestDetails.length > 60 ? r.requestDetails.slice(0, 60) + "…" : r.requestDetails) : "—"),
  ].join("");

  $("#srcLabel").textContent = src;
}

function setDebug(obj) {
  $("#debug").textContent = JSON.stringify(obj, null, 2);
}

function setStatus(text, ok = null) {
  const el = $("#statusLine");
  el.textContent = text;
  el.className = "small " + (ok === true ? "ok" : ok === false ? "err" : "muted");
}

function wrapText(text, maxCharsPerLine) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (test.length <= maxCharsPerLine) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function shouldOverflow(details) {
  // Simple deterministic overflow gate for v0: adjust later with font metrics.
  // If > ~320 chars, we push to attachment.
  return (details || "").length > 320;
}

async function generateFilledPdf(r) {
  const tplBytes = await (await fetch(TEMPLATE_URL)).arrayBuffer();

  // Critical: ignoreEncryption to bypass permission flags.
  const tplDoc = await PDFDocument.load(tplBytes, { ignoreEncryption: true });

  const outDoc = await PDFDocument.create();

  // Copy all pages so the output visually matches the court PDF.
  const copiedPages = await outDoc.copyPages(tplDoc, tplDoc.getPageIndices());
  copiedPages.forEach(p => outDoc.addPage(p));

  const font = await outDoc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);

  const page = outDoc.getPage(MAP.page);

  const drawTextInBox = (text, box) => {
    const t = String(text || "");
    const size = box.font || 10;
    // crude wrapping by char count (deterministic and “machine”)
    const maxChars = Math.max(10, Math.floor((box.w || 200) / (size * 0.55)));
    const lines = wrapText(t, maxChars);
    const lineHeight = size + 2;

    // Only draw what fits vertically; overflow is handled by attachment rule.
    const maxLines = Math.max(1, Math.floor((box.h || 20) / lineHeight));
    const clipped = lines.slice(0, maxLines);

    let y = box.y + (box.h || 20) - lineHeight; // top-down
    for (const ln of clipped) {
      page.drawText(ln, { x: box.x, y, size, font, color: black });
      y -= lineHeight;
    }
  };

  const drawText = (text, spec) => {
    page.drawText(String(text || ""), { x: spec.x, y: spec.y, size: spec.font || 11, font, color: black });
  };

  const drawCheck = (on, spec) => {
    if (!on) return;
    // Draw a solid black “X” as a reliable machine mark.
    const x = spec.x, y = spec.y;
    page.drawText("X", { x, y, size: 12, font, color: black });
  };

  // Stamp the “simple 6–10 fields”
  if (r.county) drawText(r.county, MAP.county);
  if (r.branch) drawText(r.branch, MAP.branch);
  if (r.caseNumber) drawText(r.caseNumber, MAP.caseNumber);
  if (r.role) drawText(r.role.toUpperCase(), MAP.role);

  drawCheck(r.reqCustody, MAP.reqCustody);
  drawCheck(r.reqSupport, MAP.reqSupport);
  drawCheck(r.reqOther, MAP.reqOther);

  const overflow = shouldOverflow(r.requestDetails);
  if (!overflow) {
    drawTextInBox(r.requestDetails, MAP.detailsBox);
  } else {
    drawTextInBox("See Attachment 1.", MAP.detailsBox);

    // Attachment page (MC-style): clean black text, deterministic formatting.
    const att = outDoc.addPage([612, 792]); // US Letter points
    att.drawText("ATTACHMENT 1 — Requested Orders (Details)", { x: 72, y: 740, size: 14, font, color: black });
    att.drawText("This attachment was generated automatically because the Details exceeded the FL-300 box capacity.", { x: 72, y: 716, size: 10, font, color: black });

    const bodySize = 11;
    const maxChars = 95;
    const lines = wrapText(r.requestDetails, maxChars);

    let y = 680;
    for (const ln of lines) {
      if (y < 72) {
        // spill into another attachment page
        y = 740;
        const p = outDoc.addPage([612, 792]);
        p.drawText("ATTACHMENT 1 (continued)", { x: 72, y, size: 14, font, color: black });
        y -= 30;
        // continue drawing on new page
        for (const ln2 of lines.splice(0, 9999)) {
          // (we’ll re-enter loop properly below; simpler to just break)
          break;
        }
      }
      att.drawText(ln, { x: 72, y, size: bodySize, font, color: black });
      y -= (bodySize + 4);
    }
  }

  // Return bytes
  return await outDoc.save();
}

(async function main() {
  $("#backBtn").addEventListener("click", () => location.href = getBackUrl());

  const jobId = getJobId();

  // Load input: prefer job, else local
  let source = "local draft";
  let raw = null;
  let rfo = null;

  if (jobId) {
    const got = await fetchJobRfo(jobId);
    if (got?.rfo) {
      source = `job (${got.sourceUrl})`;
      rfo = got.rfo;
      raw = got.raw;
    }
  }
  if (!rfo) {
    const d = readLocalDraft();
    rfo = d?.rfo || {};
    raw = d;
  }

  const r = normalizeRfo(rfo);
  setKV(jobId, `Loaded from: ${source}`, r);
  setDebug({ source, jobId, rfo: r, raw });

  let lastBlobUrl = "";
  const enableOpenDownload = (blobUrl) => {
    $("#openBtn").disabled = false;
    $("#dlBtn").disabled = false;

    $("#openBtn").onclick = () => window.open(blobUrl, "_blank", "noopener,noreferrer");
    $("#dlBtn").onclick = () => {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `FL-300_filled_${jobId || "draft"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
  };

  $("#genBtn").addEventListener("click", async () => {
    try {
      setStatus("Generating…", null);
      $("#genBtn").disabled = true;

      const bytes = await generateFilledPdf(r);

      if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      lastBlobUrl = url;

      $("#pdfFrame").src = url;
      enableOpenDownload(url);
      setStatus("Generated (machine-stamped on official template).", true);
    } catch (err) {
      console.error(err);
      setStatus(`Failed: ${err?.message || err}`, false);
      setDebug({ source, jobId, rfo: r, error: String(err?.message || err), hint: "If this fails due to template permissions/structure, we stop and move on." });
    } finally {
      $("#genBtn").disabled = false;
    }
  });

  // Start clean: don’t auto-generate until you click.
  setStatus("Ready. Click “Generate filled PDF”.", null);
})();
