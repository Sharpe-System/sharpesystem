/* /core/app-controller.js — stable nav w/ return */
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
  const stageFromUrl = (url.searchParams.get("stage") || "start").trim();
  const returnTo = (url.searchParams.get("return") || "").trim();

  function sanitizeReturnTo(rt) {
    rt = String(rt || "").trim();
    if (!rt) return "";

    // must be same-origin absolute path
    if (!rt.startsWith("/")) return "";

    // block protocol-relative / external-ish
    if (rt.includes("//") || rt.includes("://") || rt.toLowerCase().startsWith("http")) return "";

    // block re-entry into controller and controller-like params
    const low = rt.toLowerCase();
    if (low.includes("/app.html") || low.includes("flow=") || low.includes("stage=")) return "";

    // block self-return (prevents bouncing to same URL)
    const here = (location.pathname + location.search).toLowerCase();
    if (low === here) return "";

    return rt;
  }

  // If multiple return params exist, any unsafe value nukes return entirely
  const allReturns = url.searchParams.getAll("return") || [];
  let safeReturnTo = "";
  if (allReturns.length > 1) {
    let ok = true;
    for (const r of allReturns) {
      const sr = sanitizeReturnTo(r);
      if (!sr) { ok = false; break; }
      // prefer first safe only
      if (!safeReturnTo) safeReturnTo = sr;
    }
    if (!ok) safeReturnTo = "";
    // collapse to a single sanitized param (or none) to prevent loops
    url.searchParams.delete("return");
    if (safeReturnTo) url.searchParams.set("return", safeReturnTo);
    location.replace(url.toString());
    return;
  } else {
    safeReturnTo = sanitizeReturnTo(returnTo);
    if (returnTo && !safeReturnTo) {
      url.searchParams.delete("return");
      location.replace(url.toString());
      return;
    }
  }

  const stageEl = $("#stage");
  const titleEl = $("#flowTitle");
  const subEl = $("#flowSub");
  const prevBtn = $("#btnPrev");
  const nextBtn = $("#btnNext");
  const exitBtn = $("#btnExit");

  if (!stageEl || !prevBtn || !nextBtn) {
    console.error("App controller missing DOM nodes");
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
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data || {})); } catch {}
  }

  function setStage(nextStage, replace) {
    const u = new URL(location.href);
    u.searchParams.set("flow", flow);
    u.searchParams.set("stage", nextStage);
    if (safeReturnTo) u.searchParams.set("return", safeReturnTo);
    if (replace) location.replace(u.toString());
    else location.href = u.toString();
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  (async function main() {
    const flowPlugin = await loadFlow(flow);

    const stages = Array.isArray(flowPlugin?.stages) && flowPlugin.stages.length
      ? flowPlugin.stages
      : ["start", "intake", "build", "review", "export"];

    let stageIdx = stages.indexOf(stageFromUrl);
    if (stageIdx < 0) { setStage(stages[0], true); return; }

    if (titleEl) titleEl.textContent = flowPlugin?.title || `Flow: ${flow}`;
    if (subEl) subEl.textContent = `Stage: ${stages[stageIdx]}`;

    function gotoStage(idx) {
      const nextIdx = clamp(idx, 0, stages.length - 1);
      setStage(stages[nextIdx], false);
    }

    function updateNavUI() {
      // KEY FIX: allow Back click on first stage if returnTo exists
      prevBtn.disabled = (stageIdx <= 0) && !safeReturnTo;

      nextBtn.disabled = stageIdx >= (stages.length - 1);
      nextBtn.textContent = stages[stageIdx] === "review" ? "Export" : "Next";
      nextBtn.style.display = stages[stageIdx] === "export" ? "none" : "";
    }

    prevBtn.onclick = () => {
      if (stageIdx <= 0) {
        location.href = safeReturnTo || "/index.html";
        return;
      }
      gotoStage(stageIdx - 1);
    };

    nextBtn.onclick = () => { gotoStage(stageIdx + 1); };

    if (exitBtn) exitBtn.onclick = () => { location.href = "/index.html"; };

    try {
      if (flowPlugin && typeof flowPlugin.render === "function") {
        flowPlugin.render(stages[stageIdx], {
          stageEl,
          flow,
          stage: stages[stageIdx],
          readDraftData,
          writeDraftData
        });

        try {
          const mod = await import('/core/assist/assist.js');
          if (mod && mod.mountAssist) mod.mountAssist(stageEl, { flow, stage: stages[stageIdx] });
        } catch (_) {}

      } else {
        stageEl.innerHTML = `<h2>${esc(stages[stageIdx])}</h2><p class="muted">No flow plugin for <code>${esc(flow)}</code>.</p>`;
      }
    } catch (e) {
      stageEl.innerHTML = `<pre style="white-space:pre-wrap;">${esc(String(e?.stack || e))}</pre>`;
    }

    updateNavUI();
  })().catch((e) => {
    stageEl.innerHTML = `<pre style="white-space:pre-wrap;">${esc(String(e?.stack || e))}</pre>`;
  });
})();
