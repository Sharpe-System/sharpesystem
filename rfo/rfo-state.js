/* /rfo/rfo-state.js
   RFO module — canon-safe persistence helper.

   Canon rules:
   - NO window.firebase* globals
   - NO Firebase CDN imports
   - Firebase access only via /firebase-config.js exports
   - Gate owns gating; this module does not redirect
*/

import { db, fsDoc, fsGetDoc, fsSetDoc } from "../firebase-config.js";

(function () {
  "use strict";

  const USER_COLLECTION = "users";
  const FIELD_PATH = "rfo"; // stored as users/{uid}.rfo (merge-safe)

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function defaultState() {
    return {
      meta: {
        version: 1,
        updatedAt: "",
      },
      data: {},
    };
  }

  async function load(uid) {
    if (!uid) return defaultState();

    try {
      const ref = fsDoc(db, USER_COLLECTION, uid);
      const snap = await fsGetDoc(ref);
      if (!snap.exists()) return defaultState();

      const docData = snap.data() || {};
      const state = docData[FIELD_PATH];

      if (!state || typeof state !== "object") return defaultState();
      return deepClone(state);
    } catch {
      return defaultState();
    }
  }

  async function save(uid, state) {
    if (!uid) return false;

    const safe = (state && typeof state === "object") ? deepClone(state) : defaultState();
    safe.meta = safe.meta && typeof safe.meta === "object" ? safe.meta : {};
    safe.meta.updatedAt = new Date().toISOString();
    safe.meta.version = safe.meta.version || 1;

    try {
      const ref = fsDoc(db, USER_COLLECTION, uid);
      await fsSetDoc(ref, { [FIELD_PATH]: safe }, { merge: true });
      return true;
    } catch {
      return false;
    }
  }

  // Export as ES module named exports.
  // (No window.* exports; canon forbids those surfaces.)
  export { load, save, defaultState };
})();
