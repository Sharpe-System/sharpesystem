export const dvroResponseFlow = {
  id: "dvro_response",
  title: "DVRO Response",
  stages: ["intake", "build", "review", "export"],

  render(stage, ctx) {
    if (stage === "intake") return renderIntake(ctx);
    if (stage === "build") return renderBuild(ctx);
    if (stage === "review") return renderReview(ctx);
    if (stage === "export") return renderExport(ctx);
    return renderIntake(ctx);
  }
};

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function read(ctx) {
  const d = ctx.readDraftData?.() || {};
  d.dvro_response = d.dvro_response || {};
  return d;
}

function write(ctx, d) {
  ctx.writeDraftData?.(d);
}

function renderIntake(ctx) {
  const d = read(ctx);
  const r = d.dvro_response;

  ctx.renderShell?.(); ctx.stageEl.innerHTML = `
    <h2>DVRO Response — Case Info</h2>
    <div class="card" style="margin-top:12px;">
      <label class="label">Court county</label>
      <input class="input" id="dvro_county" value="${esc(r.county || "")}" />

      <label class="label" style="margin-top:10px;">Case number</label>
      <input class="input" id="dvro_case" value="${esc(r.caseNumber || "")}" />

      <label class="label" style="margin-top:10px;">Your role</label>
      <select class="input" id="dvro_role">
        ${opt(r.role, "", "Select…")}
        ${opt(r.role, "respondent", "Respondent")}
        ${opt(r.role, "protected_person", "Protected Person")}
      </select>
    </div>
  `;

  wireSave(ctx, {
    county: "#dvro_county",
    caseNumber: "#dvro_case",
    role: "#dvro_role"
  });
}

function renderBuild(ctx) {
  const d = read(ctx);
  const r = d.dvro_response;

  ctx.renderShell?.(); ctx.stageEl.innerHTML = `
    <h2>Response</h2>
    <div class="card" style="margin-top:12px;">
      <label class="label">Your response to allegations</label>
      <textarea class="input" id="resp_text" rows="8">${esc(r.responseText || "")}</textarea>

      <label class="label" style="margin-top:12px;">Requested outcome</label>
      <textarea class="input" id="resp_orders" rows="6">${esc(r.requestedOrders || "")}</textarea>
    </div>
  `;

  const save = () => {
    const d2 = read(ctx);
    d2.dvro_response.responseText =
      (document.querySelector("#resp_text")?.value || "").trim();
    d2.dvro_response.requestedOrders =
      (document.querySelector("#resp_orders")?.value || "").trim();
    write(ctx, d2);
  };

  ["#resp_text", "#resp_orders"].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener("input", save);
  });
}

function renderReview(ctx) {
  const d = read(ctx);
  const r = d.dvro_response;

  ctx.renderShell?.(); ctx.stageEl.innerHTML = `
    <h2>Review</h2>
    <div class="card" style="margin-top:12px;">
      <div><strong>County:</strong> ${esc(r.county || "—")}</div>
      <div><strong>Case #:</strong> ${esc(r.caseNumber || "—")}</div>
      <div><strong>Role:</strong> ${esc(r.role || "—")}</div>

      <hr style="margin:12px 0; opacity:.25;">

      <div><strong>Response:</strong></div>
      <div style="white-space:pre-wrap; margin-top:6px;">${esc(r.responseText || "—")}</div>

      <div style="margin-top:10px;"><strong>Requested Orders:</strong></div>
      <div style="white-space:pre-wrap; margin-top:6px;">${esc(r.requestedOrders || "—")}</div>
    </div>
  `;
}

function wireSave(ctx, map) {
  function save() {
    const d = read(ctx);
    for (const [k, sel] of Object.entries(map)) {
      const el = document.querySelector(sel);
      if (!el) continue;
      d.dvro_response[k] = String(el.value || "").trim();
    }
    write(ctx, d);
  }

  for (const sel of Object.values(map)) {
    const el = document.querySelector(sel);
    if (!el) continue;
    el.addEventListener("change", save);
    el.addEventListener("input", save);
  }
}

function opt(current, value, label) {
  const sel = String(current ?? "") === String(value) ? "selected" : "";
  return `<option value="${esc(value)}" ${sel}>${esc(label)}</option>`;
}

function renderExport(ctx){
  const d = read(ctx);
  const r = d.dvro_response || {};

  ctx.renderShell?.(); ctx.stageEl.innerHTML = `
    <h2>DVRO Response — Export</h2>
    <div class="card" style="margin-top:12px;">
      <div style="opacity:.92;line-height:1.45;">
        You are at the final step. Your response has been safely gathered.
        Export preparation is ready. The document connection is being completed
        so you can download your DVRO response packet here.
      </div>

      <hr style="margin:12px 0;opacity:.25;">

      <div><strong>County:</strong> ${esc(r.county || "—")}</div>
      <div><strong>Case #:</strong> ${esc(r.caseNumber || "—")}</div>
      <div><strong>Role:</strong> ${esc(r.role || "—")}</div>

      <div style="margin-top:12px;opacity:.85;">
        Status: export screen ready · packet link next
      </div>

      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn" id="dvro_back">Back</button>
        <button class="btn" id="dvro_exit">Exit</button>
      </div>
    </div>
  `;

  const back = document.querySelector("#dvro_back");
  const exit = document.querySelector("#dvro_exit");
  if (back) back.onclick = () => history.back();
  if (exit) exit.onclick = () => location.href = "/start.html";
}
