/* /rfo/fl300-print.js
   FL-300 Populate (v0) — minimal 6–10 fields
   Fixes: pdf-lib font undefined crash (updateFieldAppearances), better data sourcing,
   and robust job fetch.
*/
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  const jobId = new URL(location.href).searchParams.get("job") || "";

  // UI hooks (these IDs/classes should already exist in your HTML; if not, it fails soft)
  const btnGen = $("#btnGenerate") || $("button[data-action='generate']") || $("button");
  const btnOpen = $("#btnOpen") || $("button[data-action='open']");
  const btnDl = $("#btnDownload") || $("button[data-action='download']");
  const outFrame = $("#filledFrame") || $("#pdfFrame") || $("iframe");
  const statusEl = $("#filledStatus") || $("#statusFilled") || $(".status") || null;
  const debugEl = $("#debugJson") || $("#fieldMapDebug") || $("#debug") || null;
  const rawEl = $("#rawPayload") || $("#rawJson") || null;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function safeJson(el, obj) {
    if (!el) return;
    try {
      el.textContent = JSON.stringify(obj, null, 2);
    } catch (_) {
      el.textContent = String(obj);
    }
  }

  function lower(s) { return String(s || "").toLowerCase(); }

  // Try multiple endpoints so we don’t get stuck on one path.
  async function fetchJob(jobId) {
    if (!jobId) return null;

    const candidates = [
      `/api/print/jobs?job=${encodeURIComponent(jobId)}`,
      `/api/print/job?job=${encodeURIComponent(jobId)}`,
      `/api/jobs?job=${encodeURIComponent(jobId)}`,
      `/api/print/jobs/${encodeURIComponent(jobId)}`
    ];

    let lastErr = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) { lastErr = new Error(`${url} -> ${res.status}`); continue; }
        const json = await res.json();
        // Accept either {ok:true, ...} or a raw job object.
        return json;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Unable to fetch job");
  }

  function readLocalDraft() {
    // Best-effort: try a few likely keys used by the app controller/drafts.
    const keys = [
      "sharpesystem:draft",
      "sharpesystem:draft:rfo",
      "draft:rfo",
      "rfo:draft",
      "sharpesystem:lastDraft"
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

  function coalesceRfoData(jobJson) {
    // Prefer explicit data payloads if present.
    // Accept: jobJson.data, jobJson.payload, jobJson.draft, jobJson.rfo, etc.
    const fromJob =
      jobJson?.data ||
      jobJson?.payload ||
      jobJson?.draft ||
      jobJson?.draftData ||
      jobJson?.inputs ||
      null;

    const local = readLocalDraft();

    // Normalize to a single draft object with d.rfo
    const d = {};
    const merged = Object.assign({}, local || {}, fromJob || {});
    d.rfo = Object.assign({}, (local && local.rfo) || {}, (fromJob && fromJob.rfo) || {}, merged.rfo || {});
    return d;
  }

  function summarizeInputs(d) {
    const r = d.rfo || {};
    return {
      jobId: jobId || "—",
      county: r.county || "—",
      branch: r.branch || "—",
      caseNumber: r.caseNumber || "—",
      role: r.role || "—",
      custody: !!r.reqCustody,
      support: !!r.reqSupport,
      other: !!r.reqOther,
      details: r.requestDetails || "—"
    };
  }

  // Heuristic field match helpers
  function pickFieldByName(form, patterns) {
    const fields = form.getFields();
    const pats = patterns.map(p => (p instanceof RegExp ? p : new RegExp(p, "i")));
    for (const f of fields) {
      const name = f.getName ? f.getName() : "";
      for (const re of pats) {
        if (re.test(name)) return f;
      }
    }
    return null;
  }

  function setMaybe(field, value, debug) {
    if (!field) return false;
    const v = String(value ?? "").trim();
    const name = field.getName ? field.getName() : "(unknown)";
    try {
      if (typeof field.setText === "function") {
        field.setText(v);
        debug[name] = { set: "text", value: v };
        return true;
      }
      if (typeof field.select === "function") {
        // dropdown / radio style
        field.select(v);
        debug[name] = { set: "select", value: v };
        return true;
      }
      if (typeof field.check === "function") {
        // checkbox
        if (value) field.check();
        else if (typeof field.uncheck === "function") field.uncheck();
        debug[name] = { set: "check", value: !!value };
        return true;
      }
      debug[name] = { set: "unknown-type", value: v };
      return false;
    } catch (e) {
      debug[name] = { error: String(e) };
      return false;
    }
  }

  async function generateFilledPdf() {
    if (!window.PDFLib) throw new Error("PDFLib not found on window (pdf-lib not loaded).");

    setStatus("Loading job…");
    let jobJson = null;
    try {
      jobJson = await fetchJob(jobId);
    } catch (e) {
      // If job fetch fails, we still try local draft.
      jobJson = { ok: false, error: String(e) };
    }

    safeJson(rawEl, jobJson);

    const d = coalesceRfoData(jobJson);
    const inputs = summarizeInputs(d);

    // If you have an inputs panel, we populate it.
    const inputEl = $("#inputSummary") || $("#inputsTable") || null;
    if (inputEl) safeJson(inputEl, inputs);

    setStatus("Loading FL-300 template…");
    const tplUrl = "/templates/jcc/fl300/FL-300.pdf";
    const tplRes = await fetch(tplUrl);
    if (!tplRes.ok) throw new Error(`Template fetch failed: ${tplRes.status} (${tplUrl})`);
    const tplBytes = await tplRes.arrayBuffer();

    setStatus("Filling fields…");
    const pdfDoc = await window.PDFLib.PDFDocument.load(tplBytes);
    const form = pdfDoc.getForm();

    // IMPORTANT FIX: embed a font and pass it to updateFieldAppearances.
    const font = await pdfDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);

    const r = d.rfo || {};
    const dbg = { matched: {}, notFound: [] };

    // Minimal 6–10 “single vertical” mapping (heuristic by field name)
    const map = [
      { key: "county", value: r.county, patterns: [/county/i, /cnty/i] },
      { key: "branch", value: r.branch, patterns: [/branch/i, /courthouse/i, /branch name/i] },
      { key: "caseNumber", value: r.caseNumber, patterns: [/case.*number/i, /case.*no/i] },
      { key: "role", value: r.role, patterns: [/petitioner/i, /respondent/i, /your role/i, /role/i] },
      { key: "reqCustody", value: !!r.reqCustody, patterns: [/custody/i, /visitation/i] },
      { key: "reqSupport", value: !!r.reqSupport, patterns: [/support/i, /child support/i] },
      { key: "reqOther", value: !!r.reqOther, patterns: [/other/i] },
      { key: "details", value: r.requestDetails, patterns: [/request/i, /orders/i, /details/i, /other.*orders/i] }
    ];

    for (const item of map) {
      const field = pickFieldByName(form, item.patterns);
      if (!field) {
        dbg.notFound.push({ key: item.key, patterns: item.patterns.map(String) });
        continue;
      }
      setMaybe(field, item.value, dbg.matched);
    }

    // Update appearances WITHOUT crashing.
    form.updateFieldAppearances(font);

    // Save bytes
    const outBytes = await pdfDoc.save();
    const blob = new Blob([outBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    // Render into iframe if present
    if (outFrame && outFrame.tagName === "IFRAME") outFrame.src = url;

    // Enable open/download buttons if present
    if (btnOpen) {
      btnOpen.disabled = false;
      btnOpen.onclick = () => window.open(url, "_blank", "noopener,noreferrer");
    }
    if (btnDl) {
      btnDl.disabled = false;
      btnDl.onclick = () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = "FL-300-filled.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
    }

    safeJson(debugEl, dbg);
    setStatus("Filled PDF ready.");
  }

  function wire() {
    if (btnGen) {
      btnGen.disabled = false;
      btnGen.onclick = () => {
        generateFilledPdf().catch(err => {
          const msg = String(err?.message || err);
          safeJson(debugEl, { error: msg, hint: "If this fails, we stop and move on (per your rule)." });
          setStatus("Failed to generate");
          console.error(err);
        });
      };
    }

    // Auto-run once if you want immediate feedback
    // (kept conservative: only autorun when jobId exists)
    if (jobId) {
      // Don’t block UI; just attempt.
      generateFilledPdf().catch(err => {
        const msg = String(err?.message || err);
        safeJson(debugEl, { error: msg, hint: "Click Generate filled PDF after page loads." });
        setStatus("Failed to generate");
        console.error(err);
      });
    }
  }

  wire();
})();
