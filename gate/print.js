/* /gate/print.js — single doorway (no entitlement logic)
   Routes by flow+doc to the correct renderer.
   Canon: read-only localStorage, no new keys, no redirects loops.
*/
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function showMsg(html) {
    const el = $("gateMsg");
    if (!el) return;
    el.style.display = "";
    el.innerHTML = html;
  }

  const url = new URL(location.href);
  const flow = (url.searchParams.get("flow") || "rfo").trim();
  const doc  = (url.searchParams.get("doc")  || "fl300").trim();

  // Router table: keep this tiny + obvious. Phase 1 points to existing renderer.
  const ROUTES = {
    "rfo:fl300": {
      renderer: "/rfo/fl300-print/",
      requiredKey: "ss_rfo_public_fl300_v1",
      missingDataGoTo: "/app.html?flow=rfo&stage=capture"
    }
  };

  const key = `${flow}:${doc}`;
  const route = ROUTES[key];

  const back = $("btnBack");
  const cont = $("btnContinue");

  if (!route) {
    showMsg(
      `<div><strong>Unknown document</strong></div>
       <div class="muted" style="margin-top:6px;">No route for <code>${key}</code>.</div>`
    );
    if (cont) cont.style.display = "none";
    return;
  }

  if (back) back.href = `/app.html?flow=${encodeURIComponent(flow)}&stage=review`;
  if (cont) cont.href = route.renderer;

  // Read-only check: do we have the canonical data that the renderer expects?
  let has = false;
  try { has = !!localStorage.getItem(route.requiredKey); } catch (_) { has = false; }

  if (!has) {
    showMsg(
      `<div><strong>No saved data found yet.</strong></div>
       <div class="muted" style="margin-top:6px;">
         Expected: <code>${route.requiredKey}</code>
       </div>
       <div style="margin-top:10px;">
         <a class="btn primary" href="${route.missingDataGoTo}">Go fill it in</a>
       </div>`
    );
    return;
  }

  // Auto-forward to renderer (same tab). No target=_blank anywhere.
  try { location.replace(route.renderer); } catch (_) { location.href = route.renderer; }
})();
