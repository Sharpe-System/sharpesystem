/* /rfo/schema.js
   SharpeSystem — RFO Schema + Migration + Hardening Layer

   What this does (quietly, automatically):
   - Defines a single canonical RFO state shape (schemaVersioned).
   - Migrates older saved drafts forward (including old visitation fields).
   - Normalizes types (numbers, strings, booleans).
   - Ensures required objects always exist (no undefined chains).
   - Wraps window.RFO_STATE.load/save/reset so every read/write is sanitized.
   - Provides export helpers (structured summary + clean JSON).

   Safe to drop in even if some keys already exist.
*/

(function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = "rfoDraft"; // informational; real key lives in rfo-state.js

  // -----------------------------
  // Utilities
  // -----------------------------
  function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }
  function s(x) { return String(x == null ? "" : x).trim(); }
  function upper2(x) { return s(x).toUpperCase().slice(0, 2); }
  function bool(x) { return x === true || x === "true" || x === 1 || x === "1"; }

  function int0(x) {
    const n = parseInt(String(x ?? ""), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function clampInt(x, min, max) {
    const n = int0(x);
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch (e) { return ""; }
  }

  function deepClone(x) {
    try { return JSON.parse(JSON.stringify(x)); } catch (e) { return null; }
  }

  // -----------------------------
  // Canonical defaults
  // -----------------------------
  function defaults() {
    return {
      schemaVersion: SCHEMA_VERSION,
      draftId: "draft_" + Math.random().toString(16).slice(2),
      createdAt: nowIso(),
      updatedAt: nowIso(),

      caseInfo: {
        state: "CA",
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
        emergency: false,
        otherText: ""
      },

      custody: {
        legalCustodyRequested: "",
        physicalCustodyRequested: "",
        notes: ""
      },

      visitation: {
        // New model:
        // preset: one of: alt_weekends, 2255, 223, 77, 6040, 7030, supervised, custom
        preset: "",
        details: "",
        exchangeLocation: "",
        notes: "",

        // Legacy compatibility:
        scheduleText: ""
      },

      support: {
        childSupportRequested: "",
        requestedEffectiveDate: "",
        guidelineRequested: false,
        notes: ""
      },

      emergency: {
        immediateHarmRisk: "",
        recentIncidentDate: "",
        policeReportFiled: "",
        policeAgency: "",
        policeReportNumber: "",
        harmDescription: ""
      },

      meta: {
        lastStepId: "case_info",
        grievances: ""
      }
    };
  }

  // -----------------------------
  // Migration
  // -----------------------------
  function migrateToV1(d) {
    // V0 → V1: visitation moved to preset model.
    // If older drafts used visitationDescription / scheduleText, keep it in details when appropriate.
    if (!isObj(d)) return d;

    d.schemaVersion = 1;

    if (isObj(d.visitation)) {
      const v = d.visitation;

      // If a legacy field exists, preserve it.
      const legacy =
        s(v.visitationDescription) ||
        s(v.description) ||
        s(v.scheduleText) ||
        s(v.details);

      // If preset missing but legacy text exists, treat as custom.
      if (!s(v.preset) && legacy) {
        v.preset = "custom";
        v.details = legacy;
      }

      // Normalize legacy property names
      if (!s(v.details) && legacy) v.details = legacy;

      // Keep scheduleText in sync for any older code paths (harmless)
      if (!s(v.scheduleText) && s(v.details)) v.scheduleText = v.details;

      // Remove junk keys (optional)
      // delete v.visitationDescription; delete v.description;
    }

    return d;
  }

  function migrateAny(d) {
    if (!isObj(d)) return d;
    const v = int0(d.schemaVersion);
    if (v < 1) d = migrateToV1(d);
    return d;
  }

  // -----------------------------
  // Sanitize + Ensure shape
  // -----------------------------
  function ensureShape(d) {
    const base = defaults();
    const out = base;

    // shallow merge top-level known keys only
    if (isObj(d)) {
      for (const k of Object.keys(base)) {
        if (k in d) out[k] = deepMergeKnown(base[k], d[k]);
      }
    }

    // hard fields
    out.schemaVersion = SCHEMA_VERSION;

    // timestamps
    out.createdAt = s(out.createdAt) || nowIso();
    out.updatedAt = nowIso();

    // normalize caseInfo
    out.caseInfo.state = upper2(out.caseInfo.state || "CA") || "CA";
    out.caseInfo.county = s(out.caseInfo.county);
    out.caseInfo.courthouse = s(out.caseInfo.courthouse);
    out.caseInfo.caseNumber = s(out.caseInfo.caseNumber);
    out.caseInfo.petitioner = s(out.caseInfo.petitioner);
    out.caseInfo.respondent = s(out.caseInfo.respondent);
    out.caseInfo.relationship = s(out.caseInfo.relationship) || "marriage";
    out.caseInfo.childrenCount = clampInt(out.caseInfo.childrenCount, 0, 20);

    // normalize ordersRequested booleans
    const o = out.ordersRequested;
    o.custody = bool(o.custody);
    o.visitation = bool(o.visitation);
    o.support = bool(o.support);
    o.attorneyFees = bool(o.attorneyFees);
    o.other = bool(o.other);
    o.emergency = bool(o.emergency);
    o.otherText = s(o.otherText);

    // rule: if no children, support cannot be selected
    if (out.caseInfo.childrenCount <= 0) {
      out.ordersRequested.support = false;
      out.support.childSupportRequested = "";
      out.support.requestedEffectiveDate = "";
      out.support.guidelineRequested = false;
      out.support.notes = s(out.support.notes);
    }

    // custody
    out.custody.legalCustodyRequested = s(out.custody.legalCustodyRequested);
    out.custody.physicalCustodyRequested = s(out.custody.physicalCustodyRequested);
    out.custody.notes = s(out.custody.notes);

    // visitation
    const v = out.visitation;
    v.preset = s(v.preset);
    v.details = s(v.details);
    v.exchangeLocation = s(v.exchangeLocation);
    v.notes = s(v.notes);
    v.scheduleText = s(v.scheduleText);

    // keep legacy scheduleText aligned with details
    if (!v.details && v.scheduleText) v.details = v.scheduleText;
    if (!v.scheduleText && v.details) v.scheduleText = v.details;

    // support
    out.support.childSupportRequested = s(out.support.childSupportRequested);
    out.support.requestedEffectiveDate = s(out.support.requestedEffectiveDate);
    out.support.guidelineRequested = bool(out.support.guidelineRequested);
    out.support.notes = s(out.support.notes);

    // emergency
    out.emergency.immediateHarmRisk = s(out.emergency.immediateHarmRisk);
    out.emergency.recentIncidentDate = s(out.emergency.recentIncidentDate);
    out.emergency.policeReportFiled = s(out.emergency.policeReportFiled);
    out.emergency.policeAgency = s(out.emergency.policeAgency);
    out.emergency.policeReportNumber = s(out.emergency.policeReportNumber);
    out.emergency.harmDescription = s(out.emergency.harmDescription);

    // meta
    out.meta.lastStepId = s(out.meta.lastStepId) || "case_info";
    out.meta.grievances = s(out.meta.grievances);

    return out;
  }

  function deepMergeKnown(template, value) {
    // Only merges keys that exist in template (prevents garbage from polluting state).
    if (!isObj(template)) return value == null ? template : value;

    const out = deepClone(template) || template;
    if (!isObj(value)) return out;

    for (const k of Object.keys(template)) {
      if (!(k in value)) continue;
      const tv = template[k];
      const vv = value[k];
      if (isObj(tv)) out[k] = deepMergeKnown(tv, vv);
      else out[k] = vv;
    }
    return out;
  }

  // -----------------------------
  // Exports (for later)
  // -----------------------------
  function exportJson(state) {
    const clean = ensureShape(migrateAny(deepClone(state) || state));
    return clean;
  }

  function exportSummary(state) {
    const st = exportJson(state);

    const lines = [];
    lines.push("REQUEST FOR ORDER — DRAFT SUMMARY");
    lines.push("");
    lines.push("CASE INFORMATION");
    lines.push(`State: ${st.caseInfo.state}`);
    lines.push(`County: ${st.caseInfo.county || "—"}`);
    lines.push(`Courthouse: ${st.caseInfo.courthouse || "—"}`);
    lines.push(`Case number: ${st.caseInfo.caseNumber || "—"}`);
    lines.push(`Petitioner: ${st.caseInfo.petitioner || "—"}`);
    lines.push(`Respondent: ${st.caseInfo.respondent || "—"}`);
    lines.push(`Relationship: ${st.caseInfo.relationship || "—"}`);
    lines.push(`Children: ${st.caseInfo.childrenCount}`);
    lines.push("");

    lines.push("ORDERS REQUESTED");
    const o = st.ordersRequested;
    const picks = [];
    if (o.custody) picks.push("Custody");
    if (o.visitation) picks.push("Visitation");
    if (o.support) picks.push("Support");
    if (o.attorneyFees) picks.push("Attorney fees");
    if (o.other) picks.push("Other");
    lines.push(`Selected: ${picks.length ? picks.join(", ") : "—"}`);
    lines.push(`Emergency: ${o.emergency ? "Yes" : "No"}`);
    if (o.otherText) lines.push(`Other description: ${o.otherText}`);
    lines.push("");

    if (o.custody) {
      lines.push("CUSTODY");
      lines.push(`Legal: ${st.custody.legalCustodyRequested || "—"}`);
      lines.push(`Physical: ${st.custody.physicalCustodyRequested || "—"}`);
      if (st.custody.notes) lines.push(`Notes: ${st.custody.notes}`);
      lines.push("");
    }

    if (o.visitation) {
      lines.push("VISITATION");
      lines.push(`Preset: ${st.visitation.preset || "—"}`);
      if (st.visitation.details) lines.push(`Details: ${st.visitation.details}`);
      if (st.visitation.exchangeLocation) lines.push(`Exchange: ${st.visitation.exchangeLocation}`);
      if (st.visitation.notes) lines.push(`Notes: ${st.visitation.notes}`);
      lines.push("");
    }

    if (o.support && st.caseInfo.childrenCount > 0) {
      lines.push("SUPPORT");
      lines.push(`Child support: ${st.support.childSupportRequested || "—"}`);
      if (st.support.requestedEffectiveDate) lines.push(`Effective date: ${st.support.requestedEffectiveDate}`);
      lines.push(`Guideline requested: ${st.support.guidelineRequested ? "Yes" : "No"}`);
      if (st.support.notes) lines.push(`Notes: ${st.support.notes}`);
      lines.push("");
    }

    if (o.emergency) {
      lines.push("EMERGENCY DETAILS");
      lines.push(`Immediate harm risk: ${st.emergency.immediateHarmRisk || "—"}`);
      lines.push(`Recent incident date: ${st.emergency.recentIncidentDate || "—"}`);
      lines.push(`Police report filed: ${st.emergency.policeReportFiled || "—"}`);
      if (st.emergency.policeAgency) lines.push(`Agency: ${st.emergency.policeAgency}`);
      if (st.emergency.policeReportNumber) lines.push(`Report #: ${st.emergency.policeReportNumber}`);
      if (st.emergency.harmDescription) lines.push(`Description: ${st.emergency.harmDescription}`);
      lines.push("");
    }

    // Emotion capture lives here, NOT in the structured export
    if (st.meta.grievances) {
      lines.push("OPTIONAL CONTEXT (NOT FOR FILING TEXT)");
      lines.push(st.meta.grievances);
      lines.push("");
    }

    return lines.join("\n");
  }

  // -----------------------------
  // Hook into RFO_STATE (if present)
  // -----------------------------
  function hardenStateApi() {
    const api = window.RFO_STATE;
    if (!api || api.__schemaWrapped) return;

    const original = {
      load: api.load ? api.load.bind(api) : null,
      save: api.save ? api.save.bind(api) : null,
      reset: api.reset ? api.reset.bind(api) : null
    };

    if (original.load) {
      api.load = function () {
        const raw = original.load();
        const migrated = migrateAny(raw);
        const clean = ensureShape(migrated);
        return clean;
      };
    }

    if (original.save) {
      api.save = function (draft) {
        const migrated = migrateAny(draft);
        const clean = ensureShape(migrated);
        return original.save(clean);
      };
    }

    if (original.reset) {
      api.reset = function () {
        const fresh = defaults();
        const clean = ensureShape(fresh);
        return original.reset(clean) || clean;
      };
    }

    api.__schemaWrapped = true;
    api.__schemaVersion = SCHEMA_VERSION;
  }

  // Expose schema helpers
  window.RFO_SCHEMA = {
    version: SCHEMA_VERSION,
    defaults,
    migrate: migrateAny,
    ensureShape,
    exportJson,
    exportSummary
  };

  // Wrap state API now (and again on next tick in case scripts load out of order)
  hardenStateApi();
  setTimeout(hardenStateApi, 0);

  // Optional: announce in console (useful when debugging)
  try {
    console.log("[RFO_SCHEMA] Loaded. Schema v" + SCHEMA_VERSION + ". Hardening RFO_STATE.");
    console.log("[RFO_SCHEMA] Storage key hint:", STORAGE_KEY);
  } catch (e) {}
})();
