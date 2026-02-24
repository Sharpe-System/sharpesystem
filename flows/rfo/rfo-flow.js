/* /flows/rfo/rfo-flow.js
   RFO flow plugin (v1): stylized interview UI, no form vibes.
   Data contract stored in localStorage under ss:draft:rfo
*/

export const rfoFlow = {
  id: "rfo",
  title: "Request for Order",
  stages: ["intake", "build", "review", "export"],

  defaults() {
    return {
      petitionerName: "",
      respondentName: "",
      caseNumber: "",
      county: "",
      hearingDate: "",
      hearingTime: "",
      department: "",
      courtroom: "",
      requestChildCustody: true,
      requestChildSupport: false,
      notes: ""
    };
  },

  render(stage, api) {
    if (stage === "intake") return renderIntake(api);
    if (stage === "build") return renderBuild(api);
    if (stage === "review") return renderReview(api);
    if (stage === "export") return api.renderExport(); // delegate to controller export stage
    api.stageEl.innerHTML = `<p class="muted">Unknown stage.</p>`;
  }
};

function card(title, bodyHtml) {
  return `
    <section class="card" style="margin-bottom:12px;">
      <h3 style="margin:0 0 8px 0;">${title}</h3>
      ${bodyHtml}
    </section>
  `;
}

function field(label, html, hint = "") {
  return `
    <div style="margin:12px 0;">
      <div style="font-weight:600; margin-bottom:6px;">${label}</div>
      ${html}
      ${hint ? `<div class="muted" style="margin-top:6px;">${hint}</div>` : ``}
    </div>
  `;
}

function select(label, id, options, value) {
  const opts = options
    .map(o => `<option value="${escapeHtml(o.value)}" ${o.value === value ? "selected" : ""}>${escapeHtml(o.label)}</option>`)
    .join("");
  return field(label, `<select id="${id}" class="input" style="width:100%;">${opts}</select>`);
}

function input(label, id, value, placeholder = "") {
  return field(label, `<input id="${id}" class="input" style="width:100%;" value="${escapeHtml(value || "")}" placeholder="${escapeHtml(placeholder)}" />`);
}

function toggle(label, id, checked) {
  return `
    <label style="display:flex; align-items:center; gap:10px; margin:10px 0;">
      <input id="${id}" type="checkbox" ${checked ? "checked" : ""} />
      <span style="font-weight:600;">${label}</span>
    </label>
  `;
}

