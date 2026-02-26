// /db.js
// Canon: Firebase CDN imports must live only in /firebase-config.js.
// This file is a thin facade used by page modules (intake, etc).

import {
  db,
  fsDoc,
  fsGetDoc,
  fsSetDoc,
  fsUpdateDoc
} from "./firebase-config.js";

// Create the user doc if it doesn't exist.
// IMPORTANT: we only CREATE here. We do NOT update tier/active/role client-side.
export async function ensureUserDoc(uid) {
  if (!uid) throw new Error("missing_uid");

  const ref = fsDoc(db, "users", uid);
  const snap = await fsGetDoc(ref);

  if (snap.exists()) return;

  // Only minimal safe defaults. Do not include tier/active/role here unless you *intend*
  // the client to be able to create them. Create is allowed by your rules anyway.
  await fsSetDoc(ref, {
    createdAt: new Date().toISOString()
  });
}

export async function readUserDoc(uid) {
  if (!uid) throw new Error("missing_uid");
  const ref = fsDoc(db, "users", uid);
  const snap = await fsGetDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Write intake WITHOUT touching other fields (critical for your rules).
export async function writeIntake(uid, intake) {
  if (!uid) throw new Error("missing_uid");

  const ref = fsDoc(db, "users", uid);
  const snap = await fsGetDoc(ref);
  if (!snap.exists()) throw new Error("user_doc_missing");

  const cur = snap.data() || {};
  const patch = {
    intake,
    updatedAt: new Date().toISOString()
  };

  // IMPORTANT: only preserve protected fields if they already exist.
  if (Object.prototype.hasOwnProperty.call(cur, "tier")) patch.tier = cur.tier;
  if (Object.prototype.hasOwnProperty.call(cur, "active")) patch.active = cur.active;
  if (Object.prototype.hasOwnProperty.call(cur, "role")) patch.role = cur.role;

  await fsUpdateDoc(ref, patch);
}

// Keep legacy exports if anything else imports them
export { db, fsDoc, fsGetDoc, fsSetDoc, fsUpdateDoc };
export default {};
