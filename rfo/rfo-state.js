/* /rfo/rfo-state.js
   SharpeSystem — Request for Order (RFO) module
   Firestore-backed persistence layer
   Replaces localStorage with per-user document storage.
*/

(function () {
  "use strict";

  // ---- REQUIREMENTS ----
  // firebase-config.js must initialize:
  //   window.firebaseApp
  //   window.firebaseAuth
  //   window.firebaseDB

  const COLLECTION = "modules";
  const DOC_ID = "rfo";

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

      caseInfo: {
        state: "",
        county: "",
        courthouse: "",
        caseNumber: "",
        petitioner: "",
        respondent: "",
        relationship: "marriage",
        childrenCount: 0
      },

      ordersRequested: {
        custody: false,
        visitation: false,
        support: false,
        attorneyFees: false,
        other: false,
        otherText: "",
        emergency: false
      },

      custody: {
        legalCustodyRequested: "",
        physicalCustodyRequested: "",
        primaryTimeshareRequested: "",
        exchangeLocation: "",
        exchangeLocationOther: "",
        notes: ""
      },

      visitation: {
        scheduleText: "",
        supervisionRequested: "",
        supervisionDetails: ""
      },

      support: {
        childSupportRequested: "",
        spousalSupportRequested: "",
        guidelineRequested: true,
        requestedEffectiveDate: "",
        notes: ""
      },

      emergency: {
        immediateHarmRisk: "",
        harmDescription: "",
        recentIncidentDate: "",
        policeReportFiled: "",
        policeAgency: "",
        policeReportNumber: "",
        priorOrdersExist: "",
        priorOrdersDescription: ""
      }
    };
  }

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;

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

    merged.meta = Object.assign({}, base.meta, raw.meta || {});
    merged.meta.updatedAt = nowISO();

    if (!merged.meta.lastStepId || typeof merged.meta.lastStepId !== "string") {
      merged.meta.lastStepId = "case_info";
    }

    return merged;
  }

  // ---- FIRESTORE HELPERS ----

  async function getUserDocRef() {
    const auth = window.firebaseAuth;
    const db = window.firebaseDB;

    const user = auth.currentUser;
    if (!user) return null;

    return window.firebaseDoc(db, "users", user.uid, COLLECTION, DOC_ID);
  }

  async function load() {
    try {
      const ref = await getUserDocRef();
      if (!ref) return defaultState();

      const snap = await window.firebaseGetDoc(ref);
      if (!snap.exists()) {
        return defaultState();
      }

      return normalizeState(snap.data());
    } catch (e) {
      console.error("RFO load error:", e);
      return defaultState();
    }
  }

  async function save(state) {
    try {
      const ref = await getUserDocRef();
      if (!ref) return false;

      const s = deepClone(state);
      if (!s.meta) s.meta = {};
      s.meta.updatedAt = nowISO();

      await window.firebaseSetDoc(ref, s, { merge: true });
      return true;
    } catch (e) {
      console.error("RFO save error:", e);
      return false;
    }
  }

  async function reset() {
    try {
      const ref = await getUserDocRef();
      if (ref) {
        await window.firebaseSetDoc(ref, defaultState(), { merge: false });
      }
    } catch (e) {
      console.error("RFO reset error:", e);
    }
    return defaultState();
  }

  window.RFO_STATE = {
    defaultState,
    load,
    save,
    reset,
    normalizeState
  };

})();
