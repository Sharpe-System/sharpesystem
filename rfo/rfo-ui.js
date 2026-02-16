/* /rfo/rfo-ui.js
   RFO module — rendering + navigation + persistence
   v2 upgrade: Case Information now supports State/County/Courthouse dropdowns with "Other" to prevent dead ends.
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

  // ---- Tab stability: keep focus inside step area ----
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

  // ---- Step renderers ----

  async function renderCaseInfo() {
    const c = state.caseInfo;

    // Load optional locations dataset
    const data = await window.RFO_LOCATIONS.load();
    const stateOptions = window.RFO_LOCATIONS.getStateOptions();

    // Determine whether we have county data for the selected state
    const selectedState = String(c.state || "CA").toUpperCase().trim();
    c.state = selectedState;

    const counties = window.RFO_LOCATIONS.getCountyOptions(data, selectedState);
    const hasCountyData = counties.length > 0;

    // County mode: dropdown if data exists, otherwise manual text
    const countyVal = String(c.county || "").trim();
    const countyIsOther = hasCountyData ? (!counties.includes(countyVal) && countyVal.length > 0) : true;

    // Courthouse data only if county data exists and county is in list
    const courthouseList = (hasCountyData && counties.includes(countyVal))
      ? window.RFO_LOCATIONS.getCourthouseOptions(data, selectedState, countyVal)
      : [];

    const hasCourthouseData = courthouseList.length > 0;
    const courthouseVal = String(c.courthouse || "").trim();

    const courthouseIsOther = hasCourthouseData
      ? (!courthouseList.includes(courthouseVal) && courthouseVal.length > 0)
      : true;

    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Case Information</h2>

        <p class="muted" style="margin-top:0;">
          Choose what you can from dropdowns. If something is not listed, select <strong>Other</strong> and type it in.
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
                  <input id="ci_countyOther" type="text" value="${countyIsOther ? escapeHtml(countyVal) : ""}"
                    placeholder="Type county name" ${countyIsOther ? "" : "disabled"} />
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
                  <input id="ci_courthouseOther" type="text" value="${courthouseIsOther ? escapeHtml(courthouseVal) : ""}"
                    placeholder="Type courthouse name" ${courthouseIsOther ? "" : "disabled"} />
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
          Keep names and locations accurate. This information is used to populate later sections and exports.
        </p>
      </div>
    `;

    // State change: update + re-render (county/courthouse options depend on state)
    const stSel = stepMount.querySelector("#ci_state");
    if (stSel) {
      stSel.addEventListener("change", () => {
        state.caseInfo.state = stSel.value;
        // Reset dependent fields to avoid stale mismatches
        state.caseInfo.county = "";
        state.caseInfo.courthouse = "";
        setStatus("Saved.");
        persist();
        renderStep(); // safe: dependency refresh
      });
    }

    // County binding
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
          // Reset courthouse when county changes
          state.caseInfo.courthouse = "";
          setStatus("Saved.");
          persist();
          renderStep(); // refresh courthouse options
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

    // Courthouse binding
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

    // Remaining simple fields
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
        // If no kids, clear child support selection so it won't block
        if (state.caseInfo.childrenCount === 0 && state.support) {
          state.support.childSupportRequested = "";
        }
        setStatus("Saved.");
        persist();
      });
    }

    installTabTrap();
  }

  // ---- Existing steps (unchanged) ----
  // NOTE: If your current rfo-ui.js already includes other renderers, keep them as-is.
  // This file assumes your existing build already has these step handlers implemented.
  // If you previously replaced rfo-ui.js with a full file from earlier, this section
  // must remain consistent with your router step IDs.

  function renderOrdersRequested() {
    // If you already have your Orders step working, keep it.
    // Minimal placeholder to avoid breaking if you paste this file into a project missing it.
    // Replace with your current Orders step if needed.
    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Orders Requested</h2>
        <p class="muted">This step already exists in your current build.</p>
        <p class="muted">If this placeholder appears, paste your latest working Orders step back into this file.</p>
      </div>
    `;
    installTabTrap();
  }

  function renderReview() {
    const steps = window.RFO_ROUTER.getActiveSteps(state).map(s => s.title).join(" → ");
    stepMount.innerHTML = `
      <div class="rfoSection">
        <h2>Review</h2>
        <p class="muted">Active flow: ${escapeHtml(steps)}</p>
        <pre style="white-space:pre-wrap;border:1px solid var(--border);border-radius:14px;padding:12px;background:rgba(0,0,0,.18);">${escapeHtml(JSON.stringify(state, null, 2))}</pre>
      </div>
    `;
    installTabTrap();
  }

  function renderStep() {
    const steps = window.RFO_ROUTER.getActiveSteps(state);
    const exists = steps.some(s => s.id === currentStepId);
    if (!exists) currentStepId = steps[0].id;

    if (currentStepId === "case_info") {
      // async render
      renderCaseInfo().then(() => {
        finalizeNav();
      });
      return;
    }

    if (currentStepId === "orders_requested") renderOrdersRequested();
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

  // Buttons
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
