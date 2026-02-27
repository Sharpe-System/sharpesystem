import { $ } from "/core/utils.js";

async function main() {
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
  const stageFromUrl = (url.searchParams.get("stage") || "start").trim();
  const returnTo = (url.searchParams.get("return") || "").trim();

  const stageEl = $("#stage");
  const titleEl = $("#flowTitle");
  const subEl = $("#flowSub");
  const prevBtn = $("#btnPrev");
  const nextBtn = $("#btnNext");
  const exitBtn = $("#btnExit");

  if (!stageEl || !prevBtn || !nextBtn) {
    console.error("App controller: missing required DOM nodes.");
    return;
  }

  const DRAFT_KEY = `ss:draft:${flow}`;

  function readDraftData() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeDraftData(data) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data || {}));
    } catch {}
  }

  function setStageParam(nextStage, replace = false) {
    const u = new URL(location.href);
    u.searchParams.set("flow", flow);
    u.searchParams.set("stage", nextStage);
    if (returnTo) u.searchParams.set("return", returnTo);
    if (replace) location.replace(u.toString());
    else location.href = u.toString();
  }

  const flowMod = await loadFlow(flow);
  if (!flowMod) {
    stageEl.innerHTML = "<p>Flow not found.</p>";
    return;
  }

  const stages = flowMod.stages || [];
  let stageIdx = stages.indexOf(stageFromUrl);
  if (stageIdx < 0) stageIdx = 0;

  function gotoStage(idx) {
    idx = Math.max(0, Math.min(stages.length - 1, idx));
    setStageParam(stages[idx]);
  }

  prevBtn.addEventListener("click", () => {
    if (stageIdx <= 0 && returnTo) {
      location.href = returnTo;
      return;
    }
    gotoStage(stageIdx - 1);
  });

  nextBtn.addEventListener("click", () => gotoStage(stageIdx + 1));

  exitBtn?.addEventListener("click", () => {
    if (returnTo) location.href = returnTo;
    else location.href = "/";
  });

  function render() {
    const ctx = {
      flow,
      stage: stages[stageIdx],
      stageEl,
      readDraftData,
      writeDraftData,
      esc,
    };

    const out = flowMod.render?.(ctx, stages[stageIdx]);
    if (typeof out === "string") stageEl.innerHTML = out;
  }

  render();
}

main();
