/* /rfo/rfo-ui.js
   RFO module — rendering + navigation + persistence
   Goal: full flow navigable start to finish without crashing.
*/

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  const statusEl = $("status");
  const stepMount = $("stepMount");
  const btnBack = $("btnBack");
  const btnNext = $("btnNext");
  const btnSave = $("btnSave");
  const btnReset = $("btnReset");
  const progressFill = $("progressFill");
  const progressText = $("progressText");

  let state = window.RFO_STATE.load();
  let currentStepId = (state.meta && state.meta.lastStepId) ? state.meta.lastStepId : "case_info";

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
  }

  function persist() {
    state.meta.lastStepId = currentStepId;
    window.RFO_STATE.save(state);
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderProgress() {
    const steps = window.RFO_ROUTER.getActiveSteps(state);
    const idx = steps.findIndex(x => x.id === currentStepId);
    const safeIdx = idx >= 0 ? idx : 0;
    const pct = steps.length <= 1 ? 0 : Math.round((safeIdx / (steps.length - 1)) * 100);

    if (progressFill) progressFill.style.width = pct + "%";
    if (progressText) {
      const title = (steps[safeIdx] && steps[safeIdx].title) ? steps[safeIdx].title : "";
      progressText.textContent = "Step " + (safeIdx + 1) + " of " + steps.length + " — " + title;
    }
  }

  function bindInput(selector, getObj, key, transform) {
    const el = stepMount.querySelector(selector);
    if (!el) return;

    el.addEventListener("input", function () {
      const obj = getObj();
      let val = el.value;

      if (transform) val = transform(val);

      obj[key] = val;
      setStatus("Editing…");
      persist();
    });

    el.addEventListener("change", function () {
      setStatus("Saved.");
      persist();
      renderProgress();
      renderStep(); // re-render for conditional visibility
    });
  }

  function bindCheckbox(selector, getObj, key) {
    const el = stepMount.querySelector(selector);
    if (!el) return;

    el.addEventListener("change", function () {
      const obj = getObj();
      obj[key] = !!el.checked;

      // If emergency toggled off, we keep details but routing will skip
      setStatus("Saved.");
      persist();
      renderProgress();
      renderStep(); // re-render to show/hide conditional blocks
    });
  }

  function renderCaseInfo() {
    const c = state.caseInfo;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Case Information</h2>

        <div class="rfoGrid">
          <label class="rfoField">
            <span>State</span>
            <input id="ci_state" type="text" value="${escapeHtml(c.state)}" placeholder="CA" />
          </label>

          <label class="rfoField">
            <span>County</span>
            <input id="ci_county" type="text" value="${escapeHtml(c.county)}" placeholder="Orange" />
          </label>

          <label class="rfoField">
            <span>Courthouse</span>
            <input id="ci_courthouse" type="text" value="${escapeHtml(c.courthouse)}" placeholder="Lamoreaux Justice Center" />
          </label>

          <label class="rfoField">
            <span>Case number</span>
            <input id="ci_caseNumber" type="text" value="${escapeHtml(c.caseNumber)}" placeholder="17D009277" />
          </label>

          <label class="rfoField">
            <span>Petitioner</span>
            <input id="ci_petitioner" type="text" value="${escapeHtml(c.petitioner)}" placeholder="Full legal name" />
          </label>

          <label class="rfoField">
            <span>Respondent</span>
            <input id="ci_respondent" type="text" value="${escapeHtml(c.respondent)}" placeholder="Full legal name" />
          </label>

          <label class="rfoField">
            <span>Relationship</span>
            <select id="ci_relationship">
              <option value="marriage" ${c.relationship==="marriage" ? "selected" : ""}>Marriage</option>
              <option value="parentage" ${c.relationship==="parentage" ? "selected" : ""}>Parentage</option>
              <option value="domestic_partnership" ${c.relationship==="domestic_partnership" ? "selected" : ""}>Domestic partnership</option>
              <option value="other" ${c.relationship==="other" ? "selected" : ""}>Other</option>
            </select>
          </label>

          <label class="rfoField">
            <span>Number of children</span>
            <input id="ci_childrenCount" type="number" min="0" step="1" value="${Number(c.childrenCount||0)}" />
          </label>
        </div>

        <p class="muted" style="margin-top:10px;">
          This section is required. Use accurate legal names.
        </p>
      </div>
    `;

    bindInput("#ci_state", () => state.caseInfo, "state", v => v.toUpperCase().trim());
    bindInput("#ci_county", () => state.caseInfo, "county", v => v.trim());
    bindInput("#ci_courthouse", () => state.caseInfo, "courthouse", v => v.trim());
    bindInput("#ci_caseNumber", () => state.caseInfo, "caseNumber", v => v.trim());
    bindInput("#ci_petitioner", () => state.caseInfo, "petitioner", v => v.trim());
    bindInput("#ci_respondent", () => state.caseInfo, "respondent", v => v.trim());

    const rel = stepMount.querySelector("#ci_relationship");
    if (rel) {
      rel.addEventListener("change", function () {
        state.caseInfo.relationship = rel.value;
        setStatus("Saved.");
        persist();
      });
    }

    const cc = stepMount.querySelector("#ci_childrenCount");
    if (cc) {
      cc.addEventListener("change", function () {
        const n = parseInt(cc.value || "0", 10);
        state.caseInfo.childrenCount = isNaN(n) ? 0 : Math.max(0, n);
        setStatus("Saved.");
        persist();
      });
    }
  }

  function renderOrdersRequested() {
    const o = state.ordersRequested;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Orders Requested</h2>

        <div class="rfoChecks">
          <label class="rfoCheck">
            <input id="or_custody" type="checkbox" ${o.custody ? "checked" : ""} />
            <span>Custody</span>
          </label>

          <label class="rfoCheck">
            <input id="or_visitation" type="checkbox" ${o.visitation ? "checked" : ""} />
            <span>Visitation</span>
          </label>

          <label class="rfoCheck">
            <input id="or_support" type="checkbox" ${o.support ? "checked" : ""} />
            <span>Support</span>
          </label>

          <label class="rfoCheck">
            <input id="or_attorneyFees" type="checkbox" ${o.attorneyFees ? "checked" : ""} />
            <span>Attorney fees</span>
          </label>

          <label class="rfoCheck">
            <input id="or_other" type="checkbox" ${o.other ? "checked" : ""} />
            <span>Other</span>
          </label>

          <label class="rfoCheck">
            <input id="or_emergency" type="checkbox" ${o.emergency ? "checked" : ""} />
            <span>Emergency (adds required questions)</span>
          </label>
        </div>

        <div class="rfoField" style="margin-top:12px;">
          <span>Other (describe)</span>
          <input id="or_otherText" type="text" value="${escapeHtml(o.otherText)}" placeholder="Describe the other orders requested" ${o.other ? "" : "disabled"} />
        </div>

        <p class="muted" style="margin-top:10px;">
          Your selections control which sections appear next.
        </p>
      </div>
    `;

    bindCheckbox("#or_custody", () => state.ordersRequested, "custody");
    bindCheckbox("#or_visitation", () => state.ordersRequested, "visitation");
    bindCheckbox("#or_support", () => state.ordersRequested, "support");
    bindCheckbox("#or_attorneyFees", () => state.ordersRequested, "attorneyFees");
    bindCheckbox("#or_other", () => state.ordersRequested, "other");
    bindCheckbox("#or_emergency", () => state.ordersRequested, "emergency");

    const otherText = stepMount.querySelector("#or_otherText");
    if (otherText) {
      otherText.addEventListener("input", function () {
        state.ordersRequested.otherText = otherText.value;
        setStatus("Editing…");
        persist();
      });
      otherText.addEventListener("change", function () {
        setStatus("Saved.");
        persist();
      });
    }
  }

  function renderCustody() {
    const c = state.custody;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Custody</h2>

        <div class="rfoGrid">
          <label class="rfoField">
            <span>Legal custody requested</span>
            <select id="cu_legal">
              <option value="" ${c.legalCustodyRequested==="" ? "selected" : ""}>Select…</option>
              <option value="joint" ${c.legalCustodyRequested==="joint" ? "selected" : ""}>Joint</option>
              <option value="sole" ${c.legalCustodyRequested==="sole" ? "selected" : ""}>Sole</option>
            </select>
          </label>

          <label class="rfoField">
            <span>Physical custody requested</span>
            <select id="cu_physical">
              <option value="" ${c.physicalCustodyRequested==="" ? "selected" : ""}>Select…</option>
              <option value="joint" ${c.physicalCustodyRequested==="joint" ? "selected" : ""}>Joint</option>
              <option value="sole" ${c.physicalCustodyRequested==="sole" ? "selected" : ""}>Sole</option>
            </select>
          </label>

          <label class="rfoField">
            <span>Primary timeshare requested</span>
            <select id="cu_timeshare">
              <option value="" ${c.primaryTimeshareRequested==="" ? "selected" : ""}>Select…</option>
              <option value="me" ${c.primaryTimeshareRequested==="me" ? "selected" : ""}>Me</option>
              <option value="other" ${c.primaryTimeshareRequested==="other" ? "selected" : ""}>Other party</option>
              <option value="equal" ${c.primaryTimeshareRequested==="equal" ? "selected" : ""}>Equal</option>
            </select>
          </label>

          <label class="rfoField">
            <span>Exchange location</span>
            <select id="cu_exchange">
              <option value="" ${c.exchangeLocation==="" ? "selected" : ""}>Select…</option>
              <option value="school" ${c.exchangeLocation==="school" ? "selected" : ""}>School</option>
              <option value="police_station" ${c.exchangeLocation==="police_station" ? "selected" : ""}>Police station</option>
              <option value="other" ${c.exchangeLocation==="other" ? "selected" : ""}>Other</option>
            </select>
          </label>
        </div>

        <div class="rfoField" style="margin-top:12px;">
          <span>Exchange location (other)</span>
          <input id="cu_exchangeOther" type="text" value="${escapeHtml(c.exchangeLocationOther)}" placeholder="Describe location" ${c.exchangeLocation==="other" ? "" : "disabled"} />
        </div>

        <div class="rfoField" style="margin-top:12px;">
          <span>Notes</span>
          <textarea id="cu_notes" rows="5" placeholder="Brief notes (optional)">${escapeHtml(c.notes)}</textarea>
        </div>
      </div>
    `;

    const legal = stepMount.querySelector("#cu_legal");
    const physical = stepMount.querySelector("#cu_physical");
    const timeshare = stepMount.querySelector("#cu_timeshare");
    const exchange = stepMount.querySelector("#cu_exchange");

    if (legal) legal.addEventListener("change", () => { state.custody.legalCustodyRequested = legal.value; setStatus("Saved."); persist(); });
    if (physical) physical.addEventListener("change", () => { state.custody.physicalCustodyRequested = physical.value; setStatus("Saved."); persist(); });
    if (timeshare) timeshare.addEventListener("change", () => { state.custody.primaryTimeshareRequested = timeshare.value; setStatus("Saved."); persist(); });
    if (exchange) exchange.addEventListener("change", () => { state.custody.exchangeLocation = exchange.value; setStatus("Saved."); persist(); renderStep(); });

    bindInput("#cu_exchangeOther", () => state.custody, "exchangeLocationOther", v => v.trim());
    bindInput("#cu_notes", () => state.custody, "notes", v => v);
  }

  function renderVisitation() {
    const v = state.visitation;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Visitation</h2>

        <div class="rfoField">
          <span>Visitation description</span>
          <textarea id="vi_schedule" rows="7" placeholder="Describe the schedule in plain language.">${escapeHtml(v.scheduleText)}</textarea>
        </div>

        <div class="rfoGrid" style="margin-top:12px;">
          <label class="rfoField">
            <span>Supervision</span>
            <select id="vi_supervision">
              <option value="" ${v.supervisionRequested==="" ? "selected" : ""}>Select…</option>
              <option value="none" ${v.supervisionRequested==="none" ? "selected" : ""}>None</option>
              <option value="supervised" ${v.supervisionRequested==="supervised" ? "selected" : ""}>Supervised</option>
            </select>
          </label>
        </div>

        <div class="rfoField" style="margin-top:12px;">
          <span>Supervision details</span>
          <input id="vi_supervisionDetails" type="text" value="${escapeHtml(v.supervisionDetails)}" placeholder="If supervised, describe who / where / how." ${v.supervisionRequested==="supervised" ? "" : "disabled"} />
        </div>
      </div>
    `;

    bindInput("#vi_schedule", () => state.visitation, "scheduleText", v2 => v2);

    const sup = stepMount.querySelector("#vi_supervision");
    if (sup) {
      sup.addEventListener("change", function () {
        state.visitation.supervisionRequested = sup.value;
        setStatus("Saved.");
        persist();
        renderStep();
      });
    }

    bindInput("#vi_supervisionDetails", () => state.visitation, "supervisionDetails", v2 => v2.trim());
  }

  function renderSupport() {
    const sp = state.support;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Support</h2>

        <div class="rfoGrid">
          <label class="rfoField">
            <span>Child support</span>
            <select id="sp_child">
              <option value="" ${sp.childSupportRequested==="" ? "selected" : ""}>Select…</option>
              <option value="establish" ${sp.childSupportRequested==="establish" ? "selected" : ""}>Establish</option>
              <option value="modify" ${sp.childSupportRequested==="modify" ? "selected" : ""}>Modify</option>
              <option value="terminate" ${sp.childSupportRequested==="terminate" ? "selected" : ""}>Terminate</option>
            </select>
          </label>

          <label class="rfoField">
            <span>Spousal support</span>
            <select id="sp_spousal">
              <option value="" ${sp.spousalSupportRequested==="" ? "selected" : ""}>Select…</option>
              <option value="n_a" ${sp.spousalSupportRequested==="n_a" ? "selected" : ""}>Not applicable</option>
              <option value="establish" ${sp.spousalSupportRequested==="establish" ? "selected" : ""}>Establish</option>
              <option value="modify" ${sp.spousalSupportRequested==="modify" ? "selected" : ""}>Modify</option>
              <option value="terminate" ${sp.spousalSupportRequested==="terminate" ? "selected" : ""}>Terminate</option>
            </select>
          </label>

          <label class="rfoField">
            <span>Requested effective date</span>
            <input id="sp_date" type="date" value="${escapeHtml(sp.requestedEffectiveDate)}" />
          </label>
        </div>

        <label class="rfoCheck" style="margin-top:12px;">
          <input id="sp_guideline" type="checkbox" ${sp.guidelineRequested ? "checked" : ""} />
          <span>Request guideline support</span>
        </label>

        <div class="rfoField" style="margin-top:12px;">
          <span>Notes</span>
          <textarea id="sp_notes" rows="6" placeholder="Brief notes (optional)">${escapeHtml(sp.notes)}</textarea>
        </div>
      </div>
    `;

    const child = stepMount.querySelector("#sp_child");
    const spousal = stepMount.querySelector("#sp_spousal");

    if (child) child.addEventListener("change", () => { state.support.childSupportRequested = child.value; setStatus("Saved."); persist(); });
    if (spousal) spousal.addEventListener("change", () => { state.support.spousalSupportRequested = spousal.value; setStatus("Saved."); persist(); });

    bindInput("#sp_date", () => state.support, "requestedEffectiveDate", v => v);
    bindCheckbox("#sp_guideline", () => state.support, "guidelineRequested");
    bindInput("#sp_notes", () => state.support, "notes", v => v);
  }

  function renderEmergency() {
    const e = state.emergency;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Emergency Details</h2>
        <p class="muted">These questions become required when Emergency is selected.</p>

        <div class="rfoGrid">
          <label class="rfoField">
            <span>Immediate harm risk</span>
            <select id="em_risk">
              <option value="" ${e.immediateHarmRisk==="" ? "selected" : ""}>Select…</option>
              <option value="yes" ${e.immediateHarmRisk==="yes" ? "selected" : ""}>Yes</option>
              <option value="no" ${e.immediateHarmRisk==="no" ? "selected" : ""}>No</option>
            </select>
          </label>

          <label class="rfoField">
            <span>Most recent incident date</span>
            <input id="em_date" type="date" value="${escapeHtml(e.recentIncidentDate)}" />
          </label>

          <label class="rfoField">
            <span>Police report filed</span>
            <select id="em_policeFiled">
              <option value="" ${e.policeReportFiled==="" ? "selected" : ""}>Select…</option>
              <option value="yes" ${e.policeReportFiled==="yes" ? "selected" : ""}>Yes</option>
              <option value="no" ${e.policeReportFiled==="no" ? "selected" : ""}>No</option>
            </select>
          </label>
        </div>

        <div class="rfoField" style="margin-top:12px;">
          <span>Describe the emergency / harm</span>
          <textarea id="em_desc" rows="6" placeholder="What happened? Why is emergency relief needed?">${escapeHtml(e.harmDescription)}</textarea>
        </div>

        <div class="rfoGrid" style="margin-top:12px;">
          <label class="rfoField">
            <span>Police agency</span>
            <input id="em_agency" type="text" value="${escapeHtml(e.policeAgency)}" placeholder="Agency name" ${e.policeReportFiled==="yes" ? "" : "disabled"} />
          </label>

          <label class="rfoField">
            <span>Police report number</span>
            <input id="em_reportNo" type="text" value="${escapeHtml(e.policeReportNumber)}" placeholder="Report #" ${e.policeReportFiled==="yes" ? "" : "disabled"} />
          </label>
        </div>

        <div class="rfoGrid" style="margin-top:12px;">
          <label class="rfoField">
            <span>Prior orders exist</span>
            <select id="em_prior">
              <option value="" ${e.priorOrdersExist==="" ? "selected" : ""}>Select…</option>
              <option value="yes" ${e.priorOrdersExist==="yes" ? "selected" : ""}>Yes</option>
              <option value="no" ${e.priorOrdersExist==="no" ? "selected" : ""}>No</option>
            </select>
          </label>
        </div>

        <div class="rfoField" style="margin-top:12px;">
          <span>Prior orders description</span>
          <input id="em_priorDesc" type="text" value="${escapeHtml(e.priorOrdersDescription)}" placeholder="Brief description" ${e.priorOrdersExist==="yes" ? "" : "disabled"} />
        </div>
      </div>
    `;

    const risk = stepMount.querySelector("#em_risk");
    const policeFiled = stepMount.querySelector("#em_policeFiled");
    const prior = stepMount.querySelector("#em_prior");

    if (risk) risk.addEventListener("change", () => { state.emergency.immediateHarmRisk = risk.value; setStatus("Saved."); persist(); });
    if (policeFiled) policeFiled.addEventListener("change", () => { state.emergency.policeReportFiled = policeFiled.value; setStatus("Saved."); persist(); renderStep(); });
    if (prior) prior.addEventListener("change", () => { state.emergency.priorOrdersExist = prior.value; setStatus("Saved."); persist(); renderStep(); });

    bindInput("#em_date", () => state.emergency, "recentIncidentDate", v => v);
    bindInput("#em_desc", () => state.emergency, "harmDescription", v => v);
    bindInput("#em_agency", () => state.emergency, "policeAgency", v => v.trim());
    bindInput("#em_reportNo", () => state.emergency, "policeReportNumber", v => v.trim());
    bindInput("#em_priorDesc", () => state.emergency, "priorOrdersDescription", v => v.trim());
  }

  function renderReview() {
    const steps = window.RFO_ROUTER.getActiveSteps(state)
      .map(s => s.title)
      .join(" → ");

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Review</h2>
        <p class="muted">Active flow: ${escapeHtml(steps)}</p>

        <div class="rfoReview">
          <pre>${escapeHtml(JSON.stringify(state, null, 2))}</pre>
        </div>

        <p class="muted" style="margin-top:10px;">
          This is a v1 review screen. Output generation comes next.
        </p>
      </div>
    `;
  }

  function renderStep() {
    // If step got removed by routing (checkbox toggles), snap to first valid step.
    const steps = window.RFO_ROUTER.getActiveSteps(state);
    const exists = steps.some(s => s.id === currentStepId);
    if (!exists) currentStepId = steps[0].id;

    // Render by step
    if (currentStepId === "case_info") renderCaseInfo();
    else if (currentStepId === "orders_requested") renderOrdersRequested();
    else if (currentStepId === "custody") renderCustody();
    else if (currentStepId === "visitation") renderVisitation();
    else if (currentStepId === "support") renderSupport();
    else if (currentStepId === "emergency") renderEmergency();
    else renderReview();

    // Button states
    const idx = steps.findIndex(s => s.id === currentStepId);
    btnBack.disabled = idx <= 0;
    btnNext.textContent = (idx >= steps.length - 1) ? "Finish" : "Next";

    renderProgress();
    setStatus("Ready.");
    persist();
  }

  function showValidation(missing) {
    if (!missing || !missing.length) return;
    const msg = "Missing: " + missing.join("; ");
    setStatus(msg);
    alert(msg);
  }

  // Wire buttons
  if (btnSave) {
    btnSave.addEventListener("click", function () {
      const ok = window.RFO_STATE.save(state);
      setStatus(ok ? "Saved." : "Save failed.");
    });
  }

  if (btnReset) {
    btnReset.addEventListener("click", function () {
      const sure = confirm("Reset Request for Order data? This clears your saved answers.");
      if (!sure) return;
      state = window.RFO_STATE.reset();
      currentStepId = "case_info";
      setStatus("Reset.");
      renderStep();
    });
  }

  if (btnBack) {
    btnBack.addEventListener("click", function () {
      currentStepId = window.RFO_ROUTER.prevStepId(state, currentStepId);
      renderStep();
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", function () {
      const missing = window.RFO_ROUTER.validateStep(state, currentStepId);
      if (missing.length) {
        showValidation(missing);
        return;
      }

      const steps = window.RFO_ROUTER.getActiveSteps(state);
      const idx = steps.findIndex(s => s.id === currentStepId);
      if (idx >= steps.length - 1) {
        setStatus("Completed. (Review)");
        return;
      }

      currentStepId = window.RFO_ROUTER.nextStepId(state, currentStepId);
      renderStep();
    });
  }

  // Init
  renderStep();
})();
