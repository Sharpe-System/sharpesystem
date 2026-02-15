// schema.js
export const USER_SCHEMA_VERSION = 1;

export function defaultUserDoc() {
  return {
    schemaVersion: USER_SCHEMA_VERSION,
    active: false,
    tier: "",

    intake: {
      caseType: "",
      stage: "",
      goal: "",
      risks: "",
      facts: "",
      nextDate: "", // "YYYY-MM-DD"
      updatedAt: "",
    },

    snapshot: {
      generatedAt: "",
    },

    timeline: {
      // array of { date:"YYYY-MM-DD", label:"", note:"" }
      events: [],
      updatedAt: "",
    },

    checklist: {
      // array of { key:"", label:"", done:false }
      items: [],
      updatedAt: "",
    },
  };
}
