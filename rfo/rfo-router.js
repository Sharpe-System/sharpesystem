/* /rfo/rfo-router.js
   RFO module — conditional step sequence + validation rules
*/

(function () {
  "use strict";

  const STEP_DEFS = [
    { id: "case_info", title: "Case Information" },
    { id: "orders_requested", title: "Orders Requested" },
    { id: "custody", title: "Custody" },
    { id: "visitation", title: "Visitation" },
    { id: "support", title: "Support" },
    { id: "emergency", title: "Emergency Details" },
    { id: "review", title: "Review" }
  ];

  function shouldIncludeStep(stepId, state) {
    const o = state.ordersRequested || {};

    if (stepId === "custody") return !!o.custody;
    if (stepId === "visitation") return !!o.visitation;
    if (stepId === "support") return !!o.support;
    if (stepId === "emergency") return !!o.emergency;

    // Always present:
    if (stepId === "case_info") return true;
    if (stepId === "orders_requested") return true;
    if (stepId === "review") return true;

    return false;
  }

  function getActiveSteps(state) {
    return STEP_DEFS.filter(s => shouldIncludeStep(s.id, state));
  }

  function findStepIndex(steps, stepId) {
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].id === stepId) return i;
    }
    return 0;
  }

  function nextStepId(state, currentStepId) {
    const steps = getActiveSteps(state);
    const idx = findStepIndex(steps, currentStepId);
    const next = steps[Math.min(idx + 1, steps.length - 1)];
    return next.id;
  }

  function prevStepId(state, currentStepId) {
    const steps = getActiveSteps(state);
    const idx = findStepIndex(steps, currentStepId);
    const prev = steps[Math.max(idx - 1, 0)];
    return prev.id;
  }

  function requiredMissingCaseInfo(s) {
    const c = s.caseInfo || {};
    const missing = [];
    if (!String(c.state || "").trim()) missing.push("State");
    if (!String(c.county || "").trim()) missing.push("County");
    if (!String(c.caseNumber || "").trim()) missing.push("Case number");
    if (!String(c.petitioner || "").trim()) missing.push("Petitioner");
    if (!String(c.respondent || "").trim()) missing.push("Respondent");
    return missing;
  }

  function requiredMissingOrdersRequested(s) {
    const o = s.ordersRequested || {};
    const any =
      !!o.custody ||
      !!o.visitation ||
      !!o.support ||
      !!o.attorneyFees ||
      !!o.other;

    const missing = [];
    if (!any) missing.push("Select at least one order requested.");

    if (!!o.other && !String(o.otherText || "").trim()) {
      missing.push("Other — describe what you are requesting.");
    }

    return missing;
  }

  function requiredMissingCustody(s) {
    const c = s.custody || {};
    const missing = [];
    if (!String(c.legalCustodyRequested || "").trim()) missing.push("Legal custody requested");
    if (!String(c.physicalCustodyRequested || "").trim()) missing.push("Physical custody requested");
    if (!String(c.primaryTimeshareRequested || "").trim()) missing.push("Primary timeshare requested");
    if (!String(c.exchangeLocation || "").trim()) missing.push("Exchange location");

    if (c.exchangeLocation === "other" && !String(c.exchangeLocationOther || "").trim()) {
      missing.push("Exchange location — other (describe)");
    }
    return missing;
  }

  function requiredMissingVisitation(s) {
    const v = s.visitation || {};
    const missing = [];
    if (!String(v.scheduleText || "").trim()) missing.push("Visitation schedule description");
    return missing;
  }

  function requiredMissingSupport(s) {
    const sp = s.support || {};
    const missing = [];
    if (!String(sp.childSupportRequested || "").trim()) missing.push("Child support request");
    if (!String(sp.spousalSupportRequested || "").trim()) missing.push("Spousal support request");
    return missing;
  }

  function requiredMissingEmergency(s) {
    const e = s.emergency || {};
    const missing = [];
    if (!String(e.immediateHarmRisk || "").trim()) missing.push("Immediate harm risk");
    if (!String(e.harmDescription || "").trim()) missing.push("Describe the emergency / harm");
    if (!String(e.recentIncidentDate || "").trim()) missing.push("Most recent incident date");
    if (!String(e.policeReportFiled || "").trim()) missing.push("Police report filed");
    if (e.policeReportFiled === "yes" && !String(e.policeAgency || "").trim()) missing.push("Police agency");
    if (e.policeReportFiled === "yes" && !String(e.policeReportNumber || "").trim()) missing.push("Police report number");
    return missing;
  }

  function validateStep(state, stepId) {
    if (stepId === "case_info") return requiredMissingCaseInfo(state);
    if (stepId === "orders_requested") return requiredMissingOrdersRequested(state);
    if (stepId === "custody") return requiredMissingCustody(state);
    if (stepId === "visitation") return requiredMissingVisitation(state);
    if (stepId === "support") return requiredMissingSupport(state);
    if (stepId === "emergency") return requiredMissingEmergency(state);
    return []; // review has no required fields for v1
  }

  window.RFO_ROUTER = {
    STEP_DEFS,
    getActiveSteps,
    nextStepId,
    prevStepId,
    validateStep
  };
})();
