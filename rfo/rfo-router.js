/* /rfo/rfo-router.js
   Routing + validation for RFO steps.

   Fix: Visitation validation now accepts preset selection as satisfying
   "visitation description" requirement. Only requires typing when preset=custom.
*/

(function () {
  "use strict";

  function toNum(x, defVal) {
    const n = Number(x);
    return Number.isFinite(n) ? n : (defVal || 0);
  }

  function hasChildren(state) {
    const n = toNum(state?.caseInfo?.childrenCount, 0);
    return n > 0;
  }

  function normalizeStr(s) {
    return String(s || "").trim();
  }

  function anyOrderSelected(o) {
    if (!o) return false;
    return !!(o.custody || o.visitation || o.support || o.attorneyFees || o.other);
  }

  function emergencyOnly(o) {
    if (!o) return false;
    // Emergency checked, and no other order type checked.
    const anyOther = !!(o.custody || o.visitation || o.support || o.attorneyFees || o.other);
    return !!o.emergency && !anyOther;
  }

  function buildSteps(state) {
    const steps = [
      { id: "case_info", title: "Case Information" },
      { id: "orders_requested", title: "Orders Requested" }
    ];

    const o = state.ordersRequested || {};

    if (o.custody) steps.push({ id: "custody", title: "Custody" });
    if (o.visitation) steps.push({ id: "visitation", title: "Visitation" });

    // Support should only be reachable if children exist
    if (o.support && hasChildren(state)) steps.push({ id: "support", title: "Support" });

    // Emergency detail step only if emergency checked
    if (o.emergency) steps.push({ id: "emergency", title: "Emergency Details" });

    steps.push({ id: "review", title: "Review" });
    return steps;
  }

  function getActiveSteps(state) {
    return buildSteps(state);
  }

  function idxOf(steps, id) {
    const i = steps.findIndex(s => s.id === id);
    return i >= 0 ? i : 0;
  }

  function nextStepId(state, currentId) {
    const steps = buildSteps(state);
    const i = idxOf(steps, currentId);
    return steps[Math.min(i + 1, steps.length - 1)].id;
  }

  function prevStepId(state, currentId) {
    const steps = buildSteps(state);
    const i = idxOf(steps, currentId);
    return steps[Math.max(i - 1, 0)].id;
  }

  // --- Validation ---------------------------------------------------------

  function validateOrdersRequested(state) {
  const missing = [];
  const o = state.ordersRequested || {};

  // Must select at least one order type OR emergency
  if (!anyOrderSelected(o) && !o.emergency) {
    missing.push("Select at least one order requested");
    return missing;
  }

  // Support cannot be selected when childrenCount=0
  if (o.support && !hasChildren(state)) {
    missing.push("Support cannot be selected when no children are entered");
  }

  // If Other is selected, require otherText
  if (o.other && !normalizeStr(o.otherText)) {
    missing.push("Describe the 'Other' orders requested");
  }

  return missing;
}

  function validateOrdersRequested(state) {
    const missing = [];
    const o = state.ordersRequested || {};

    // Must select at least one order type OR choose emergency+other text
    if (!anyOrderSelected(o) && !o.emergency) {
      missing.push("Select at least one order requested");
      return missing;
    }

    // Support cannot be selected when childrenCount=0
    if (o.support && !hasChildren(state)) {
      missing.push("Support cannot be selected when no children are entered");
    }

    // If Other is selected, require otherText
    if (o.other && !normalizeStr(o.otherText)) {
      missing.push("Describe the 'Other' orders requested");
    }

    return missing;
  }

  function validateCustody(state) {
    const missing = [];
    const c = state.custody || {};
    if (!normalizeStr(c.legalCustodyRequested) && !normalizeStr(c.physicalCustodyRequested)) {
      missing.push("Select legal and/or physical custody requested");
    }
    return missing;
  }

  function validateVisitation(state) {
    const missing = [];
    const v = state.visitation || {};

    // NEW RULE:
    // - If preset is selected and not "custom", that satisfies the requirement.
    // - If preset is "custom", require details (or scheduleText).
    const preset = normalizeStr(v.preset);

    if (!preset) {
      missing.push("Select a visitation schedule preset");
      return missing;
    }

    if (preset === "custom") {
      const details = normalizeStr(v.details) || normalizeStr(v.scheduleText);
      if (!details) missing.push("Provide a visitation description");
    }

    // exchangeLocation and notes are optional
    return missing;
  }

  function validateSupport(state) {
    const missing = [];
    if (!hasChildren(state)) return missing; // support step shouldn’t exist; if it does, don’t block

    const s = state.support || {};
    if (!normalizeStr(s.childSupportRequested)) missing.push("Select child support request type");
    // effective date optional
    return missing;
  }

  function validateEmergency(state) {
    const missing = [];
    const e = state.emergency || {};
    if (!normalizeStr(e.immediateHarmRisk)) missing.push("Select immediate harm risk");
    if (!normalizeStr(e.harmDescription)) missing.push("Describe the emergency / harm");
    // police agency + report number are optional (even if policeReportFiled=yes)
    return missing;
  }

  function validateStep(state, stepId) {
    switch (stepId) {
      case "case_info": return validateCaseInfo(state);
      case "orders_requested": return validateOrdersRequested(state);
      case "custody": return validateCustody(state);
      case "visitation": return validateVisitation(state);
      case "support": return validateSupport(state);
      case "emergency": return validateEmergency(state);
      default: return [];
    }
  }

  window.RFO_ROUTER = {
    getActiveSteps,
    nextStepId,
    prevStepId,
    validateStep
  };
})();
