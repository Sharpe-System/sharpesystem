/* /rfo/rfo-router.js
   Defines active steps, routing, and validation for the RFO flow.

   Step IDs:
   - case_info
   - orders_requested
   - custody (conditional)
   - visitation (conditional)
   - support (conditional)
   - emergency (conditional)
   - review
*/

(function () {
  "use strict";

  function t(s) { return String(s || "").trim(); }
  function hasChildren(state) {
    const n = Number((state.caseInfo && state.caseInfo.childrenCount) || 0);
    return n > 0;
  }

  function anyOrderSelected(o) {
    if (!o) return false;
    return !!(o.custody || o.visitation || o.support || o.attorneyFees || o.other);
  }

  function emergencyAnchored(o) {
    // Emergency alone is acceptable only if the user describes the relief sought.
    // This avoids dead-ends and matches how emergency relief operates in practice:
    // it's urgent relief tied to a request.
    if (!o || !o.emergency) return false;
    return t(o.otherText).length >= 5; // require something meaningful
  }

  function getActiveSteps(state) {
    const steps = [
      { id: "case_info", title: "Case Information" },
      { id: "orders_requested", title: "Orders Requested" }
    ];

    const o = state.ordersRequested || {};
    const kids = hasChildren(state);

    // If emergency is the only thing checked, we still allow flow
    // as long as the user anchors it with Other text.
    const selectedOrEmergencyOnly = anyOrderSelected(o) || emergencyAnchored(o);

    if (selectedOrEmergencyOnly) {
      if (o.custody) steps.push({ id: "custody", title: "Custody" });
      if (o.visitation) steps.push({ id: "visitation", title: "Visitation" });

      // Only include support if children exist; otherwise it’s effectively invalid.
      if (o.support && kids) steps.push({ id: "support", title: "Support" });

      if (o.emergency) steps.push({ id: "emergency", title: "Emergency Details" });
    } else {
      // Nothing selected yet: keep the user at Orders Requested until valid.
    }

    steps.push({ id: "review", title: "Review" });
    return steps;
  }

  function nextStepId(state, currentId) {
    const steps = getActiveSteps(state);
    const idx = steps.findIndex(s => s.id === currentId);
    if (idx < 0) return steps[0].id;
    return steps[Math.min(idx + 1, steps.length - 1)].id;
  }

  function prevStepId(state, currentId) {
    const steps = getActiveSteps(state);
    const idx = steps.findIndex(s => s.id === currentId);
    if (idx <= 0) return steps[0].id;
    return steps[idx - 1].id;
  }

  function validateStep(state, stepId) {
    const missing = [];

    if (stepId === "case_info") {
      const c = state.caseInfo || {};
      // Keep this light. You can tighten later.
      if (!t(c.state)) missing.push("State is required");
      if (!t(c.county)) missing.push("County is required");
      if (!t(c.caseNumber)) missing.push("Case number is required");
      return missing;
    }

    if (stepId === "orders_requested") {
      const o = state.ordersRequested || {};
      const kids = hasChildren(state);

      // If user selected support but there are no children, treat as missing/invalid.
      const supportValid = o.support && kids;

      const anyValid =
        o.custody ||
        o.visitation ||
        supportValid ||
        o.attorneyFees ||
        o.other;

      // Emergency-only allowed IF anchored by Other text
      if (!anyValid) {
        if (o.emergency) {
          if (t(o.otherText).length < 5) {
            missing.push("Emergency selected — describe the emergency relief requested (Other)");
          }
          return missing;
        }
        missing.push("Select at least one order requested");
        return missing;
      }

      // If Other checked, require Other text
      if (o.other && t(o.otherText).length < 5) {
        missing.push("Other selected — describe the orders requested");
      }

      // If emergency checked, require Other text only when no other boxes are checked.
      if (o.emergency && !anyOrderSelected(o) && t(o.otherText).length < 5) {
        missing.push("Emergency selected — describe the emergency relief requested (Other)");
      }

      return missing;
    }

    if (stepId === "custody") {
      const c = state.custody || {};
      if (!t(c.legalCustodyRequested)) missing.push("Select legal custody requested");
      if (!t(c.physicalCustodyRequested)) missing.push("Select physical custody requested");
      return missing;
    }

    if (stepId === "visitation") {
      const v = state.visitation || {};
      if (t(v.scheduleText).length < 10) missing.push("Provide a visitation description");
      return missing;
    }

    if (stepId === "support") {
      if (!hasChildren(state)) return missing; // should not be reachable
      const sp = state.support || {};
      // At least one support type should be selected
      if (!t(sp.childSupportRequested) && !t(sp.spousalSupportRequested)) {
        missing.push("Select a support request");
      }
      return missing;
    }

    if (stepId === "emergency") {
      const e = state.emergency || {};
      if (!t(e.immediateHarmRisk)) missing.push("Select whether there is immediate harm risk");
      if (t(e.recentIncidentDate).length < 8) missing.push("Most recent incident date is required");
      if (t(e.harmDescription).length < 10) missing.push("Describe the emergency / harm");
      return missing;
    }

    return missing;
  }

  window.RFO_ROUTER = {
    getActiveSteps,
    nextStepId,
    prevStepId,
    validateStep
  };
})();
