/* /rfo/rfo-state.js
   FirebaseConan shim:
   - Sources Auth/Firestore ONLY from /firebase-config.js (canon).
   - Exposes backward-compatible window.firebase* handles (optional legacy support).
   - Contains NO redirect logic, NO tier checks. gate.js owns enforcement.

   Requirement:
   - /firebase-config.js must export: auth, db
     (db = Firestore instance)
*/

import { auth, db } from "../firebase-config.js";

/* ---------- Back-compat surface (legacy callers) ---------- */
try {
  // Provide handles for older code that still reads these, without being a separate surface.
  window.firebaseAuth = auth;
  window.firebaseDB = db;
  // window.firebaseFS historically sometimes meant "Firestore module" — do NOT provide SDK module surface here.
  // If legacy code expects firebaseFS, keep it as the db instance alias to avoid drift.
  window.firebaseFS = db;
} catch (_) {
  // non-browser environments
}

/* ---------- Canon exports for RFO module usage ---------- */
export { auth, db };

/* ---------- Optional helpers (safe, non-gating) ---------- */

// Canon location for RFO draft state (scoped to user)
export function rfoDraftRef(uid) {
  // Lazy import to keep this file purely boundary-safe.
  // If you prefer, move these to a canon /db.js.
  return { collection: "rfoDrafts", docId: uid };
}
