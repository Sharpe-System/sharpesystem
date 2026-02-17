// /db.js
// Central Firestore access layer for Sharpe Legal
// AUTH-COMPLIANT: no Firebase re-init, no getAuth(), no listeners, no redirects.
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
/* Timeline (COMPAT BRIDGE: v1 text blob + v2 events array)
 *
 * Accepted inputs:
 *   - writeTimeline(uid, eventsArray)
 *   - writeTimeline(uid, { events: [...], text: "..." })
 *
 * Hardening:
 *   - Only writes timeline.events if events is explicitly provided
 *   - Only writes timeline.text   if text   is explicitly provided
 *   - Prevents accidental overwrite (“clobbering”) of the other field
 * ------------------------------------------------------------------ */

export async function writeTimeline(uid, payload = undefined) {
  let eventsProvided = false;
  let textProvided = false;

  let events;
  let text;

  if (Array.isArray(payload)) {
    eventsProvided = true;
    events = payload;
  } else if (payload && typeof payload === "object") {
    if ("events" in payload) {
      eventsProvided = true;
      events = Array.isArray(payload.events) ? payload.events : [];
    }
    if ("text" in payload) {
      textProvided = true;
      text = typeof payload.text === "string" ? payload.text : "";
    }
  } else if (payload !== undefined) {
    // If someone passes a weird primitive, treat as "no-op" rather than writing junk.
    return;
  }

  // If nothing was explicitly provided, do nothing.
  if (!eventsProvided && !textProvided) return;

  const timeline = {
    updatedAt: new Date().toISOString(),
  };

  if (eventsProvided) timeline.events = events;
  if (textProvided) timeline.text = text;

  await setDoc(
    userRef(uid),
    { timeline },
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
