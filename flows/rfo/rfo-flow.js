/* /flows/rfo/rfo-flow.js
   RFO Flow Plugin (v1)
   Interview-style UI (non-form) that writes draft data.
   The official court form is generated/previewed later.
*/

export const rfoFlow = {
  id: "rfo",
  title: "Request for Order (RFO)",
  stages: ["intake", "build", "review", "export"],

  render(stage, ctx) {
    if (stage === "intake") return renderIntake(ctx);
    if (stage === "build") return renderBuild(ctx);
    if (stage === "review") return renderReview(ctx);
    if (stage === "export") return renderExport(ctx);
    return renderIntake(ctx);
  }
};

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function read(ctx) {
  const d = ctx.readDraftData?.() || {};
  d.rfo = d.rfo || {};
  return d;
}

function write(ctx, d) {
  ctx.writeDraftData?.(d);
}

function renderIntake(ctx) {
  const d = read(ctx);
  const r = d.rfo;

  ctx.stageEl.innerHTML = `
    <h2>RFO Interview</h2>
    <div class="card" style="padding:14px; margin-top:12px;">
      <h3 style="margin:0 0 6px 0;">What you are doing here</h3>
      <p class="muted" style="margin:0;">
        This interview captures the minimum case metadata needed to route you into a court-ready build path.
        Your answers are saved locally on this device.
      </p>
      <div class="hr" style="margin:12px 0;"></div>
      <ul style="margin:0 0 0 18px;">
        <li><strong>Be precise</strong>: county, branch, case number, and your role must match your filings.</li>
        <li><strong>Plain English is fine</strong>: you will refine language later in the build and review stages.</li>
        <li><strong>Prefer agreement if realistic</strong>: Amicable and Peace Path are available before adversarial filing.</li>
      </ul>
      <div class="row" style="margin-top:12px; gap:10px; flex-wrap:wrap;">
        <a class="btn" href="/amicable.html">Amicable Path</a>
        <a class="btn" href="/peace-path.html">Peace Path</a>
      </div>
      <div class="small soft" style="margin-top:10px;">Not legal advice. Procedural guidance + document organization only.</div>
    </div>
    <p class="muted">Answer in plain English. We’ll show the official form at the end.</p>

    <div class="card" style="margin-top:12px;">
      <label class="label">Court county</label>
      <input class="input" id="rfo_county" placeholder="e.g., Orange" value="${esc(r.county || "")}" />

      <label class="label" style="margin-top:10px;">Courthouse / Branch</label>
      <input class="input" id="rfo_branch" placeholder="e.g., Lamoreaux Justice Center" value="${esc(r.branch || "")}" />

      <div class="row" style="gap:10px; margin-top:12px; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px;">
          <label class="label">Case number</label>
          <input class="input" id="rfo_case" placeholder="XX-XXXXXX" value="${esc(r.caseNumber || "")}" />
        </div>
        <div style="flex:1; min-width:220px;">
          <label class="label">Your role</label>
          <select class="input" id="rfo_role">
            ${opt(r.role, "", "Select…")}
            ${opt(r.role, "petitioner", "Petitioner")}
            ${opt(r.role, "respondent", "Respondent")}
            ${opt(r.role, "other", "Other")}
          </select>
        </div>
      </div>
    </div>

    <p class="muted" style="margin-top:10px;">Saved locally for now (browser storage).</p>
  `;

  wireSave(ctx, {
    county: "#rfo_county",
    branch: "#rfo_branch",
    caseNumber: "#rfo_case",
    role: "#rfo_role"
  });
}

