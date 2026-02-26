cd ~/Desktop/sharpesystem
cat > db.js <<'EOF'
// /db.js
// Canon DB facade used by pages (intake, snapshot, dashboard, etc).
// Canon: Firebase CDN imports must live only in /firebase-config.js.
// This file MUST only import from /firebase-config.js and expose stable helpers.

import {
  db,
  fsDoc,
  fsGetDoc,
  fsSetDoc,
  fsUpdateDoc
} from "./firebase-config.js";

// Re-export low-level helpers for any legacy callers.
export { db, fsDoc, fsGetDoc, fsSetDoc, fsUpdateDoc };

// ----------
// Canon user doc helpers
// users/{uid}
// ----------

function userDocRef(uid) {
  return fsDoc(db, "users", String(uid));
}

export async function ensureUserDoc(uid) {
  const ref = userDocRef(uid);
  const snap = await fsGetDoc(ref);
  if (snap && snap.exists()) return true;

  // Idempotent create
  await fsSetDoc(
    ref,
    {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
  return true;
}

export async function readUserDoc(uid) {
  const ref = userDocRef(uid);
  const snap = await fsGetDoc(ref);
  if (!snap || !snap.exists()) return null;
  const data = snap.data ? snap.data() : null;
  return data && typeof data === "object" ? data : null;
}

// Intake is stored under users/{uid}.intake
export async function writeIntake(uid, intake) {
  const ref = userDocRef(uid);

  // Ensure doc exists (safe even if it does)
  await ensureUserDoc(uid);

  // Prefer update; fallback to set(merge) if update fails for any reason
  try {
    await fsUpdateDoc(ref, {
      intake: intake || {},
      updatedAt: new Date().toISOString()
    });
  } catch (_) {
    await fsSetDoc(
      ref,
      {
        intake: intake || {},
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  }

  return true;
}

export default {};
EOF
