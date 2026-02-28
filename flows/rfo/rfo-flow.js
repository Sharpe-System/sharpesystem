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
      <h2 style="margin:0 0 6px 0;">Case details</h2>
      <p class="muted" style="margin:0;">
        This section is boring on purpose. It’s how the court and the form recognize your case.
      </p>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <h3 style="margin:0 0 8px 0;">Court</h3>
      <p class="muted" style="margin:0 0 10px 0;">
        If you don’t know something, leave it blank. We can still continue.
      </p>

      <label class="field">
        <span class="label">County (example: Orange)</span>
        <input class="input" id="rfo_county" placeholder="County" />
        <span class="muted" style="display:block; margin-top:6px;">
          Why this matters: it determines the correct court label and formatting.
        </span>
      </label>

      <label class="field" style="margin-top:10px;">
        <span class="label">Case number</span>
        <input class="input" id="rfo_case_number" placeholder="Example: 30D012345" />
        <span class="muted" style="display:block; margin-top:6px;">
          Why this matters: the court uses this to attach your request to the existing file.
        </span>
      </label>

      <label class="field" style="margin-top:10px;">
        <span class="label">Court location / branch (optional)</span>
        <input class="input" id="rfo_branch" placeholder="Example: Lamoreaux" />
      </label>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <h3 style="margin:0 0 8px 0;">People</h3>

      <label class="field">
        <span class="label">Your role</span>
        <select class="input" id="rfo_role">
          <option value="">Select…</option>
          <option value="petitioner">Petitioner</option>
          <option value="respondent">Respondent</option>
          <option value="other">Other / not sure</option>
        </select>
        <span class="muted" style="display:block; margin-top:6px;">
          If you’re not sure, pick “Other / not sure.” We’ll keep moving.
        </span>
      </label>

      <label class="field" style="margin-top:10px;">
        <span class="label">Other parent / other party name (optional)</span>
        <input class="input" id="rfo_other_party" placeholder="Name" />
      </label>

      <label class="field" style="margin-top:10px;">
        <span class="label">Children (optional)</span>
        <textarea class="input" id="rfo_children" rows="3" placeholder="Names + ages, one per line"></textarea>
      </label>
    </div>

    <div class="ss-card" style="margin-top:12px;">
      <h3 style="margin:0 0 8px 0;">What’s been happening (we’ll help)</h3>
      <p class="muted" style="margin:0 0 10px 0;">
        This is the part people freeze on. Plain language is fine.
      </p>

      <label class="field">
        <span class="label">What has been happening?</span>
        <textarea class="input" id="rfo_story" rows="6" placeholder="Describe recent events or ongoing issues."></textarea>
        <span class="muted" style="display:block; margin-top:6px;">
          What to include: dates if you have them, patterns, missed exchanges, conflict points, child impact.
        </span>

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px;">
          <button class="btn" type="button" data-ai="explain" data-field="story">Explain</button>
          <button class="btn" type="button" data-ai="options" data-field="story">Examples</button>
          <button class="btn primary" type="button" data-ai="draft" data-field="story">Draft for me</button>
        </div>

        <div id="ai_panel" class="card" style="margin-top:10px; display:none;">
          <div class="muted" id="ai_panel_title" style="margin-bottom:8px;"></div>
          <div id="ai_panel_body" style="white-space:pre-wrap;"></div>
        </div>
      </label>
    </div>
  `;

  // initial values
  setValue(host, "#rfo_county", c.county || "");
  setValue(host, "#rfo_case_number", c.caseNumber || "");
  setValue(host, "#rfo_branch", c.branch || "");
  setValue(host, "#rfo_role", c.role || "");
  setValue(host, "#rfo_other_party", c.otherParty || "");
  setValue(host, "#rfo_children", c.children || "");
  setValue(host, "#rfo_story", c.story || "");

  // draft writers (only on user action)
  const fields = [
    ["#rfo_county", "county"],
    ["#rfo_case_number", "caseNumber"],
    ["#rfo_branch", "branch"],
    ["#rfo_role", "role"],
    ["#rfo_other_party", "otherParty"],
    ["#rfo_children", "children"],
    ["#rfo_story", "story"]
  ];

  fields.forEach(([sel, key]) => {
    const el = host.querySelector(sel);
    if (!el) return;
    el.addEventListener("input", () => {
      const d = getRfoDraft(ctx);
      d.rfo.case[key] = readValue(host, sel);
      writeRfoDraft(ctx, d);
    });
    el.addEventListener("change", () => {
      const d = getRfoDraft(ctx);
      d.rfo.case[key] = readValue(host, sel);
      writeRfoDraft(ctx, d);
    });
  });

  // AI panel placeholder (no AI calls yet; canon-safe surface)
  const panel = host.querySelector("#ai_panel");
  const panelTitle = host.querySelector("#ai_panel_title");
  const panelBody = host.querySelector("#ai_panel_body");

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

        <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px;">
          <button class="btn" type="button" data-ai="explain" data-field="orders">Explain</button>
          <button class="btn" type="button" data-ai="options" data-field="orders">Examples</button>
          <button class="btn primary" type="button" data-ai="draft" data-field="orders">Draft for me</button>
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