function renderBuild(ctx) {
  const d = read(ctx);
  const r = d.rfo;

  ctx.stageEl.innerHTML = `
    <h2>Requests</h2>
    <p class="muted">Select what you’re requesting. Keep it simple.</p>

    <div class="card" style="margin-top:12px;">
      <label class="row" style="align-items:center; gap:10px;">
        <input type="checkbox" id="req_custody" ${r.reqCustody ? "checked" : ""} />
        <span>Child custody / visitation</span>
      </label>

      <label class="row" style="align-items:center; gap:10px; margin-top:10px;">
        <input type="checkbox" id="req_support" ${r.reqSupport ? "checked" : ""} />
        <span>Child support</span>
      </label>

      <label class="row" style="align-items:center; gap:10px; margin-top:10px;">
        <input type="checkbox" id="req_other" ${r.reqOther ? "checked" : ""} />
        <span>Other</span>
      </label>

      <div style="margin-top:12px;">
        <label class="label">Requested orders (plain English)</label>
        <textarea class="input" id="req_details" rows="7"
          placeholder="Example: Modify schedule to Tue/Thu + alternating weekends; adjust holiday schedule; recalculate guideline support…">${esc(r.requestDetails || "")}</textarea>
      </div>
    </div>
  `;

  const save = () => {
    const d2 = read(ctx);
    d2.rfo.reqCustody = !!document.querySelector("#req_custody")?.checked;
    d2.rfo.reqSupport = !!document.querySelector("#req_support")?.checked;
    d2.rfo.reqOther = !!document.querySelector("#req_other")?.checked;
    d2.rfo.requestDetails = (document.querySelector("#req_details")?.value || "").trim();
    write(ctx, d2);
  };

  ["#req_custody", "#req_support", "#req_other"].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener("change", save);
  });
  const ta = document.querySelector("#req_details");
  if (ta) ta.addEventListener("input", save);
}

function renderReview(ctx) {
  const d = read(ctx);
  const r = d.rfo;

  ctx.stageEl.innerHTML = `
    <h2>Review</h2>
    <p class="muted">Summary of your interview answers. Next step generates output.</p>

    <div class="card" style="margin-top:12px;">
      <div><strong>County:</strong> ${esc(r.county || "—")}</div>
      <div><strong>Branch:</strong> ${esc(r.branch || "—")}</div>
      <div><strong>Case #:</strong> ${esc(r.caseNumber || "—")}</div>
      <div><strong>Role:</strong> ${esc(r.role || "—")}</div>

      <hr style="margin:12px 0; opacity:.25;">

      <div><strong>Requests:</strong></div>
      <ul style="margin-top:6px;">
        <li>Custody/Visitation: ${r.reqCustody ? "Yes" : "No"}</li>
        <li>Child Support: ${r.reqSupport ? "Yes" : "No"}</li>
        <li>Other: ${r.reqOther ? "Yes" : "No"}</li>
      </ul>

      <div style="margin-top:8px;"><strong>Details:</strong></div>
      <div style="white-space:pre-wrap; margin-top:6px;">${esc(r.requestDetails || "—")}</div>
    </div>

    <p class="muted" style="margin-top:10px;">Click <strong>Export</strong> to continue.</p>
  `;
}

function wireSave(ctx, map) {
  function save() {
    const d = read(ctx);
    for (const [k, sel] of Object.entries(map)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      d.rfo[k] = String(el.value || "").trim();
    }
    write(ctx, d);
  }

  for (const sel of Object.values(map)) {
    const el = document.querySelector(sel);
    if (!el) continue;
    el.addEventListener("change", save);
    el.addEventListener("input", save);
  }
}

function opt(current, value, label) {
  const sel = String(current ?? "") === String(value) ? "selected" : "";
  return `<option value="${esc(value)}" ${sel}>${esc(label)}</option>`;
}

function renderExport(ctx) {
  const d = ctx.readDraftData?.() || {};
  const r = d.rfo || {};

  ctx.stageEl.innerHTML = `
    <h2>Export your court-ready RFO</h2>

    <p class="muted">
      Your draft is saved locally on this device.
      SharpeSystem can now generate court-ready filings and exhibits.
    </p>

    <div class="card" style="margin-top:14px;">
      <p>
        <strong>Public drafting is free.</strong><br>
        Exporting filing-ready documents requires a SharpeSystem account.
      </p>

      <div class="row" style="gap:10px; margin-top:12px; flex-wrap:wrap;">
        <a class="btn primary" href="/rfo/public-print.html">Preview readiness</a>
        <a class="btn" href="/login.html?next=/rfo/print.html">Login to print</a>
        <a class="btn" href="/rfo/start.html">Back to draft</a>
      </div>
    </div>
  `;
}

