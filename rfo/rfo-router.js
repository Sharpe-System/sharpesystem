/* /rfo/rfo-router.js
   RFO Router — step flow + validation + next/prev navigation.

   This version fixes:
   ✅ "Uncaught ReferenceError: validateCaseInfo is not defined"
   ✅ Router validation hard-crash prevention (missing validators no longer block Next)
   ✅ Step IDs aligned to rfo-ui.js: case_info, orders_requested, custody, visitation, support, emergency, review

   Drop-in replacement: paste this entire file as /rfo/rfo-router.js
*/

(function () {
  "use strict";

  function t(s) { return String(s || "").trim(); }
  function asBool(v) { return !!v; }
  function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : (fallback ?? 0);
  }

  function hasChildren(state) {
    const n = num(state?.caseInfo?.childrenCount, 0);
    return n > 0;
  }

  // ---------------------------------------------------------
  // Steps
  // ---------------------------------------------------------
  function getActiveSteps(state) {
    const o = state?.ordersRequested || {};
    const kids = hasChildren(state);

    const steps = [
      { id: "case_info",        title: "Case Information" },
      { id: "orders_requested", title: "Orders Requested" }
    ];

    if (asBool(o.custody)) steps.push({ id: "custody", title: "Custody" });
    if (asBool(o.visitation)) steps.push({ id: "visitation", title: "Visitation" });

    // Support only when: chosen AND children exist
    if (kids && asBool(o.support)) steps.push({ id: "support", title: "Support" });

    // Emergency details step only when emergency selected
    if (asBool(o.emergency)) steps.push({ id: "emergency", title: "Emergency Details" });

    steps.push({ id: "review", title: "Review" });

    return steps;
  }

  function stepIndex(steps, stepId) {
    const idx = steps.findIndex(s => s.id === stepId);
    return idx >= 0 ? idx : 0;
  }

  function prevStepId(state, currentStepId) {
    const steps = getActiveSteps(state);
    const idx = stepIndex(steps, currentStepId);
    return steps[Math.max(0, idx - 1)].id;
  }

  function nextStepId(state, currentStepId) {
    const steps = getActiveSteps(state);
    const idx = stepIndex(steps, currentStepId);
    return steps[Math.min(steps.length - 1, idx + 1)].id;
  }

  // ---------------------------------------------------------
  // Validation (returns array of missing field labels)
  // ---------------------------------------------------------

  // Minimal + reliable: blocks only on true essentials.
  function validateCaseInfo(state) {
    const m = [];
    const c = state?.caseInfo || {};

    if (!t(c.state))       m.push("State");
    if (!t(c.county))      m.push("County");
    if (!t(c.caseNumber))  m.push("Case number");
    if (!t(c.petitioner))  m.push("Petitioner");
    if (!t(c.respondent))  m.push("Respondent");
    if (!t(c.relationship)) m.push("Relationship");

    const n = Number(c.childrenCount);
    if (!Number.isFinite(n) || n < 0) m.push("Number of children");

    return m;
  }

  function validateOrdersRequested(state) {
    const m = [];
    const o = state?.ordersRequested || {};
    const kids = hasChildren(state);

    // Must pick at least one "order type" (not counting emergency as a type by itself)
    const picked =
      asBool(o.custody) ||
      asBool(o.visitation) ||
      (kids && asBool(o.support)) ||
      asBool(o.attorneyFees) ||
      asBool(o.other);

    if (!picked && !asBool(o.emergency)) {
      m.push("Select at least one order requested");
      return m;
    }

    // If "Other" selected OR Emergency selected, require otherText
    if ((asBool(o.other) || asBool(o.emergency)) && !t(o.otherText)) {
      m.push("Other (describe)");
    }

    // If no children, prevent support from being required
    if (!kids && asBool(o.support)) {
      // Don’t block user—just silently allow. UI already disables it.
    }

    return m;
  }

  // These are intentionally permissive to avoid dead-ends while you iterate.
  // Tighten later as needed.
  function validateCustody(_state) { return []; }
  function validateVisitation(_state) { return []; }

  function validateSupport(state) {
    const m = [];
    if (!hasChildren(state)) return m; // support not applicable

    const sp = state?.support || {};
    // If user reached support step, ensure they chose an action
    if (!t(sp.childSupportRequested)) m.push("Child support (select establish/modify/terminate)");
    return m;
  }

  function validateEmergency(state) {
    const m = [];
    const o = state?.ordersRequested || {};
    if (!asBool(o.emergency)) return m;

    const e = state?.emergency || {};
    if (!t(e.immediateHarmRisk)) m.push("Immediate harm risk");
    if (!t(e.recentIncidentDate)) m.push("Most recent incident date");
    if (!t(e.policeReportFiled)) m.push("Police report filed");
    if (!t(e.harmDescription)) m.push("Describe the emergency / harm");

    if (t(e.policeReportFiled) === "yes") {
      if (!t(e.policeAgency)) m.push("Police agency");
      // report number is optional
    }

    return m;
  }

  // Hardened validateStep: never crashes due to missing validators.
  function validateStep(state, stepId) {
    const missing = [];

    // Direct mapping by step id -> validator function
    const map = {
      case_info: validateCaseInfo,
      orders_requested: validateOrdersRequested,
      custody: validateCustody,
      visitation: validateVisitation,
      support: validateSupport,
      emergency: validateEmergency,
      review: null
    };

    const fn = map[stepId];

    if (!fn) return missing;

    try {
      const out = fn(state);
      if (Array.isArray(out) && out.length) missing.push(...out);
    } catch (err) {
      // Never block Next due to validation bugs; log and allow navigation.
      console.warn("[RFO_ROUTER] Validation error (allowing navigation):", stepId, err);
    }

    return missing;
  }

  // ---------------------------------------------------------
  // Export to window
  // ---------------------------------------------------------
  window.RFO_ROUTER = {
    getActiveSteps,
    prevStepId,
    nextStepId,
    validateStep
  };

})();
