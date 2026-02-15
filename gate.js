// /gate.js
// Centralized login + tier gating.
// Assumes Firestore user docs at: users/{uid}

import app from "/firebase-config.js";
import { defaultUserDoc } from "/schema.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const auth = getAuth(app);
export const db = getFirestore(app);

const USERS_COL = "users";

export function requireLogin(nextPath){
  const next = encodeURIComponent(nextPath || window.location.pathname);
  window.location.replace(`/login.html?next=${next}`);
}

export async function ensureUserDoc(uid){
  const ref = doc(db, USERS_COL, uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const d = defaultUserDoc();
    await setDoc(ref, d, { merge: true });
    return d;
  }

  const data = snap.data() || {};
  if (typeof data.schemaVersion !== "number") {
    const merged = { ...defaultUserDoc(), ...data };
    await setDoc(ref, merged, { merge: true });
    return merged;
  }

  return data;
}

export async function readUserDoc(uid){
  const ref = doc(db, USERS_COL, uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() || null) : null;
}

export async function updateUserDoc(uid, patch){
  const ref = doc(db, USERS_COL, uid);
  await updateDoc(ref, patch);
}

export function requireTier1(){
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return requireLogin(window.location.pathname);

      try {
        const u = await ensureUserDoc(user.uid);
        const active = u?.active === true;
        const tier = String(u?.tier || "");

        if (!active || tier !== "tier1") {
          window.location.replace("/tier1.html");
          return;
        }

        resolve({ user, userDoc: u });
      } catch (e) {
        console.log(e);
        window.location.replace("/tier1.html");
      }
    });
  });
}
