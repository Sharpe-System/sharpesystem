export const rfoFlow = {
  id: "rfo",
  title: "Request for Order (RFO)",
  stages: ["start","intake","build","review","export"],

  render(stage, ctx) {
    if (stage === "start") return renderStart(ctx);
    if (stage === "intake") return renderIntake(ctx);
    if (stage === "build") return renderBuild(ctx);
    if (stage === "review") return renderReview(ctx);
    if (stage === "export") return renderExport(ctx);
  }
};

function renderStart(ctx) {
  ctx.stageEl.innerHTML = `
    <h2>Start your Request for Order</h2>
    <p class="muted">
      SharpeSystem will guide you step-by-step to prepare clear, court-ready filings.
    </p>

    <div class="card" style="margin-top:14px;">
      <p><strong>What happens next</strong></p>
      <ul>
        <li>Enter case + custody details</li>
        <li>Define requested orders</li>
        <li>Build declaration + exhibits</li>
        <li>Export court-ready packet</li>
      </ul>
    </div>
  `;
}

function renderIntake(ctx) {
  ctx.stageEl.innerHTML = `
    <h2>Case information</h2>
    <p class="muted">Enter the basic court and party details.</p>

    <div class="card" style="margin-top:14px;">
      <label class="field">
        <span class="label">Court county</span>
        <input class="input" />
      </label>

      <label class="field">
        <span class="label">Case number</span>
        <input class="input" />
      </label>
    </div>
  `;
}

function renderBuild(ctx) {
  ctx.stageEl.innerHTML = `
    <h2>Define requested orders</h2>
    <p class="muted">
      Tell the court exactly what you want changed and why.
    </p>

    <div class="card" style="margin-top:14px;">
      <label class="field">
        <span class="label">Orders requested</span>
        <textarea class="input" rows="6"></textarea>
      </label>
    </div>
  `;
}

function renderReview(ctx) {
  ctx.stageEl.innerHTML = `
    <h2>Review your filing</h2>
    <p class="muted">
      Confirm clarity and completeness before export.
    </p>

    <div class="card" style="margin-top:14px;">
      <p>SharpeSystem will format this into court-ready structure.</p>
    </div>
  `;
}

function renderExport(ctx) {
  ctx.stageEl.innerHTML = `
    <h2>Export your court-ready RFO</h2>

    <p class="muted">
      Public drafting is free. Exporting print-ready filings requires login.
    </p>

    <div class="card" style="margin-top:14px;">
      <div class="row" style="gap:10px; flex-wrap:wrap;">
        <a class="btn primary" href="/rfo/public-print.html">Preview readiness</a>
        <a class="btn" href="/login.html?next=/rfo/print.html">Login to print</a>
        <a class="btn" href="/rfo/start.html">Back to start</a>
      </div>
    </div>
  `;
}
