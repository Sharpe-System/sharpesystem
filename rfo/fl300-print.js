/* /rfo/fl300-print.js
   FL-300 Populate (minimal vertical v0)

   Goal:
   - Load official PDF: /templates/jcc/fl300/FL-300.pdf
   - Load draft data from:
       A) job payload (if job= present)
       B) localStorage fallback (best-effort)
   - Fill ~6–10 fields by heuristic name matching (no hardcoded field list required)
   - Render filled PDF in iframe + allow open/download
*/

(function () {
  "use strict";

  const TEMPLATE_URL = "/templates/jcc/fl300/FL-300.pdf";

  const $ = (sel) => document.querySelector(sel);

  const els = {
    status: $("#status"),
    jobId: $("#jobId"),
    vCounty: $("#vCounty"),
    vBranch: $("#vBranch"),
    vCase: $("#vCase"),
    vRole: $("#vRole"),
    vCustody: $("#vCustody"),
    vSupport: $("#vSupport"),
    vOther: $("#vOther"),
    vDetails: $("#vDetails"),
    debug: $("#debug"),
    raw: $("#raw"),
    pdfState: $("#pdfState"),
    pdfFrame: $("#pdfFrame"),
    btnFill: $("#btnFill"),
    btnOpen: $("#btnOpen"),
    btnDownload: $("#btnDownload"),
  };

  function safeJson(x) {
    try { return JSON.stringify(x, null, 2); } catch { return String(x); }
  }

  function getJobId() {
    const u = new URL(location.href);
    return u.searchParams.get("job") || "";
  }

  async function fetchJson(url) {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    return await res.json();
  }

  async function loadJob(jobId) {
    if (!jobId) return null;

    // Try a few likely endpoints, in order.
    const tries = [
      `/api/jobs/${encodeURIComponent(jobId)}`,
      `/api/print/jobs/${encodeURIComponent(jobId)}`,
      `/functions/api/jobs/${encodeURIComponent(jobId)}`,
      `/functions/api/print/jobs/${encodeURIComponent(jobId)}`
    ];

    let lastErr = null;
    for (const url of tries) {
      try {
        return await fetchJson(url);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Job load failed");
  }

  function loadLocalDraft() {
    // Best-effort: scan localStorage keys that typically hold a draft object.
    // We intentionally avoid assumptions about exact keys.
    const candidates = [
      "draft",
      "sharpesystem:draft",
      "sharpe:draft",
      "ss:draft",
      "rfo:draft"
    ];

    for (const k of candidates) {
      const v = localStorage.getItem(k);
      if (!v) continue;
      try {
        const obj = JSON.parse(v);
        if (obj && typeof obj === "object") return obj;
      } catch (_) {}
    }

    // As a fallback, scan all keys for something that looks like an RFO payload.
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const v = localStorage.getItem(k);
        if (!v || v.length < 20) continue;
        try {
          const obj = JSON.parse(v);
          if (obj && typeof obj === "object" && (obj.rfo || obj.flow === "rfo")) return obj;
        } catch (_) {}
      }
    } catch (_) {}

    return null;
  }

  function extractRfoPayload(jobOrDraft) {
    // Accept a variety of shapes.
    const root = jobOrDraft || {};
    const data =
      root.data ||
      root.payload ||
      root.job ||
      root.draft ||
      root;

    const rfo =
      (data && data.rfo) ||
      (data && data.data && data.data.rfo) ||
      (data && data.payload && data.payload.rfo) ||
      null;

    return { root, data, rfo: rfo || {} };
  }

  function normRole(role) {
    const s = String(role || "").toLowerCase().trim();
    if (s === "petitioner") return "petitioner";
    if (s === "respondent") return "respondent";
    return s || "";
  }

  function boolToYesNo(v) {
    return v ? "Yes" : "No";
  }

  function renderInputs(rfo, jobId, rootForRaw) {
    els.jobId.textContent = jobId || "—";

    els.vCounty.textContent = rfo.county || "—";
    els.vBranch.textContent = rfo.branch || "—";
    els.vCase.textContent = rfo.caseNumber || "—";
    els.vRole.textContent = normRole(rfo.role) || "—";
    els.vCustody.textContent = boolToYesNo(!!rfo.reqCustody);
    els.vSupport.textContent = boolToYesNo(!!rfo.reqSupport);
    els.vOther.textContent = boolToYesNo(!!rfo.reqOther);
    els.vDetails.textContent = rfo.requestDetails || "—";

    els.raw.textContent = safeJson(rootForRaw);
  }

  function lower(s) { return String(s || "").toLowerCase(); }

  function pickFieldNameByHeuristics(allFieldNames, patterns) {
    const names = allFieldNames || [];
    for (const p of patterns) {
      const re = new RegExp(p, "i");
      const hit = names.find(n => re.test(n));
      if (hit) return hit;
    }
    return "";
  }

  async function generateFilledPdf(rfo) {
    if (!window.PDFLib) throw new Error("pdf-lib not loaded");

    // Load template bytes
    const tplRes = await fetch(TEMPLATE_URL);
    if (!tplRes.ok) throw new Error(`Template fetch failed: ${tplRes.status}`);
    const tplBytes = new Uint8Array(await tplRes.arrayBuffer());

    const pdfDoc = await PDFLib.PDFDocument.load(tplBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    const fields = form.getFields();
    const allNames = fields.map(f => f.getName());

    // Target values (minimal vertical)
    const vals = {
      county: String(rfo.county || ""),
      branch: String(rfo.branch || ""),
      caseNumber: String(rfo.caseNumber || ""),
      role: normRole(rfo.role),
      reqCustody: !!rfo.reqCustody,
      reqSupport: !!rfo.reqSupport,
      reqOther: !!rfo.reqOther,
      details: String(rfo.requestDetails || "")
    };

    // Heuristic mapping patterns (we expect to refine after first run using debug output)
    const map = {
      county: pickFieldNameByHeuristics(allNames, [
        "county", "County of", "SUPERIOR.*COUNTY", "court.*county"
      ]),
      branch: pickFieldNameByHeuristics(allNames, [
        "branch", "Branch Name", "courthouse", "court.*branch"
      ]),
      caseNumber: pickFieldNameByHeuristics(allNames, [
        "case.*number", "CaseNumber", "Case No", "Case_No", "Case"
      ]),
      petitionerOrRespondentRole: pickFieldNameByHeuristics(allNames, [
        "role", "petitioner.*respondent", "party.*type"
      ]),
      details: pickFieldNameByHeuristics(allNames, [
        "details", "requested.*orders", "orders.*requested", "other.*orders", "request.*details"
      ]),
      cbCustody: pickFieldNameByHeuristics(allNames, [
        "custody", "visitation", "child.*custody"
      ]),
      cbSupport: pickFieldNameByHeuristics(allNames, [
        "support", "child.*support"
      ]),
      cbOther: pickFieldNameByHeuristics(allNames, [
        "^other$", "other.*request", "other.*orders"
      ]),
    };

    const debug = {
      template: TEMPLATE_URL,
      detectedFieldCount: allNames.length,
      chosenMap: map,
      values: vals,
      note: "If any chosenMap entries are blank, we didn't find a match. We'll refine patterns after first run."
    };

    // Fill helper that tolerates mismatch types
    function trySetText(fieldName, value) {
      if (!fieldName) return { ok: false, why: "no match" };
      try {
        const tf = form.getTextField(fieldName);
        tf.setText(String(value || ""));
        return { ok: true };
      } catch (e) {
        // Not a text field; try dropdown
        try {
          const dd = form.getDropdown(fieldName);
          dd.select(String(value || ""));
          return { ok: true, used: "dropdown" };
        } catch (_) {
          return { ok: false, why: String(e?.message || e) };
        }
      }
    }

    function trySetCheckbox(fieldName, checked) {
      if (!fieldName) return { ok: false, why: "no match" };
      try {
        const cb = form.getCheckBox(fieldName);
        if (checked) cb.check();
        else cb.uncheck();
        return { ok: true };
      } catch (e) {
        return { ok: false, why: String(e?.message || e) };
      }
    }

    const results = {
      county: trySetText(map.county, vals.county),
      branch: trySetText(map.branch, vals.branch),
      caseNumber: trySetText(map.caseNumber, vals.caseNumber),
      role: trySetText(map.petitionerOrRespondentRole, vals.role),
      details: trySetText(map.details, vals.details),
      cbCustody: trySetCheckbox(map.cbCustody, vals.reqCustody),
      cbSupport: trySetCheckbox(map.cbSupport, vals.reqSupport),
      cbOther: trySetCheckbox(map.cbOther, vals.reqOther),
    };

    // Make appearance updates so values render in typical PDF viewers
    try {
      form.updateFieldAppearances(pdfDoc);
    } catch (_) {}

    const outBytes = await pdfDoc.save();

    return { outBytes, debug, results, allNames };
  }

  function setPdfBlob(bytes) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    els.pdfFrame.src = url;
    els.pdfState.textContent = "Filled PDF ready";

    els.btnOpen.disabled = false;
    els.btnDownload.disabled = false;

    els.btnOpen.onclick = () => window.open(url, "_blank", "noopener,noreferrer");
    els.btnDownload.onclick = () => {
      const a = document.createElement("a");
      a.href = url;
      a.download = "FL-300-filled.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    };
  }

  async function main() {
    const jobId = getJobId();
    els.status.textContent = "Loading…";
    els.pdfState.textContent = "Not generated";
    els.pdfFrame.src = "";

    let root = null;
    try {
      root = await loadJob(jobId);
      els.status.textContent = jobId ? "Loaded from job" : "Loaded";
    } catch (e) {
      const local = loadLocalDraft();
      if (local) {
        root = local;
        els.status.textContent = "Loaded from local draft (fallback)";
      } else {
        root = { error: "No job payload and no local draft found." };
        els.status.textContent = "No data found";
      }
    }

    const extracted = extractRfoPayload(root);
    const rfo = extracted.rfo || {};

    renderInputs(rfo, jobId, root);

    els.btnFill.disabled = false;
    els.btnFill.onclick = async () => {
      try {
        els.btnFill.disabled = true;
        els.pdfState.textContent = "Generating…";
        els.debug.textContent = "Working…";

        const { outBytes, debug, results } = await generateFilledPdf(rfo);

        els.debug.textContent = safeJson({ debug, results });
        setPdfBlob(outBytes);

        els.btnFill.disabled = false;
      } catch (err) {
        els.pdfState.textContent = "Failed to generate";
        els.debug.textContent = safeJson({
          error: String(err?.message || err),
          hint: "If this fails, we stop and move on (per your rule)."
        });
        els.btnFill.disabled = false;
      }
    };

    // Auto-generate once on load (so you see immediately if it works)
    setTimeout(() => els.btnFill.click(), 250);
  }

  main().catch((e) => {
    els.status.textContent = "Crash";
    els.debug.textContent = safeJson({ error: String(e?.message || e) });
  });
})();
