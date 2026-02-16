/* /rfo/rfo-state.js
   SharpeSystem — Request for Order (RFO) module
   Purpose: Single source of truth + persistence layer (localStorage).
   Structure-first. Design later.
*/

(function () {
  "use strict";

  const STORAGE_KEY = "sharpe_rfo_state_v1";

  function nowISO() {
    try { return new Date().toISOString(); } catch (e) { return ""; }
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function defaultState() {
    return {
      meta: {
        version: 1,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        lastStepId: "case_info"
      },

      // SECTION 1 — Case Information
      caseInfo: {
        state: "",             // CA, TX, etc (keep generic)
        county: "",
        courthouse: "",
        caseNumber: "",
        petitioner: "",
        respondent: "",
        relationship: "marriage", // marriage | parentage | domestic_partnership | other
        childrenCount: 0
      },

      // SECTION 2 — Orders Requested
      ordersRequested: {
        custody: false,
        visitation: false,
        support: false,
        attorneyFees: false,
        other: false,
        otherText: "",
        emergency: false
      },

      // SECTION 3 — Custody (Work Block 3)
      custody: {
        legalCustodyRequested: "",   // joint | sole | ""
        physicalCustodyRequested: "",// joint | sole | ""
        primaryTimeshareRequested: "",// me | other | equal | ""
        exchangeLocation: "",        // school | police_station | other | ""
        exchangeLocationOther: "",
        notes: ""
      },

      // SECTION 4 — Visitation (Work Block 3)
      visitation: {
        scheduleText: "",          // freeform description
        supervisionRequested: "",  // none | supervised | ""
        supervisionDetails: ""
      },

      // SECTION 5 — Support (Work Block 3)
      support: {
        childSupportRequested: "",     // establish | modify | terminate | ""
        spousalSupportRequested: "",   // establish | modify | terminate | n_a | ""
        guidelineRequested: true,
        requestedEffectiveDate: "",
        notes: ""
      },

      // Emergency Addendum (Work Block 3 toggle behavior)
      emergency: {
        immediateHarmRisk: "",        // yes | no | ""
        harmDescription: "",
        recentIncidentDate: "",
        policeReportFiled: "",        // yes | no | ""
        policeAgency: "",
        policeReportNumber: "",
        priorOrdersExist: "",         // yes | no | ""
        priorOrdersDescription: ""
      }
    };
  }

  function normalizeState(raw) {
    // Basic guardrails so older/bad state does not crash UI.
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;

    // Merge shallowly by top-level keys; nested keys default if missing.
    const merged = deepClone(base);

    for (const k of Object.keys(base)) {
      if (raw[k] !== undefined && raw[k] !== null) {
        if (typeof base[k] === "object" && !Array.isArray(base[k])) {
          merged[k] = Object.assign({}, base[k], raw[k]);
        } else {
          merged[k] = raw[k];
        }
      }
    }

    // Meta sanity
    merged.meta = Object.assign({}, base.meta, (raw.meta || {}));
    merged.meta.updatedAt = nowISO();

    // Keep lastStepId safe
    if (!merged.meta.lastStepId || typeof merged.meta.lastStepId !== "string") {
      merged.meta.lastStepId = "case_info";
    }

    return merged;
  }

  function load() {
    try {
      const txt = localStorage.getItem(STORAGE_KEY);
      if (!txt) return defaultState();
      const parsed = JSON.parse(txt);
      return normalizeState(parsed);
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      const s = deepClone(state);
      if (!s.meta) s.meta = {};
      s.meta.updatedAt = nowISO();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return true;
    } catch (e) {
      return false;
    }
  }

  function reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    return defaultState();
  }

  // Expose a small API for router/ui.
  window.RFO_STATE = {
    STORAGE_KEY,
    defaultState,
    load,
    save,
    reset,
    normalizeState
  };
})();
