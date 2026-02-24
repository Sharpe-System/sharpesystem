/* /core/app-controller.js
   App controller: /app.html?flow=&stage=
   v1: local-only state (localStorage). No Firestore yet.
   Enforces linear stage order and provides a single render mount.
*/
(function () {
  "use strict";

  function $(sel, root = document) { return root.querySelector(sel); }

  const params = new URLSearchParams(location.search);
  const flow = (params.get("flow") || "").trim();
  const stage = (params.get("stage") || "").trim() || "intake";

  // If no flow is specified, app.html behaves as the legacy hub.
  if (!flow) return;

  const STAGES = ["intake", "build", "review", "export"];
  const stageIdx = STAGES.indexOf(stage);

  function hardRedirect(toStage) {
    const u = new URL(location.href);
    u.searchParams.set("flow", flow);
    u.searchParams.set("stage", toStage);
    location.replace(u.toString());
  }

  if (stageIdx === -1) hardRedirect("intake");

  const storageKey = `draft:${flow}:v1`;

  function readDraft() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : { meta: { flow, version: 1 }, data: {} };
    } catch (_) {
      return { meta: { flow, version: 1 }, data: {} };
    }
  }

  function writeDraft(draft) {
    localStorage.setItem(storageKey, JSON.stringify(draft));
  }

  // Stage guard: prevent skipping ahead if required prerequisites are missing.
  function canEnter(targetStage) {
    const d = readDraft();
    const hasAny = d && d.data && Object.keys(d.data).length > 0;

    if (targetStage === "intake") return true;
    if (targetStage === "build") return hasAny;         // must have intake started
    if (targetStage === "review") return hasAny;        // placeholder; will tighten later
    if (targetStage === "export") return hasAny;        // placeholder; will tighten later
    return false;
  }

  if (!canEnter(stage)) hardRedirect("intake");

  // Replace hub card with a controller surface.
  const main = $("main.page");
  if (!main) return;

  main.innerHTML = `
    <div class="container content">
      <section class="card">
        <div class="row" style="justify-content:space-between; align-items:center; gap:12px;">
          <div>
            <h1 style="margin:0;">Flow: ${escapeHtml(flow)}</h1>
            <p class="muted" style="margin:6px 0 0;">Stage: ${escapeHtml(stage)}</p>
          </div>
          <div class="row" style="gap:10px; flex-wrap:wrap;">
            <a class="button" href="/app.html">Exit</a>
          </div>
        </div>
        <hr style="margin:14px 0; opacity:.25;">
        <div id="app-stage"></div>
        <div class="row" style="margin-top:14px; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <button class="button" id="prevBtn" type="button">Back</button>
          <button class="button primary" id="nextBtn" type="button">Next</button>
        </div>
      </section>
    </div>
  `;

  const stageEl = $("#app-stage");
  const prevBtn = $("#prevBtn");
  const nextBtn = $("#nextBtn");

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function gotoStage(i) {
    const s = STAGES[i];
    if (!s) return;
    const u = new URL(location.href);
    u.searchParams.set("flow", flow);
    u.searchParams.set("stage", s);
    location.href = u.toString();
  }

  // Minimal stage renderers (stubs). We will replace these with flow plugins.
  function renderIntake() {
    const d = readDraft();
    stageEl.innerHTML = `
      <h2>Intake (stub)</h2>
      <p class="muted">This is the first enforced stage. Enter anything to create draft state.</p>
      <label class="label">One field to prove persistence</label>
      <input class="input" id="intakeField" placeholder="type something..." value="${escapeHtml(d.data.intakeField || "")}">
    `;
    const input = $("#intakeField");
    input.addEventListener("input", () => {
      const draft = readDraft();
      draft.data.intakeField = input.value;
      writeDraft(draft);
    });
  }

  function renderBuild() {
    const d = readDraft();
    stageEl.innerHTML = `
      <h2>Build (stub)</h2>
      <p class="muted">Proof that stage navigation is linear and draft is shared.</p>
      <div class="card" style="padding:12px;">
        <div><strong>intakeField:</strong> ${escapeHtml(d.data.intakeField || "(empty)")}</div>
      </div>
    `;
  }

  function renderReview() {
    const d = readDraft();
    stageEl.innerHTML = `
      <h2>Review (stub)</h2>
      <pre style="white-space:pre-wrap; overflow:auto; max-height:320px; padding:12px; border:1px solid rgba(127,127,127,.25); border-radius:12px;">${escapeHtml(JSON.stringify(d, null, 2))}</pre>
    `;
  }

  function renderExport() {
    stageEl.innerHTML = `
      <h2>Export (stub)</h2>
      <p class="muted">Next step will be POST /api/pdf/fill and create a Job.</p>
      <p class="muted">For now this is just a placeholder stage.</p>
    `;
  }

  function render() {
    if (stage === "intake") renderIntake();
    else if (stage === "build") renderBuild();
    else if (stage === "review") renderReview();
    else if (stage === "export") renderExport();

    prevBtn.disabled = stageIdx <= 0;
    nextBtn.disabled = stageIdx >= (STAGES.length - 1);
  }

  prevBtn.addEventListener("click", () => gotoStage(stageIdx - 1));
  nextBtn.addEventListener("click", () => gotoStage(stageIdx + 1));

  render();
})();
