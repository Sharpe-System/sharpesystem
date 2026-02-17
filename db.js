// /db.js
// Central Firestore access layer for Sharpe Legal
// AUTH-COMPLIANT: no Firebase re-init, no getAuth(), no SDK duplication.
// Uses the frozen exports from /firebase-config.js only.

import { db } from "/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import { defaultUserDoc } from "/schema.js";

/* ------------------------------------------------------------------ */
/* User Reference */
/* ------------------------------------------------------------------ */

export function userRef(uid) {
  return doc(db, "users", uid);
}

/* ------------------------------------------------------------------ */
/* Ensure Base User Document Exists */
/* ------------------------------------------------------------------ */

export async function ensureUserDoc(uid) {
  const ref = userRef(uid);
  const snap = await getDoc(ref);

  if (snap.exists()) return snap.data();

  const base = defaultUserDoc();

  await setDoc(
    ref,
    {
      ...base,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  const snap2 = await getDoc(ref);
  return snap2.exists() ? snap2.data() : base;
}

/* ------------------------------------------------------------------ */
/* Read Entire User Document */
/* ------------------------------------------------------------------ */

export async function readUserDoc(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : null;
}

/* ------------------------------------------------------------------ */
/* Intake */
/* ------------------------------------------------------------------ */

export async function writeIntake(uid, intake = {}) {
  await setDoc(
    userRef(uid),
    {
      intake: {
        caseType: intake.caseType || "",
        stage: intake.stage || "",
        goal: intake.goal || "",
        risks: intake.risks || "",
        facts: intake.facts || "",
        nextDate: intake.nextDate || "",
        updatedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );
}

/* ------------------------------------------------------------------ */
/* Timeline */
/* ------------------------------------------------------------------ */

export async function writeTimeline(uid, events = []) {
  await setDoc(
    userRef(uid),
    {
      timeline: {
        events: Array.isArray(events) ? events : [],
        updatedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );
}

/* ------------------------------------------------------------------ */
/* Checklist */
/* ------------------------------------------------------------------ */

export async function writeChecklist(uid, items = []) {
  await setDoc(
    userRef(uid),
    {
      checklist: {
        items: Array.isArray(items) ? items : [],
        updatedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );
}

/* ------------------------------------------------------------------ */
/* Snapshot Marker */
/* ------------------------------------------------------------------ */

export async function markSnapshotGenerated(uid) {
  await setDoc(
    userRef(uid),
    {
      snapshot: {
        generatedAt: new Date().toISOString(),
      },
    },
    { merge: true }
  );
}
