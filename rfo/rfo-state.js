/* /rfo/rfo-state.js
   Canon boundary shim:
   - Sources Auth/Firestore ONLY from /firebase-config.js (canon).
   - NO window.firebase* globals (forbidden).
   - NO redirect logic, NO tier checks. gate.js owns enforcement.

   Requirement:
   - /firebase-config.js must export: auth, db
*/

import { auth, db } from "/firebase-config.js";

/* ---------- Canon exports for RFO module usage ---------- */
export { auth, db };

/* ---------- Optional helpers (safe, non-gating) ---------- */

// Canon location for RFO draft state (scoped to user)
export function rfoDraftRef(uid) {
  return { collection: "rfoDrafts", docId: uid };
}