function textarea(label, id, value, hint = "") {
  return field(label, `<textarea id="${id}" class="input" style="width:100%; min-height:120px;">${escapeHtml(value || "")}</textarea>`, hint);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderIntake(api) {
  const d = api.readDraftData();

  api.stageEl.innerHTML = `
    ${card("Case basics", `
      <p class="muted" style="margin-top:0;">
        Answer in plain English. We’ll generate the official court form at the end.
      </p>
      ${input("Petitioner name", "petitionerName", d.petitionerName, "e.g., Jane Doe")}
      ${input("Respondent name", "respondentName", d.respondentName, "e.g., John Doe")}
      ${input("Case number", "caseNumber", d.caseNumber, "e.g., 23D012345")}
    `)}
    ${card("Court (optional now)", `
      ${select("County", "county", [
        { label: "Select…", value: "" },
        { label: "Orange", value: "Orange" },
        { label: "Los Angeles", value: "Los Angeles" },
        { label: "San Diego", value: "San Diego" },
        { label: "Riverside", value: "Riverside" }
      ], d.county)}
      ${input("Hearing date", "hearingDate", d.hearingDate, "MM/DD/YYYY")}
      ${input("Hearing time", "hearingTime", d.hearingTime, "e.g., 8:30 AM")}
      ${input("Department", "department", d.department, "e.g., D12")}
      ${input("Courtroom", "courtroom", d.courtroom, "e.g., C")}
    `)}
  `;

  wireCommon(api);
}

function renderBuild(api) {
  const d = api.readDraftData();

  api.stageEl.innerHTML = `
    ${card("What are you asking the court for?", `
      <div class="muted" style="margin-bottom:8px;">
        Pick the buckets; you’ll provide the narrative later (declaration / attachments).
      </div>
      ${toggle("Child custody / visitation", "requestChildCustody", !!d.requestChildCustody)}
      ${toggle("Child support", "requestChildSupport", !!d.requestChildSupport)}
      ${textarea("Internal notes (not printed yet)", "notes", d.notes, "This is for your drafting pipeline. We decide later what goes onto the official form vs attachments.")}
    `)}
  `;

  wireCommon(api);
}

function renderReview(api) {
  const d = api.readDraftData();

  api.stageEl.innerHTML = `
    ${card("Official form preview (end reveal)", `
      <p class="muted" style="margin-top:0;">
        Below is the official FL-300 generated from your answers.
        Left = watermarked preview. Right = clean export (upgrade).
      </p>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; align-items:start;">
        <div class="card" style="margin:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong>Preview</strong>
            <span class="muted" style="font-size:12px;">Watermarked</span>
          </div>
          <iframe
            src="/rfo/fl300-print.html?flow=rfo&watermark=1"
            style="width:100%; height:70vh; border:none; border-radius:12px;"
          ></iframe>
        </div>

        <div class="card" style="margin:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong>Upgrade</strong>
            <span class="muted" style="font-size:12px;">Clean</span>
          </div>
          <div id="entitlementBox" class="muted">Checking access…</div>
          <div id="cleanFrameWrap" style="display:none;">
            <iframe
              src="/rfo/fl300-print.html?flow=rfo"
              style="width:100%; height:70vh; border:none; border-radius:12px;"
            ></iframe>
          </div>
        </div>
      </div>
    `)}

    ${card("Quick sanity check", `
      <div class="muted">Petitioner: <code>${escapeHtml(d.petitionerName || "")}</code></div>
      <div class="muted">Respondent: <code>${escapeHtml(d.respondentName || "")}</code></div>
      <div class="muted">Case #: <code>${escapeHtml(d.caseNumber || "")}</code></div>
    `)}
  `;

  wireEntitlements();
  // Review stage doesn’t need input wiring.
  // Still ensure draft exists:
  api.writeDraftData(d);
}

function wireCommon(api) {
  const d = api.readDraftData();

  const ids = [
    "petitionerName","respondentName","caseNumber",
    "county","hearingDate","hearingTime","department","courtroom",
    "requestChildCustody","requestChildSupport","notes"
  ];

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;

    const isCheckbox = el.type === "checkbox";
    const onChange = () => {
      d[id] = isCheckbox ? !!el.checked : el.value;
      api.writeDraftData(d);
    };

    el.addEventListener("change", onChange);
    el.addEventListener("input", onChange);
  }

  api.writeDraftData(d);
}

async function wireEntitlements() {
  const box = document.getElementById("entitlementBox");
  const wrap = document.getElementById("cleanFrameWrap");
  if (!box || !wrap) return;

  try {
    const res = await fetch("/api/entitlements", { cache: "no-store" });
    const json = await res.json();

    // v1 policy:
    // - Stub endpoint => treat as NOT entitled so upgrade CTA is visible.
    // Later: ok + tier/active flags come from real profile.
    const entitled = !!(json && json.entitled);

    if (entitled) {
      box.style.display = "none";
      wrap.style.display = "block";
    } else {
      box.innerHTML = `
        <div class="muted" style="margin-bottom:10px;">Clean export is an upgrade.</div>
        <a class="button primary" href="/billing.html">Upgrade to remove watermark</a>
      `;
      wrap.style.display = "none";
    }
  } catch (err) {
    box.textContent = "Could not check access.";
    wrap.style.display = "none";
  }
}
