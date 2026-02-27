/* /core/app-controller.js
   Canonical plugin-driven app controller (stable)
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
    if (flowId === "dvro_response") {
      const mod = await import("/flows/dvro_response/dvro-response-flow.js");
      return mod.dvroResponseFlow || null;
    }
    if (flowId === "pleading") {
      const mod = await import("/flows/pleading/pleading-flow.js");
      return mod.pleadingFlow || null;
    }
    return null;
  }

  const url = new URL(location.href);
  const flow = (url.searchParams.get("flow") || "rfo").trim();
  const stageFromUrl = (url.searchParams.get("stage") || "intake").trim();

  const stageEl = $("#stage");
  const titleEl = $("#flowTitle");
  const subEl = $("#flowSub");
  const prevBtn = $("#btnPrev");
  const nextBtn = $("#btnNext");
  const exitBtn = $("#btnExit");

  if (!stageEl || !prevBtn || !nextBtn) {
    console.error("Controller missing DOM");
    return;
  }

  const DRAFT_KEY = `ss:draft:${flow}`;

  function readDraftData() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  function writeDraftData(data) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data || {}));
    } catch {}
  }

  function setStage(nextStage) {
    const u = new URL(location.href);
    u.searchParams.set("flow", flow);
    u.searchParams.set("stage", nextStage);
    location.href = u.toString();
  }

  (async function main() {
    const flowPlugin = await loadFlow(flow);
    if (!flowPlugin) {
      stageEl.innerHTML = "<p>No flow plugin</p>";
      return;
    }

    const stages = flowPlugin.stages || ["intake","build","review","export"];
    let stageIdx = stages.indexOf(stageFromUrl);
    if (stageIdx < 0) stageIdx = 0;

    if (titleEl) titleEl.textContent = flowPlugin.title || flow;
    if (subEl) subEl.textContent = "Stage: " + stages[stageIdx];

    prevBtn.onclick = () => {
      if (stageIdx > 0) setStage(stages[stageIdx - 1]);
    };

    nextBtn.onclick = () => {
      if (stageIdx < stages.length - 1)
        setStage(stages[stageIdx + 1]);
    };

    if (exitBtn)
      exitBtn.onclick = () => location.href = "/rfo/start.html";

    try {
      flowPlugin.render(stages[stageIdx], {
        stageEl,
        flow,
        stage: stages[stageIdx],
        readDraftData,
        writeDraftData
      });
    } catch (e) {
      stageEl.innerHTML = "<pre>" + esc(e.stack || e) + "</pre>";
    }

    nextBtn.textContent =
      stages[stageIdx] === "review" ? "Export" : "Next";

    prevBtn.disabled = stageIdx === 0;
    nextBtn.disabled = stageIdx === stages.length - 1;

  })();

})();
