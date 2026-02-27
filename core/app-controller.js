/* /core/app-controller.js
   Canonical plugin-driven app controller (v1)

   Contract:
   - Single editing surface: /app.html?flow=&stage=
   - Flow plugins may provide:
       export const <id>Flow = { id, title, stages:[], render(stage, ctx) }
   - Controller owns:
       - stage routing
       - draft read/write (localStorage for now)
       - export flow actions live inside the flow plugin (job creation + redirect)
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
    if (flowId === "dvro_response") {
      const mod = await import("/flows/dvro_response/dvro-response-flow.js");
      return mod.dvroResponseFlow || null;
    }

      const mod = await import("/flows/rfo/rfo-flow.js");
      return mod.rfoFlow || null;
    }
    if (flowId === "pleading") {
      const mod = await import("/flows/pleading/pleading-flow.js");
      return mod.pleadingFlow || null;
    }
    return null;
  }

  const url = new URL(location.href);
  const flow = (url.searchParams.get("flow") || "rfo").trim();
  const stageFromUrl = (url.searchParams.get("stage") || "start").trim();

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

  (async function main() {
    const flowPlugin = await loadFlow(flow);

    const stages = Array.isArray(flowPlugin?.stages) && flowPlugin.stages.length
      ? flowPlugin.stages
      : ["start", "build", "review", "export"];

    let stageIdx = stages.indexOf(stageFromUrl);
    if (stageIdx < 0) {
      setStageParam(stages[0], true);
      return;
    }

    if (titleEl) titleEl.textContent = flowPlugin?.title ? flowPlugin.title : `Flow: ${flow}`;
    if (subEl) subEl.textContent = `Stage: ${stages[stageIdx]}`;

    function updateNavUI() {
      prevBtn.disabled = stageIdx <= 0;
      nextBtn.disabled = stageIdx >= (stages.length - 1);

      if (stages[stageIdx] === "review") nextBtn.textContent = "Export";
      else nextBtn.textContent = "Next";

      if (stages[stageIdx] === "export") nextBtn.style.display = "none";
      else nextBtn.style.display = "";
    }

    function gotoStage(idx) {
      const nextIdx = clamp(idx, 0, stages.length - 1);
      const nextStage = stages[nextIdx];
      setStageParam(nextStage, false);
    }

    async function render() {
      if (subEl) subEl.textContent = `Stage: ${stages[stageIdx]}`;

      try {
        if (flowPlugin && typeof flowPlugin.render === "function") {
          flowPlugin.render(stages[stageIdx], {
            stageEl,
            flow,
            stage: stages[stageIdx],
            readDraftData,
            writeDraftData
          });
        } else {
          stageEl.innerHTML = `
            <h2>${esc(stages[stageIdx])}</h2>
            <p class="muted">No flow plugin loaded for <code>${esc(flow)}</code>.</p>
          `;
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

    prevBtn.addEventListener("click", () => gotoStage(stageIdx - 1));
    nextBtn.addEventListener("click", () => gotoStage(stageIdx + 1));
    if (exitBtn) exitBtn.addEventListener("click", () => { location.href = (new URL(location.href).searchParams.get("return") || "/home.html"); });

    await render();
  })().catch((e) => {
    console.error("App controller init failed:", e);
    stageEl.innerHTML = `<pre>${esc(String(e?.stack || e))}</pre>`;
  });
})();
