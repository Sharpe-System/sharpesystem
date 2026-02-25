function $(sel, root = document) { return root.querySelector(sel); }

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readModel(ctx) {
  const d = ctx.readDraftData() || {};
  const m = d && typeof d === "object" ? (d.pleading || {}) : {};
  return m && typeof m === "object" ? m : {};
}

function writeModel(ctx, patch) {
  const d = ctx.readDraftData() || {};
  const next = Object.assign({}, d, { pleading: Object.assign({}, (d.pleading || {}), (patch || {})) });
  ctx.writeDraftData(next);
}

function requiredMissing(m) {
  const missing = [];
  if (!String(m.courtName || "").trim()) missing.push("courtName");
  if (!String(m.caseNumber || "").trim()) missing.push("caseNumber");
  if (!String(m.petitioner || "").trim()) missing.push("petitioner");
  if (!String(m.respondent || "").trim()) missing.push("respondent");
  if (!String(m.documentTitle || "").trim()) missing.push("documentTitle");
  if (!String(m.bodyText || "").trim()) missing.push("bodyText");
  return missing;
}

async function createJob(ctx) {
  const d = ctx.readDraftData() || {};
  const body = {
    flow: "pleading",
    form: "pleading28",
    draft: d
  };

  const res = await fetch("/api/jobs/create", {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json" },
    body: JSON.stringify(body)
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || !json.ok || !json.jobId) {
    const msg = json ? JSON.stringify(json, null, 2) : "Job creation failed.";
    throw new Error(msg);
  }
  return json.jobId;
}

function inputRow(label, id, value, placeholder) {
  return `
    <div class="card" style="padding:12px; margin-bottom:10px;">
      <div class="muted" style="margin-bottom:6px;">${esc(label)}</div>
      <input id="${esc(id)}" class="input" style="width:100%;" value="${esc(value || "")}" placeholder="${esc(placeholder || "")}" />
    </div>
  `;
}

function textareaRow(label, id, value, placeholder, rows = 14) {
  return `
    <div class="card" style="padding:12px; margin-bottom:10px;">
      <div class="muted" style="margin-bottom:6px;">${esc(label)}</div>
      <textarea id="${esc(id)}" class="input" style="width:100%; min-height: ${rows * 18}px;" placeholder="${esc(placeholder || "")}">${esc(value || "")}</textarea>
    </div>
  `;
}

export const pleadingFlow = {
  id: "pleading",
  title: "Pleading Paper (CA 28-line)",
  stages: ["start", "build", "review", "export"],

  render(stage, ctx) {
    const m = readModel(ctx);

    if (stage === "start") {
      ctx.stageEl.innerHTML = `
        <h2>Pleading Paper</h2>
        <p class="muted">Create a California 28-line pleading paper PDF via the canonical job model.</p>

        <div class="card" style="margin-top:12px; padding:12px;">
          <div class="muted">This flow stores its draft at:</div>
          <div class="mono"><code>localStorage["ss:draft:pleading"]</code></div>
        </div>
      `;
      return;
    }

    if (stage === "build") {
      ctx.stageEl.innerHTML = `
        <h2>Build</h2>
        ${inputRow("Court name (required)", "courtName", m.courtName, "Superior Court of California")}
        ${inputRow("County (optional)", "county", m.county, "Orange")}
        ${inputRow("Case number (required)", "caseNumber", m.caseNumber, "30-2026-0XXXXXXX")}
        ${inputRow("Petitioner (required)", "petitioner", m.petitioner, "Petitioner name")}
        ${inputRow("Respondent (required)", "respondent", m.respondent, "Respondent name")}
        ${inputRow("Filing party (optional)", "filingParty", m.filingParty, "Your name / party")}
        ${inputRow("Attorney name (optional)", "attorneyName", m.attorneyName, "Attorney name")}
        ${inputRow("Attorney bar (optional)", "attorneyBar", m.attorneyBar, "State Bar No.")}
        ${inputRow("Attorney address (optional)", "attorneyAddress", m.attorneyAddress, "Address / phone / email")}
        ${inputRow("Document title (required)", "documentTitle", m.documentTitle, "DECLARATION OF ...")}
        ${textareaRow("Body text (required)", "bodyText", m.bodyText, "Text with preserved line breaks", 18)}
        <div class="muted" style="margin-top:10px;">Draft saves automatically on change.</div>
      `;

      const ids = [
        "courtName","county","caseNumber","petitioner","respondent","filingParty",
        "attorneyName","attorneyBar","attorneyAddress","documentTitle","bodyText"
      ];

      for (const id of ids) {
        const el = $("#" + id, ctx.stageEl);
        if (!el) continue;
        el.addEventListener("input", () => {
          const patch = {};
          patch[id] = el.value;
          writeModel(ctx, patch);
        });
      }
      return;
    }

    if (stage === "review") {
      const missing = requiredMissing(m);
      const ok = missing.length === 0;

      ctx.stageEl.innerHTML = `
        <h2>Review</h2>
        <p class="muted">${ok ? "All required fields are present." : "Missing required fields:"}</p>
        ${ok ? "" : `<div class="card" style="padding:12px; margin-bottom:12px;"><code>${esc(missing.join(", "))}</code></div>`}

        <div class="card" style="padding:12px;">
          <div class="muted" style="margin-bottom:8px;">Preview (draft JSON)</div>
          <pre style="white-space:pre-wrap; margin:0;">${esc(JSON.stringify({ pleading: m }, null, 2))}</pre>
        </div>
      `;
      return;
    }

    if (stage === "export") {
      const missing = requiredMissing(m);

      ctx.stageEl.innerHTML = `
        <h2>Export</h2>
        <p class="muted">Creates an immutable job via <code>/api/jobs/create</code> then opens <code>/print.html?job=</code>.</p>

        ${missing.length ? `
          <div class="card" style="padding:12px; margin-top:12px;">
            <div class="muted">Cannot export. Missing:</div>
            <div class="mono"><code>${esc(missing.join(", "))}</code></div>
          </div>
        ` : `
          <div class="card" style="padding:12px; margin-top:12px;">
            <button id="btnGenerate" class="btn primary">Generate print job</button>
            <div id="status" class="muted" style="margin-top:10px;"></div>
          </div>
        `}

        <div class="card" style="padding:12px; margin-top:12px;">
          <button id="btnClear" class="btn">Clear local draft</button>
        </div>
      `;

      const clr = $("#btnClear", ctx.stageEl);
      if (clr) {
        clr.addEventListener("click", () => {
          try { localStorage.removeItem(`ss:draft:${ctx.flow}`); } catch (_) {}
          location.reload();
        });
      }

      if (!missing.length) {
        const btn = $("#btnGenerate", ctx.stageEl);
        const status = $("#status", ctx.stageEl);

        if (btn) {
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            if (status) status.textContent = "Creating job...";
            try {
              const jobId = await createJob(ctx);
              location.href = "/print.html?job=" + encodeURIComponent(jobId);
            } catch (e) {
              if (status) status.textContent = "Error: " + String(e?.message || e);
              btn.disabled = false;
            }
          });
        }
      }
      return;
    }

    ctx.stageEl.innerHTML = `<h2>${esc(stage)}</h2><p class="muted">Unknown stage.</p>`;
  }
};
