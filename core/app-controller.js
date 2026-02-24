/* /core/app-controller.js
   Canonical plugin-driven app controller (v1)

   Contract:
   - Single editing surface: /app.html?flow=&stage=
   - Flow plugins may provide:
       export const <id>Flow = { id, title, stages:[], render(stage, ctx) }
   - Controller owns:
       - stage routing
       - draft read/write (localStorage for now)
       - export stub routing to /print.html?job=
*/

(function () {
  "use strict";

  function $(sel, root = document) { return root.querySelector(sel); }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function loadFlow(flowId) {
    if (flowId === "rfo") {
      const mod = await import("/flows/rfo/rfo-flow.js");
      return mod.rfoFlow || null;
    }
    return null;
  }

  // ---------- URL state ----------
  const url = new URL(location.href);
  const flow = (url.searchParams.get("flow") || "rfo").trim();
  const stageFromUrl = (url.searchParams.get("stage") || "intake").trim();

  // ---------- DOM ----------
  const stageEl = $("#stage");
  const titleEl = $("#flowTitle");
  const subEl = $("#flowSub");
  const prevBtn = $("#btnPrev");
  const nextBtn = $("#btnNext");
  const exitBtn = $("#btnExit");

  if (!stageEl || !prevBtn || !nextBtn) {
    console.error("App controller: missing required DOM nodes (#stage/#btnPrev/#btnNext).");
    return;
  }

  // ---------- Draft storage ----------
  const DRAFT_KEY = `ss:draft:${flow}`;

  function readDraftData() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.warn("Draft read failed:", e);
      return {};
    }
  }

  function writeDraftData(data) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data || {}));
    } catch (e) {
      console.warn("Draft write failed:", e);
    }
  }

  // ---------- Navigation helpers ----------
  function setStageParam(nextStage, replace = false) {
    const u = new URL(location.href);
    u.searchParams.set("flow", flow);
    u.searchParams.set("stage", nextStage);
    if (replace) location.replace(u.toString());
    else location.href = u.toString();
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function renderExportStub() {
    const d = readDraftData();
    stageEl.innerHTML = `
      <h2>Export</h2>
      <p class="muted">This is the export stub. It creates a print job and opens the print surface.</p>

      <div class="card" style="margin-top:12px;">
        <div class="muted" style="margin-bottom:10px;">Flow: <code>${esc(flow)}</code></div>
        <pre style="white-space:pre-wrap; margin:0; opacity:.9;">${esc(JSON.stringify(d, null, 2))}</pre>

        <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn primary" id="btnGenerate">Generate print job</button>
          <button class="btn" id="btnClearDraft">Clear local draft</button>
        </div>
      </div>
    `;

    const gen = $("#btnGenerate");
    const clr = $("#btnClearDraft");

    if (gen) {
      gen.addEventListener("click", () => {
        // v1: jobId is client-generated; /api/jobs/:id is stubbed anyway.
        const jobId = (crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(16).slice(2)));
        location.href = "/print.html?job=" + encodeURIComponent(jobId);
      });
    }
    if (clr) {
      clr.addEventListener("click", () => {
        localStorage.removeItem(DRAFT_KEY);
        location.reload();
      });
    }
  }

  // ---------- Main ----------
  (async function main() {
    const flowPlugin = await loadFlow(flow);

    const stages = Array.isArray(flowPlugin?.stages) && flowPlugin.stages.length
      ? flowPlugin.stages
      : ["intake", "build", "review", "export"];

    let stageIdx = stages.indexOf(stageFromUrl);
    if (stageIdx < 0) {
      // Normalize unknown stage to first stage and fix URL once.
      setStageParam(stages[0], true);
      return;
    }

    // Header copy
    if (titleEl) titleEl.textContent = `Flow: ${flow}`;
    if (subEl) subEl.textContent = `Stage: ${stages[stageIdx]}`;

    function updateNavUI() {
      prevBtn.disabled = stageIdx <= 0;
      nextBtn.disabled = stageIdx >= (stages.length - 1);

      // Stage-specific CTA labeling
      if (stages[stageIdx] === "review") nextBtn.textContent = "Export";
      else nextBtn.textContent = "Next";

      // Hide Next on export stage (export has its own primary action)
      if (stages[stageIdx] === "export") nextBtn.style.display = "none";
      else nextBtn.style.display = "";
    }

    function gotoStage(idx) {
      const nextIdx = clamp(idx, 0, stages.length - 1);
      const nextStage = stages[nextIdx];
      setStageParam(nextStage, false);
    }

    async function render() {
      // Update header each render
      if (subEl) subEl.textContent = `Stage: ${stages[stageIdx]}`;

      try {
        if (flowPlugin && typeof flowPlugin.render === "function") {
          // Provide a stable ctx contract
          flowPlugin.render(stages[stageIdx], {
            stageEl,
            flow,
            stage: stages[stageIdx],
            readDraftData,
            writeDraftData,
            renderExport: renderExportStub
          });
        } else {
          // Minimal fallback if no plugin loads
          if (stages[stageIdx] === "export") renderExportStub();
          else {
            stageEl.innerHTML = `
              <h2>${esc(stages[stageIdx])}</h2>
              <p class="muted">No flow plugin loaded for <code>${esc(flow)}</code>.</p>
            `;
          }
        }
      } catch (e) {
        console.error("Flow render failed:", e);
        stageEl.innerHTML = `
          <h2>Render error</h2>
          <p class="muted">The flow plugin crashed while rendering this stage.</p>
          <pre style="white-space:pre-wrap;">${esc(String(e?.stack || e))}</pre>
        `;
      }

      updateNavUI();
    }

    // Wire nav
    prevBtn.addEventListener("click", () => gotoStage(stageIdx - 1));
    nextBtn.addEventListener("click", () => gotoStage(stageIdx + 1));

    // Exit just returns to home (safe default)
    if (exitBtn) exitBtn.addEventListener("click", () => { location.href = "/home.html"; });

    // If user navigated via URL, stageIdx needs to track current stage
    // (We re-run controller on each page load; so just render once here.)
    await render();
  })().catch((e) => {
    console.error("App controller init failed:", e);
    stageEl.innerHTML = `<pre>${esc(String(e?.stack || e))}</pre>`;
  });
})();
