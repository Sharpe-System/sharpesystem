// /db.js
// Canon: Firebase CDN imports must live only in /firebase-config.js.
// This file is a thin facade used by page modules (intake, etc).

import {
  db,
  fsDoc,
  fsGetDoc,
  fsSetDoc,
  fsUpdateDoc,
  fsCollection
} from "./firebase-config.js";

export { db, fsDoc, fsGetDoc, fsSetDoc, fsUpdateDoc, fsCollection };

function nowIso() {
  return new Date().toISOString();
}

// Ensure users/{uid} exists (idempotent)
export async function ensureUserDoc(uid) {
  if (!uid) throw new Error("missing_uid");
  const ref = fsDoc(db, "users", uid);

  const snap = await fsGetDoc(ref);
  if (snap && snap.exists()) return true;

  await fsSetDoc(
    ref,
    { createdAt: nowIso(), updatedAt: nowIso() },
    { merge: true }
  );
  return true;
}

// Read users/{uid} data (returns {} if missing)
export async function readUserDoc(uid) {
  if (!uid) throw new Error("missing_uid");
  const ref = fsDoc(db, "users", uid);
  const snap = await fsGetDoc(ref);
  if (!snap || !snap.exists()) return {};
  return snap.data() || {};
}

// Write intake payload under users/{uid}.intake (idempotent, merge-safe)
export async function writeIntake(uid, intake) {
  if (!uid) throw new Error("missing_uid");
  if (!intake || typeof intake !== "object") throw new Error("invalid_intake");

  const ref = fsDoc(db, "users", uid);

  // updateDoc fails if doc doesn't exist, so ensure first.
  await ensureUserDoc(uid);

  try {
    await fsUpdateDoc(ref, {
      intake,
      intakeUpdatedAt: nowIso(),
      updatedAt: nowIso()
    });
  } catch {
    // Fallback if update fails for any reason
    await fsSetDoc(
      ref,
      {
        intake,
        intakeUpdatedAt: nowIso(),
        updatedAt: nowIso()
      },
      { merge: true }
    );
  }

  return true;
}

export default {};
