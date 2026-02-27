export const rfoFlow = {
  stages: ["start","build","export"],
  render(ctx, stage) {
    if (stage === "start") return renderStart(ctx);
    if (stage === "build") return renderBuild(ctx);
    if (stage === "export") return renderExport(ctx);
    return "<p>Stage not found</p>";
  }
};

function renderStart(ctx){
  return `
  <h2>Start your Request for Order</h2>
  <p class="muted">
    SharpeSystem guides you through custody, visitation, and support requests step-by-step,
    translating your goals into court-ready language and properly structured filings.
  </p>

  <div class="card" style="margin-top:16px;">
    <h3>What you’ll do here</h3>
    <ul>
      <li>Describe the orders you want</li>
      <li>Explain why they’re needed</li>
      <li>Organize facts the court considers</li>
    </ul>
  </div>

  <div class="row" style="margin-top:18px; gap:10px;">
    <a class="btn primary" href="?flow=rfo&stage=build">Continue</a>
    <a class="btn" href="/rfo/start.html">Exit</a>
  </div>
  `;
}

function renderBuild(ctx){
  return `
  <h2>Turn your goals into enforceable court orders</h2>

  <p class="muted">
    Courts don’t grant intentions — they grant specific orders.
    This stage converts what you want into structured requests the judge can sign.
  </p>

  <div class="grid-2" style="margin-top:16px; gap:14px;">

    <div class="card" style="padding:14px; border-left:4px solid #5b8cff;">
      <h3 style="margin-top:0;">You describe</h3>
      <ul>
        <li>Custody / visitation changes</li>
        <li>Schedule problems</li>
        <li>Support adjustments</li>
        <li>Safety concerns</li>
      </ul>
    </div>

    <div class="card" style="padding:14px; border-left:4px solid #22a06b;">
      <h3 style="margin-top:0;">SharpeSystem structures</h3>
      <ul>
        <li>FL-300 request language</li>
        <li>Legal phrasing courts expect</li>
        <li>Logical order of facts</li>
        <li>Declaration paragraphs</li>
      </ul>
    </div>

  </div>

  <div class="card" style="margin-top:16px; background:#f6f9ff;">
    <strong>Result:</strong>
    A clean, organized request the court can read quickly and act on —
    instead of handwritten or scattered paperwork that risks rejection.
  </div>

  <div class="row" style="margin-top:20px; gap:10px;">
    <a class="btn primary" href="?flow=rfo&stage=export">Next: Export</a>
    <a class="btn" href="?flow=rfo&stage=start">Back</a>
  </div>
  `;
}

function renderExport(ctx){
  return `
  <h2>Get your “Perfect Print” filing set</h2>

  <p class="muted">
    You’ve entered your requests. SharpeSystem can now generate a
    court-ready packet that clerks accept without readability or format issues.
  </p>

  <div class="grid-2" style="margin-top:16px; gap:14px;">

    <div class="card" style="padding:14px; border-left:4px solid #5b8cff;">
      <h3 style="margin-top:0;">What you receive</h3>
      <ul>
        <li>FL-300 mapped correctly</li>
        <li>Typed declaration</li>
        <li>Exhibit index</li>
        <li>Filing checklist</li>
      </ul>
    </div>

    <div class="card" style="padding:14px; border-left:4px solid #ff9f1c;">
      <h3 style="margin-top:0;">Why it matters</h3>
      <ul>
        <li>No illegible handwriting</li>
        <li>No missing fields</li>
        <li>No clerk rejection</li>
        <li>Faster filing visit</li>
      </ul>
    </div>

  </div>

  <div class="card" style="margin-top:16px; background:#fff8ef;">
    Many users complete filing in a single courthouse trip —
    avoiding re-visits caused by incomplete paperwork.
  </div>

  <div class="row" style="margin-top:20px; gap:10px; flex-wrap:wrap;">
    <a class="btn primary" href="/rfo/public-print.html">Preview readiness</a>
    <a class="btn" href="/login.html?next=/rfo/print.html">Unlock print</a>
    <a class="btn" href="?flow=rfo&stage=build">Back</a>
  </div>
  `;
}
