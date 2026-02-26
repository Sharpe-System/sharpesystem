// /db.js
// Canon: Firebase CDN imports must live only in /firebase-config.js.
// Thin facade for page modules.

import {
  db,
  fsDoc,
  fsGetDoc,
  fsSetDoc,
  fsUpdateDoc
} from "./firebase-config.js";

// Ensure user doc exists
export async function ensureUserDoc(uid) {
  if (!uid) throw new Error("missing_uid");

  const ref = fsDoc(db, "users", uid);
  const snap = await fsGetDoc(ref);

  if (!snap.exists()) {
    await fsSetDoc(ref, {
      createdAt: new Date().toISOString()
    });
  }
}

// Read user doc
export async function readUserDoc(uid) {
  if (!uid) throw new Error("missing_uid");

  const ref = fsDoc(db, "users", uid);
  const snap = await fsGetDoc(ref);

  return snap.exists() ? snap.data() : null;
}

// Write intake (preserve protected fields)
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

  if ("tier" in cur) patch.tier = cur.tier;
  if ("active" in cur) patch.active = cur.active;
  if ("role" in cur) patch.role = cur.role;

  await fsUpdateDoc(ref, patch);
}

export { db, fsDoc, fsGetDoc, fsSetDoc, fsUpdateDoc };
export default {};
