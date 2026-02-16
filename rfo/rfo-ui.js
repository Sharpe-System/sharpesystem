/* /rfo/rfo-ui.js
   RFO module — full UI (all steps) + v2 Case Information dropdowns.
   Finish now saves and returns to /dashboard.html.
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

  function hasChildren() {
    const n = Number((state.caseInfo && state.caseInfo.childrenCount) || 0);
    return n > 0;
  }

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

  // ---- Tab stability: keep focus inside current step ----
  function getFocusableWithinStep() {
    if (!stepMount) return [];
    const nodes = Array.from(stepMount.querySelectorAll(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]'
    ));
    return nodes.filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  function installTabTrap() {
    if (!stepMount) return;

    stepMount.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;

      const focusables = getFocusableWithinStep();
      if (!focusables.length) return;

      const active = document.activeElement;
      const idx = focusables.indexOf(active);

      if (idx === -1) {
        e.preventDefault();
        (e.shiftKey ? focusables[focusables.length - 1] : focusables[0]).focus();
        return;
      }

      e.preventDefault();
      const nextIdx = e.shiftKey ? (idx - 1 + focusables.length) % focusables.length
                                : (idx + 1) % focusables.length;
      focusables[nextIdx].focus();
    }, true);
  }

  // ---- Date formatting (MM/DD/YYYY) ----
  function formatMMDDYYYY(raw) {
    const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
    const mm = digits.slice(0, 2);
    const dd = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);

    let out = mm;
    if (dd.length) out += "/" + dd;
    if (yyyy.length) out += "/" + yyyy;
    return out;
  }

  function bindDateText(selector, getObj, key) {
    const el = stepMount.querySelector(selector);
    if (!el) return;

    el.addEventListener("input", function () {
      const formatted = formatMMDDYYYY(el.value);
      if (el.value !== formatted) {
        el.value = formatted;
        try { el.setSelectionRange(formatted.length, formatted.length); } catch (e) {}
      }
      getObj()[key] = el.value;
      setStatus("Editing…");
      persist();
    });

    el.addEventListener("change", function () {
      getObj()[key] = el.value;
      setStatus("Saved.");
      persist();
    });
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
      const obj = getObj();
      let val = el.value;
      if (transform) val = transform(val);
      obj[key] = val;
      setStatus("Saved.");
      persist();
    });
  }

  function bindCheckboxBasic(selector, getObj, key) {
    const el = stepMount.querySelector(selector);
    if (!el) return;

    el.addEventListener("change", function () {
      const obj = getObj();
      obj[key] = !!el.checked;
      setStatus("Saved.");
      persist();
    });
  }

  function bindRoutingCheckbox(selector, getObj, key) {
    const el = stepMount.querySelector(selector);
    if (!el) return;

    el.addEventListener("change", function () {
      const obj = getObj();
      obj[key] = !!el.checked;
      setStatus("Saved.");
      persist();
      renderProgress();
      renderStep();
    });
  }

  // ---------------------------------------------------------
  // STEP: Case Information (v2 dropdowns)
  // ---------------------------------------------------------
  async function renderCaseInfo() {
    const c = state.caseInfo;

    const data = await window.RFO_LOCATIONS.load();
    const stateOptions = window.RFO_LOCATIONS.getStateOptions();

    const selectedState = String(c.state || "CA").toUpperCase().trim();
    c.state = selectedState;

    const counties = window.RFO_LOCATIONS.getCountyOptions(data, selectedState);
    const hasCountyData = counties.length > 0;

    const countyVal = String(c.county || "").trim();
    const countyIsOther = hasCountyData ? (!!countyVal && !counties.includes(countyVal)) : true;

    const courthouseList = (hasCountyData && counties.includes(countyVal))
      ? window.RFO_LOCATIONS.getCourthouseOptions(data, selectedState, countyVal)
      : [];

    const hasCourthouseData = courthouseList.length > 0;
    const courthouseVal = String(c.courthouse || "").trim();
    const courthouseIsOther = hasCourthouseData ? (!!courthouseVal && !courthouseList.includes(courthouseVal)) : true;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Case Information</h2>

        <p class="muted" style="margin-top:0;">
          Use dropdowns when available. If something is not listed, choose <strong>Other</strong> and type it in.
        </p>

        <div class="rfoGrid">
          <label class="rfoField">
            <span>State</span>
            <select id="ci_state">
              ${stateOptions.map(o =>
                `<option value="${o.code}" ${o.code === selectedState ? "selected" : ""}>${escapeHtml(o.name)}</option>`
              ).join("")}
            </select>
          </label>

          <div class="rfoField">
            <span>County</span>
            ${
              hasCountyData
                ? `
                  <select id="ci_countySelect">
                    <option value="">Select…</option>
                    ${counties.map(name => `<option value="${escapeHtml(name)}" ${name === countyVal ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
                    <option value="__OTHER__" ${countyIsOther ? "selected" : ""}>Other</option>
                  </select>
                  <input id="ci_countyOther" type="text"
                    value="${countyIsOther ? escapeHtml(countyVal) : ""}"
                    placeholder="Type county name"
                    ${countyIsOther ? "" : "disabled"} />
                `
                : `
                  <input id="ci_countyManual" type="text" value="${escapeHtml(countyVal)}" placeholder="Type county name" />
                  <div class="muted" style="font-size:12px;margin-top:6px;">
                    County dropdowns are not loaded for this state yet. Manual entry is fine.
                  </div>
                `
            }
          </div>

          <div class="rfoField">
            <span>Courthouse</span>
            ${
              hasCourthouseData
                ? `
                  <select id="ci_courthouseSelect">
                    <option value="">Select…</option>
                    ${courthouseList.map(name => `<option value="${escapeHtml(name)}" ${name === courthouseVal ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
                    <option value="__OTHER__" ${courthouseIsOther ? "selected" : ""}>Other</option>
                  </select>
                  <input id="ci_courthouseOther" type="text"
                    value="${courthouseIsOther ? escapeHtml(courthouseVal) : ""}"
                    placeholder="Type courthouse name (optional)"
                    ${courthouseIsOther ? "" : "disabled"} />
                `
                : `
                  <input id="ci_courthouseManual" type="text" value="${escapeHtml(courthouseVal)}" placeholder="Type courthouse name (optional)" />
                  <div class="muted" style="font-size:12px;margin-top:6px;">
                    Courthouse dropdowns are not loaded here yet. Manual entry is fine.
                  </div>
                `
            }
          </div>

          <label class="rfoField">
            <span>Case number</span>
            <input id="ci_caseNumber" type="text" value="${escapeHtml(c.caseNumber)}" placeholder="Enter case number" />
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
          This information is used to control later sections and exports.
        </p>
      </div>
    `;

    const stSel = stepMount.querySelector("#ci_state");
    if (stSel) {
      stSel.addEventListener("change", () => {
        state.caseInfo.state = stSel.value;
        state.caseInfo.county = "";
        state.caseInfo.courthouse = "";
        setStatus("Saved.");
        persist();
        renderStep();
      });
    }

    if (hasCountyData) {
      const cSel = stepMount.querySelector("#ci_countySelect");
      const cOther = stepMount.querySelector("#ci_countyOther");

      if (cSel && cOther) {
        cSel.addEventListener("change", () => {
          if (cSel.value === "__OTHER__") {
            cOther.disabled = false;
            cOther.value = "";
            state.caseInfo.county = "";
          } else {
            cOther.disabled = true;
            state.caseInfo.county = cSel.value || "";
          }
          state.caseInfo.courthouse = "";
          setStatus("Saved.");
          persist();
          renderStep();
        });

        cOther.addEventListener("input", () => {
          state.caseInfo.county = cOther.value.trim();
          setStatus("Editing…");
          persist();
        });
        cOther.addEventListener("change", () => {
          state.caseInfo.county = cOther.value.trim();
          setStatus("Saved.");
          persist();
        });
      }
    } else {
      bindInput("#ci_countyManual", () => state.caseInfo, "county", v => v.trim());
    }

    if (hasCourthouseData) {
      const ctSel = stepMount.querySelector("#ci_courthouseSelect");
      const ctOther = stepMount.querySelector("#ci_courthouseOther");

      if (ctSel && ctOther) {
        ctSel.addEventListener("change", () => {
          if (ctSel.value === "__OTHER__") {
            ctOther.disabled = false;
            ctOther.value = "";
            state.caseInfo.courthouse = "";
          } else {
            ctOther.disabled = true;
            state.caseInfo.courthouse = ctSel.value || "";
          }
          setStatus("Saved.");
          persist();
        });

        ctOther.addEventListener("input", () => {
          state.caseInfo.courthouse = ctOther.value.trim();
          setStatus("Editing…");
          persist();
        });
        ctOther.addEventListener("change", () => {
          state.caseInfo.courthouse = ctOther.value.trim();
          setStatus("Saved.");
          persist();
        });
      }
    } else {
      bindInput("#ci_courthouseManual", () => state.caseInfo, "courthouse", v => v.trim());
    }

    bindInput("#ci_caseNumber", () => state.caseInfo, "caseNumber", v => v.trim());
    bindInput("#ci_petitioner", () => state.caseInfo, "petitioner", v => v.trim());
    bindInput("#ci_respondent", () => state.caseInfo, "respondent", v => v.trim());

    const rel = stepMount.querySelector("#ci_relationship");
    if (rel) {
      rel.addEventListener("change", () => {
        state.caseInfo.relationship = rel.value;
        setStatus("Saved.");
        persist();
      });
    }

    const cc = stepMount.querySelector("#ci_childrenCount");
    if (cc) {
      cc.addEventListener("change", () => {
        const n = parseInt(cc.value || "0", 10);
        state.caseInfo.childrenCount = isNaN(n) ? 0 : Math.max(0, n);
        if (!hasChildren() && state.support) state.support.childSupportRequested = "";
        setStatus("Saved.");
        persist();
      });
    }

    installTabTrap();
  }

  // ---------------------------------------------------------
  // STEP: Orders Requested
  // ---------------------------------------------------------
  function renderOrdersRequested() {
    const o = state.ordersRequested;
    const kids = hasChildren();

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Orders Requested</h2>

        <p class="muted" style="margin-top:0;">
          Emergency relief is not a standalone order type — it is urgent relief tied to a specific request
          (custody, visitation, support, fees, or another order you describe).
          <br/><br/>
          If you only want emergency relief, use <strong>Other</strong> and describe exactly what you want the court to order.
        </p>

        <div class="rfoChecks">
          <label class="rfoCheck">
            <input id="or_custody" type="checkbox" ${o.custody ? "checked" : ""} />
            <span>Custody</span>
          </label>

          <label class="rfoCheck">
            <input id="or_visitation" type="checkbox" ${o.visitation ? "checked" : ""} />
            <span>Visitation</span>
          </label>

          <label class="rfoCheck" style="${kids ? "" : "opacity:.6;"}">
            <input id="or_support" type="checkbox" ${o.support ? "checked" : ""} ${kids ? "" : "disabled"} />
            <span>Support ${kids ? "" : "(not available — no children entered)"}</span>
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
            <span>Emergency (adds required questions on the next page)</span>
          </label>
        </div>

        <div class="rfoField" style="margin-top:12px;">
          <span>Other (describe)</span>
          <input id="or_otherText" type="text" value="${escapeHtml(o.otherText)}"
                 placeholder="Describe the specific orders you want (required if Other is selected, or if Emergency is selected by itself)"
                 ${ (o.other || o.emergency) ? "" : "disabled" } />
        </div>
      </div>
    `;

    bindRoutingCheckbox("#or_custody", () => state.ordersRequested, "custody");
    bindRoutingCheckbox("#or_visitation", () => state.ordersRequested, "visitation");
    // support only if children exist
    if (kids) bindRoutingCheckbox("#or_support", () => state.ordersRequested, "support");
    bindRoutingCheckbox("#or_attorneyFees", () => state.ordersRequested, "attorneyFees");
    bindRoutingCheckbox("#or_other", () => state.ordersRequested, "other");
    bindRoutingCheckbox("#or_emergency", () => state.ordersRequested, "emergency");

    const otherText = stepMount.querySelector("#or_otherText");
    const otherToggle = stepMount.querySelector("#or_other");
    const emergencyToggle = stepMount.querySelector("#or_emergency");

    if (otherText && otherToggle && emergencyToggle) {
      const updateEnabled = () => {
        otherText.disabled = !(otherToggle.checked || emergencyToggle.checked);
      };
      updateEnabled();
      otherToggle.addEventListener("change", updateEnabled);
      emergencyToggle.addEventListener("change", updateEnabled);

      otherText.addEventListener("input", () => {
        state.ordersRequested.otherText = otherText.value;
        setStatus("Editing…");
        persist();
      });
      otherText.addEventListener("change", () => {
        state.ordersRequested.otherText = otherText.value;
        setStatus("Saved.");
        persist();
      });
    }

    installTabTrap();
  }

  // ---------------------------------------------------------
  // STEP: Custody
  // ---------------------------------------------------------
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
        </div>

        <div class="rfoField" style="margin-top:12px;">
          <span>Notes (optional)</span>
          <textarea id="cu_notes" rows="5" placeholder="Brief notes">${escapeHtml(c.notes)}</textarea>
        </div>
      </div>
    `;

    const legal = stepMount.querySelector("#cu_legal");
    const physical = stepMount.querySelector("#cu_physical");

    if (legal) legal.addEventListener("change", () => { state.custody.legalCustodyRequested = legal.value; setStatus("Saved."); persist(); });
    if (physical) physical.addEventListener("change", () => { state.custody.physicalCustodyRequested = physical.value; setStatus("Saved."); persist(); });

    bindInput("#cu_notes", () => state.custody, "notes", t => t);

    installTabTrap();
  }

  // ---------------------------------------------------------
  // STEP: Visitation
  // ---------------------------------------------------------
  function renderVisitation() {
    const v = state.visitation;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Visitation</h2>

        <div class="rfoField">
          <span>Visitation description</span>
          <textarea id="vi_schedule" rows="7" placeholder="Describe the schedule in plain language.">${escapeHtml(v.scheduleText)}</textarea>
        </div>
      </div>
    `;

    bindInput("#vi_schedule", () => state.visitation, "scheduleText", t => t);

    installTabTrap();
  }

  // ---------------------------------------------------------
  // STEP: Support
  // ---------------------------------------------------------
  function renderSupport() {
    const sp = state.support;
    const kids = hasChildren();

    if (!kids) {
      // safety: should not be routed here
      stepMount.innerHTML = `
        <div class="rfoSection">
          <h2>Support</h2>
          <p class="muted">Support is not available because no children were entered.</p>
        </div>
      `;
      installTabTrap();
      return;
    }

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
            <span>Requested effective date (MM/DD/YYYY)</span>
            <input id="sp_date" type="text" inputmode="numeric" value="${escapeHtml(sp.requestedEffectiveDate)}" placeholder="MM/DD/YYYY" />
          </label>
        </div>

        <label class="rfoCheck" style="margin-top:12px;">
          <input id="sp_guideline" type="checkbox" ${sp.guidelineRequested ? "checked" : ""} />
          <span>Request guideline support</span>
        </label>

        <div class="rfoField" style="margin-top:12px;">
          <span>Notes (optional)</span>
          <textarea id="sp_notes" rows="6" placeholder="Brief notes">${escapeHtml(sp.notes)}</textarea>
        </div>
      </div>
    `;

    const child = stepMount.querySelector("#sp_child");
    if (child) child.addEventListener("change", () => { state.support.childSupportRequested = child.value; setStatus("Saved."); persist(); });

    bindDateText("#sp_date", () => state.support, "requestedEffectiveDate");
    bindCheckboxBasic("#sp_guideline", () => state.support, "guidelineRequested");
    bindInput("#sp_notes", () => state.support, "notes", t => t);

    installTabTrap();
  }

  // ---------------------------------------------------------
  // STEP: Emergency Details
  // ---------------------------------------------------------
  function renderEmergency() {
    const e = state.emergency;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Emergency Details</h2>
        <p class="muted">These questions are required when Emergency is selected.</p>

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
            <span>Most recent incident date (MM/DD/YYYY)</span>
            <input id="em_date" type="text" inputmode="numeric" value="${escapeHtml(e.recentIncidentDate)}" placeholder="MM/DD/YYYY" />
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
            <span>Police report number (if available)</span>
            <input id="em_reportNo" type="text" value="${escapeHtml(e.policeReportNumber)}" placeholder="Optional" ${e.policeReportFiled==="yes" ? "" : "disabled"} />
          </label>
        </div>
      </div>
    `;

    const risk = stepMount.querySelector("#em_risk");
    const policeFiled = stepMount.querySelector("#em_policeFiled");
    const agency = stepMount.querySelector("#em_agency");
    const reportNo = stepMount.querySelector("#em_reportNo");

    if (risk) risk.addEventListener("change", () => { state.emergency.immediateHarmRisk = risk.value; setStatus("Saved."); persist(); });

    bindDateText("#em_date", () => state.emergency, "recentIncidentDate");
    bindInput("#em_desc", () => state.emergency, "harmDescription", t => t);

    if (policeFiled && agency && reportNo) {
      policeFiled.addEventListener("change", () => {
        state.emergency.policeReportFiled = policeFiled.value;
        const on = (policeFiled.value === "yes");
        agency.disabled = !on;
        reportNo.disabled = !on;
        setStatus("Saved.");
        persist();
      });
    }

    bindInput("#em_agency", () => state.emergency, "policeAgency", t => t.trim());
    bindInput("#em_reportNo", () => state.emergency, "policeReportNumber", t => t.trim());

    installTabTrap();
  }

  // ---------------------------------------------------------
  // STEP: Review
  // ---------------------------------------------------------
  function renderReview() {
    const steps = window.RFO_ROUTER.getActiveSteps(state).map(s => s.title).join(" → ");
    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Review</h2>
        <p class="muted">Active flow: ${escapeHtml(steps)}</p>
        <div class="rfoReview">
          <pre>${escapeHtml(JSON.stringify(state, null, 2))}</pre>
        </div>
        <p class="muted" style="margin-top:10px;">
          Next: export / filing packet generation (coming next). For now, this saves your structured intake.
        </p>
      </div>
    `;
    installTabTrap();
  }

  // ---------------------------------------------------------
  // Step dispatcher + navigation
  // ---------------------------------------------------------
  function renderStep() {
    const steps = window.RFO_ROUTER.getActiveSteps(state);
    const exists = steps.some(s => s.id === currentStepId);
    if (!exists) currentStepId = steps[0].id;

    if (currentStepId === "case_info") {
      renderCaseInfo().then(finalizeNav);
      return;
    }

    if (currentStepId === "orders_requested") renderOrdersRequested();
    else if (currentStepId === "custody") renderCustody();
    else if (currentStepId === "visitation") renderVisitation();
    else if (currentStepId === "support") renderSupport();
    else if (currentStepId === "emergency") renderEmergency();
    else renderReview();

    finalizeNav();
  }

  function finalizeNav() {
    const steps = window.RFO_ROUTER.getActiveSteps(state);
    const idx = steps.findIndex(s => s.id === currentStepId);

    if (btnBack) btnBack.disabled = idx <= 0;
    if (btnNext) btnNext.textContent = (idx >= steps.length - 1) ? "Finish" : "Next";

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

  // Save/Reset
  if (btnSave) {
    btnSave.addEventListener("click", () => {
      const ok = window.RFO_STATE.save(state);
      setStatus(ok ? "Saved." : "Save failed.");
    });
  }

  if (btnReset) {
    btnReset.addEventListener("click", () => {
      const sure = confirm("Reset Request for Order data? This clears your saved answers.");
      if (!sure) return;
      state = window.RFO_STATE.reset();
      currentStepId = "case_info";
      setStatus("Reset.");
      renderStep();
    });
  }

  // Back/Next
  if (btnBack) {
    btnBack.addEventListener("click", () => {
      currentStepId = window.RFO_ROUTER.prevStepId(state, currentStepId);
      renderStep();
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      const missing = window.RFO_ROUTER.validateStep(state, currentStepId);
      if (missing.length) {
        showValidation(missing);
        return;
      }

      const steps = window.RFO_ROUTER.getActiveSteps(state);
      const idx = steps.findIndex(s => s.id === currentStepId);

      if (idx >= steps.length - 1) {
        // Finish behavior: save + return to dashboard
        window.RFO_STATE.save(state);
        setStatus("Saved. Returning to dashboard…");
        setTimeout(() => {
          window.location.href = "/dashboard.html";
        }, 250);
        return;
      }

      currentStepId = window.RFO_ROUTER.nextStepId(state, currentStepId);
      renderStep();
    });
  }

  // Init
  renderStep();
})();
