/* core/app-controller.js
   Canonical App Controller
   - Flow plugins define their own stages.
   - Controller delegates stage logic to plugin.
   - Deterministic routing via URL.
*/

(function () {
  "use strict";

  const stageEl = document.querySelector("#stage");
  const prevBtn = document.querySelector("#prevBtn");
  const nextBtn = document.querySelector("#nextBtn");

  const params = new URLSearchParams(location.search);
  const flow = params.get("flow") || "";
  let stage = params.get("stage") || "";

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // -----------------------------
  // Draft persistence (local only for now)
  // -----------------------------

  const STORAGE_KEY = "sharpe:draft";

  function readDraft() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function writeDraft(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data || {}));
    } catch {}
  }

  // Aliases for flow plugins
  function readDraftData() {
    return readDraft() || {};
  }

  function writeDraftData(data) {
    writeDraft(data || {});
  }

  // -----------------------------
  // Flow loader
  // -----------------------------

  async function loadFlow(flowId) {
    if (!flowId) return null;

    try {
      if (flowId === "rfo") {
        const mod = await import("/flows/rfo/rfo-flow.js");
        return mod.rfoFlow;
      }
    } catch (e) {
      console.error("Failed to load flow:", flowId, e);
    }

    return null;
  }

  // -----------------------------
  // Navigation
  // -----------------------------

  function gotoStage(flowPlugin, idx) {
    const stages = flowPlugin?.stages || [];
    if (!stages.length) return;

    const clamped = Math.max(0, Math.min(idx, stages.length - 1));
    const nextStage = stages[clamped];

    const url = new URL(location.href);
    url.searchParams.set("flow", flow);
    url.searchParams.set("stage", nextStage);
    location.href = url.toString();
  }

  // -----------------------------
  // Render
  // -----------------------------

  async function render() {
    const flowPlugin = await loadFlow(flow);

    if (!flowPlugin) {
      stageEl.innerHTML = `<p class="muted">Flow not found.</p>`;
      return;
    }

    const stages = flowPlugin.stages || [];
    if (!stages.length) {
      stageEl.innerHTML = `<p class="muted">No stages defined.</p>`;
      return;
    }

    let stageIdx = stages.indexOf(stage);
    if (stageIdx < 0) {
      stageIdx = 0;
      const url = new URL(location.href);
      url.searchParams.set("stage", stages[0]);
      location.replace(url.toString());
      return;
    }

    try {
      await flowPlugin.render(stage, {
        stageEl,
        flow,
        stage,
        readDraftData,
        writeDraftData,
        renderExport: () => {
          stageEl.innerHTML = `
            <h2>Export</h2>
            <p class="muted">Print-ready output generation goes here.</p>
          `;
        }
      });
    } catch (e) {
      console.error("Flow render failed:", e);
      stageEl.innerHTML = `<p class="muted">Render error. See console.</p>`;
      return;
    }

    // Button states
    prevBtn.disabled = stageIdx <= 0;
    nextBtn.disabled = stageIdx >= stages.length - 1;

    prevBtn.onclick = () => gotoStage(flowPlugin, stageIdx - 1);
    nextBtn.onclick = () => gotoStage(flowPlugin, stageIdx + 1);
  }

  render().catch(console.error);

})();
