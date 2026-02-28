export const rfoFlow = {
  id: "rfo",
  title: "Request for Order (RFO)",
  stages: ["start", "intake", "capture", "build", "review", "export"],

  render(stage, ctx) {
    if (stage === "start") return renderStart(ctx);
    if (stage === "intake") return renderIntake(ctx);
    if (stage === "capture") return renderCapture(ctx);
    if (stage === "build") return renderBuild(ctx);
    if (stage === "review") return renderReview(ctx);
    if (stage === "export") return renderExport(ctx);
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

function getRfoDraft(ctx) {
  const d = ctx.readDraftData() || {};
  if (!d.rfo || typeof d.rfo !== "object") d.rfo = {};
  if (!d.rfo.intake || typeof d.rfo.intake !== "object") d.rfo.intake = {};
  if (!d.rfo.case || typeof d.rfo.case !== "object") d.rfo.case = {};
  if (!Array.isArray(d.rfo.intake.changeTypes)) d.rfo.intake.changeTypes = [];
  return d;
}

function writeRfoDraft(ctx, draft) {
  ctx.writeDraftData(draft);
}

function setValue(root, sel, value) {
  const el = root.querySelector(sel);
  if (!el) return;
  el.value = value ?? "";
}

function setChecked(root, sel, checked) {
  const el = root.querySelector(sel);
  if (!el) return;
  el.checked = !!checked;
}

function readChecked(root, sel) {
  const el = root.querySelector(sel);
  return !!el?.checked;
}

function readValue(root, sel) {
  const el = root.querySelector(sel);
  return (el?.value ?? "").trim();
}

function toggleInArray(arr, value, enabled) {
  const v = String(value);
  const has = arr.includes(v);
  if (enabled && !has) arr.push(v);
  if (!enabled && has) arr.splice(arr.indexOf(v), 1);
  return arr;
}

function renderStart(ctx) {
  ctx.stageEl.innerHTML = `
    <div class="ss-card">
      <h2 style="margin:0 0 8px 0;">Request for Order</h2>
      <p class="muted" style="margin:0;">
        This is how you ask the court to change, clarify, or enforce orders.
      </p>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <h3 style="margin:0 0 8px 0;">What we’ll do together</h3>
      <ul style="margin:0; padding-left:18px;">
        <li>Start with a quick, low-pressure check-in</li>
        <li>Gather the case details the form requires</li>
        <li>Help you describe what’s happening in plain language</li>
        <li>Shape it into clear, court-ready requests</li>
      </ul>
      <p class="muted" style="margin:10px 0 0 0;">
        Nothing is filed or submitted from here. You control what gets applied.
      </p>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <p style="margin:0 0 10px 0;">
        When you’re ready, hit <strong>Next</strong>.
      </p>
      <p class="muted" style="margin:0;">
        If you feel overwhelmed, that’s normal. We’re going one step at a time.
      </p>
    </div>
  `;
}

function renderIntake(ctx) {
  const host = ctx.stageEl;
  const draft = getRfoDraft(ctx);

  const intake = draft.rfo.intake;

  host.innerHTML = `
    <div class="ss-card">
      <h2 style="margin:0 0 6px 0;">Before we start</h2>
      <p class="muted" style="margin:0;">
        You don’t need court language. Answer in plain English. We’ll help structure it later.
      </p>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <h3 style="margin:0 0 10px 0;">What kind of change are you looking for?</h3>
      <p class="muted" style="margin:0 0 10px 0;">
        Check all that apply. You can change this later.
      </p>

      <div class="row" style="gap:12px; flex-wrap:wrap;">
        ${checkbox("ct_visitation", "Parenting time / visitation")}
        ${checkbox("ct_custody", "Custody")}
        ${checkbox("ct_schedule", "Schedule change")}
        ${checkbox("ct_enforcement", "Enforcement of an order")}
        ${checkbox("ct_safety", "Safety concern")}
        ${checkbox("ct_comm", "Communication / decision issues")}
        ${checkbox("ct_support", "Support (child/spousal)")}
        ${checkbox("ct_unsure", "I’m not sure yet")}
      </div>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <h3 style="margin:0 0 10px 0;">What’s bringing you here right now?</h3>

      <label class="field">
        <span class="label">Situation</span>
        <select class="input" id="rfo_reason">
          <option value="">Select…</option>
          <option value="recent">Something recently happened</option>
          <option value="ongoing">Ongoing problems</option>
          <option value="not_followed">Order not being followed</option>
          <option value="child_changed">Child’s needs changed</option>
          <option value="court_soon">Court date coming</option>
          <option value="safety">Safety concern</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label class="field" style="margin-top:10px;">
        <span class="label">Urgency</span>
        <select class="input" id="rfo_urgency">
          <option value="">Select…</option>
          <option value="not_urgent">Not urgent</option>
          <option value="concerning">Concerning</option>
          <option value="urgent">Urgent</option>
          <option value="immediate">Immediate safety concern</option>
        </select>
      </label>

      <label class="field" style="margin-top:10px;">
        <span class="label">Is there already a court order in place?</span>
        <select class="input" id="rfo_order_exists">
          <option value="">Select…</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="not_sure">Not sure</option>
        </select>
      </label>

      <p class="muted" style="margin:10px 0 0 0;">
        Next, we’ll gather the basic case details the form requires.
      </p>
    </div>
  `;

  function checkbox(id, label) {
    return `
      <label class="pill" style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" id="${esc(id)}" />
        <span>${esc(label)}</span>
      </label>
    `;
  }

  // Set initial values
  const map = {
    ct_visitation: "visitation",
    ct_custody: "custody",
    ct_schedule: "schedule",
    ct_enforcement: "enforcement",
    ct_safety: "safety",
    ct_comm: "communication",
    ct_support: "support",
    ct_unsure: "unsure"
  };

  Object.entries(map).forEach(([id, val]) => {
    setChecked(host, `#${id}`, intake.changeTypes.includes(val));
    const el = host.querySelector(`#${id}`);
    if (el) {
      el.addEventListener("change", () => {
        const d = getRfoDraft(ctx);
        toggleInArray(d.rfo.intake.changeTypes, val, !!el.checked);
        writeRfoDraft(ctx, d);
      });
    }
  });

  setValue(host, "#rfo_reason", intake.reason || "");
  setValue(host, "#rfo_urgency", intake.urgency || "");
  setValue(host, "#rfo_order_exists", intake.orderExists || "");

  const reasonEl = host.querySelector("#rfo_reason");
  const urgEl = host.querySelector("#rfo_urgency");
  const ordEl = host.querySelector("#rfo_order_exists");

  if (reasonEl) reasonEl.addEventListener("change", () => {
    const d = getRfoDraft(ctx);
    d.rfo.intake.reason = readValue(host, "#rfo_reason");
    writeRfoDraft(ctx, d);
  });

  if (urgEl) urgEl.addEventListener("change", () => {
    const d = getRfoDraft(ctx);
    d.rfo.intake.urgency = readValue(host, "#rfo_urgency");
    writeRfoDraft(ctx, d);
  });

  if (ordEl) ordEl.addEventListener("change", () => {
    const d = getRfoDraft(ctx);
    d.rfo.intake.orderExists = readValue(host, "#rfo_order_exists");
    writeRfoDraft(ctx, d);
  });
}

function renderCapture(ctx) {
  const host = ctx.stageEl;
  const draft = getRfoDraft(ctx);
  const c = draft.rfo.case;

  host.innerHTML = `
  <div class="ss-card">
    <h2 style="margin:0 0 6px 0;">Help me understand what’s been happening</h2>
    <p class="muted" style="margin:0;">
      You can describe events in plain language. You don’t need legal wording.
    </p>
  </div>

  <div class="ss-card" style="margin-top:12px;">
    <label class="field">
      <span class="label">What has been going on that led you here?</span>
      <textarea class="input" id="rfo_story" rows="7"
        placeholder="Describe recent events, ongoing problems, or changes affecting your child or schedule."></textarea>

      <span class="muted" style="display:block; margin-top:6px;">
        Missed visits, conflict patterns, schedule problems, or child needs changes all belong here.
      </span>

      <div class="row ss-ai-row">
        <button class="ss-btn ss-btn-neutral" style="margin-right:6px;" type="button" data-ai="explain" data-field="story">Explain</button>
        <button class="ss-btn ss-btn-secondary" style="margin-right:6px;" type="button" data-ai="options" data-field="story">Examples</button>
        <button class="ss-btn ss-btn-primary" type="button" data-ai="draft" data-field="story">Help me say this</button>
      </div>
    </label>
  </div>

  <div class="ss-card" style="margin-top:12px;">
    <label class="field">
      <span class="label">How has this affected your child or parenting time?</span>
      <textarea class="input" id="rfo_child_impact" rows="5"
        placeholder="Changes in stability, stress, school, health, routines, or time with each parent."></textarea>

      <span class="muted" style="display:block; margin-top:6px;">
        Courts focus on child impact. Even small effects matter.
      </span>

      <div class="row ss-ai-row">
        <button class="ss-btn ss-btn-neutral" style="margin-right:6px;" type="button" data-ai="explain" data-field="child_impact">Explain</button>
        <button class="ss-btn ss-btn-secondary" style="margin-right:6px;" type="button" data-ai="options" data-field="child_impact">Examples</button>
        <button class="ss-btn ss-btn-primary" type="button" data-ai="draft" data-field="child_impact">Help me say this</button>
      </div>
    </label>
  </div>

  <div class="ss-card" style="margin-top:12px;">
    <h3 style="margin:0 0 8px 0;">What would you like changed?</h3>
    <p class="muted" style="margin:0 0 10px 0;">
      Tell the court what outcome would make things work better.
    </p>

    <label class="field">
      <span class="label">Describe the change you’re asking for</span>
      <textarea class="input" id="rfo_change_request" rows="6"
        placeholder="Example: Modify the parenting schedule to…, Clarify exchange location…, Adjust decision-making…"></textarea>

      <span class="muted" style="display:block; margin-top:6px;">
        Specific requests are easier for courts to grant.
      </span>

      <div class="row ss-ai-row">
        <button class="ss-btn ss-btn-neutral" style="margin-right:6px;" type="button" data-ai="explain" data-field="change_request">Explain</button>
        <button class="ss-btn ss-btn-secondary" style="margin-right:6px;" type="button" data-ai="options" data-field="change_request">Examples</button>
        <button class="ss-btn ss-btn-primary" type="button" data-ai="draft" data-field="change_request">Help me say this</button>
      </div>
    </label>
  </div>

  <div class="ss-card" style="margin-top:12px;">
    <label class="field">
      <span class="label">Why would this change help your child?</span>
      <textarea class="input" id="rfo_best_interest" rows="5"
        placeholder="How the change improves stability, safety, routine, or wellbeing."></textarea>

      <span class="muted" style="display:block; margin-top:6px;">
        Courts decide based on the child’s best interest.
      </span>

      <div class="row ss-ai-row">
        <button class="ss-btn ss-btn-neutral" style="margin-right:6px;" type="button" data-ai="explain" data-field="best_interest">Explain</button>
        <button class="ss-btn ss-btn-secondary" style="margin-right:6px;" type="button" data-ai="options" data-field="best_interest">Examples</button>
        <button class="ss-btn ss-btn-primary" type="button" data-ai="draft" data-field="best_interest">Help me say this</button>
      </div>
    </label>
  <div class="ss-card" style="margin-top:12px;">
    <h3 style="margin:0 0 8px 0;">Specific orders</h3>
    <p class="muted" style="margin:0 0 10px 0;">
      If you know the details, describe them. If not, rough ideas are fine.
    </p>

    <label class="field">
      <span class="label">Parenting schedule or custody change</span>
      <textarea class="input" id="rfo_schedule_detail" rows="5"
        placeholder="Days, times, exchanges, holidays, or custody structure."></textarea>

      <div class="row ss-ai-row">
        <button class="ss-btn ss-btn-neutral" style="margin-right:6px;" type="button" data-ai="explain" data-field="schedule_detail">Explain</button>
        <button class="ss-btn ss-btn-secondary" style="margin-right:6px;" type="button" data-ai="options" data-field="schedule_detail">Examples</button>
        <button class="ss-btn ss-btn-primary" type="button" data-ai="draft" data-field="schedule_detail">Help me say this</button>
      </div>
    </label>

    <label class="field" style="margin-top:10px;">
      <span class="label">Other orders requested</span>
      <textarea class="input" id="rfo_other_orders" rows="4"
        placeholder="Communication rules, exchange location, travel, decision-making, etc."></textarea>

      <div class="row ss-ai-row">
        <button class="ss-btn ss-btn-neutral" style="margin-right:6px;" type="button" data-ai="explain" data-field="other_orders">Explain</button>
        <button class="ss-btn ss-btn-secondary" style="margin-right:6px;" type="button" data-ai="options" data-field="other_orders">Examples</button>
        <button class="ss-btn ss-btn-primary" type="button" data-ai="draft" data-field="other_orders">Help me say this</button>
      </div>
    </label>
  </div>
  `;

  const map = {
    story: "#rfo_story",
    scheduleDetail: "#rfo_schedule_detail",
    otherOrders: "#rfo_other_orders",
    childImpact: "#rfo_child_impact",
    changeRequest: "#rfo_change_request",
    bestInterest: "#rfo_best_interest"
  };

  Object.entries(map).forEach(([key, sel]) => {
    const el = host.querySelector(sel);
    if (!el) return;
    el.value = c[key] || "";
    el.addEventListener("input", () => {
      const d = getRfoDraft(ctx);
      d.rfo.case[key] = el.value.trim();
      writeRfoDraft(ctx, d);
    });
  });
}


function renderBuild(ctx) {
  const host = ctx.stageEl;
  const draft = getRfoDraft(ctx);

  host.innerHTML = `
    <div class="ss-card">
      <h2 style="margin:0 0 6px 0;">Requested orders</h2>
      <p class="muted" style="margin:0;">
        Tell the court what you want changed. Specific requests are easier for a judge to grant.
      </p>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <label class="field">
        <span class="label">What are you asking the court to order?</span>
        <textarea class="input" id="rfo_orders" rows="7" placeholder="Example: Modify the parenting time schedule to…"></textarea>
        <span class="muted" style="display:block; margin-top:6px;">
          If you’re unsure what belongs here, that’s exactly what Field Assist is for.
        </span>

        <div class="row ss-ai-row">
          <button class="ss-btn ss-btn-neutral" style="margin-right:6px;" type="button" data-ai="explain" data-field="orders">Explain</button>
          <button class="ss-btn ss-btn-secondary" style="margin-right:6px;" type="button" data-ai="options" data-field="orders">Examples</button>
          <button class="ss-btn ss-btn-primary" type="button" data-ai="draft" data-field="orders">Draft for me</button>
        </div>

        <div id="ai_panel_build" class="card" style="margin-top:10px; display:none;">
          <div class="muted" id="ai_panel_build_title" style="margin-bottom:8px;"></div>
          <div id="ai_panel_build_body" style="white-space:pre-wrap;"></div>
        </div>
      </label>
    </div>
  `;

  const d = ctx.readDraftData() || {};
  const orders = d?.rfo?.build?.orders || "";
  setValue(host, "#rfo_orders", orders);

  const ordersEl = host.querySelector("#rfo_orders");
  if (ordersEl) {
    ordersEl.addEventListener("input", () => {
      const cur = getRfoDraft(ctx);
      if (!cur.rfo.build || typeof cur.rfo.build !== "object") cur.rfo.build = {};
      cur.rfo.build.orders = readValue(host, "#rfo_orders");
      writeRfoDraft(ctx, cur);
    });
  }

  const panel = host.querySelector("#ai_panel_build");
  const panelTitle = host.querySelector("#ai_panel_build_title");
  const panelBody = host.querySelector("#ai_panel_build_body");

  host.querySelectorAll("button[data-ai]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-ai");
      const field = btn.getAttribute("data-field");

      if (!panel || !panelTitle || !panelBody) return;

      panel.style.display = "";
      const label =
        mode === "explain" ? "Explain (plain language)" :
        mode === "options" ? "Examples (common patterns)" :
        "Draft (apply-ready text)";

      panelTitle.textContent = `${label} — coming online soon`;
      panelBody.textContent =
        "This is the placeholder surface for Field Assist.\n\n" +
        "Next implementation step:\n" +
        "- Public: explain + limited examples\n" +
        "- Subscriber: full drafts + apply-to-field\n\n" +
        `Requested: mode=${mode}, field=${field}`;
    });
  });
}

function renderReview(ctx) {
  ctx.stageEl.innerHTML = `
    <div class="ss-card">
      <h2 style="margin:0 0 6px 0;">Review</h2>
      <p class="muted" style="margin:0;">
        We’ll summarize what you entered and check for obvious gaps before export.
      </p>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <p style="margin:0;">
        This page will become the “clarity pass” before the final packet.
      </p>
    </div>
  `;
}

function renderExport(ctx) {
  ctx.stageEl.innerHTML = `
    <div class="ss-card">
      <h2 style="margin:0 0 6px 0;">Export</h2>
      <p class="muted" style="margin:0;">
        Exporting print-ready filings is a gated step. Drafting stays available.
      </p>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <div class="row" style="gap:10px; flex-wrap:wrap;">
        <a class="btn" href="/app.html?flow=rfo&stage=review">Back to review</a>
        <a class="btn primary" href="/login.html?next=/rfo/print.html">Login to print</a>
      </div>
    </div>
  `;
}
