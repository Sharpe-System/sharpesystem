// login.js (durable)
// - Signs in (email/pass or Google)
// - ENSURES Firestore doc exists at users/{uid} (merge)
// - Redirects to safe ?next= target (defaults to /dashboard.html)

import app from "/firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const googleBtn = document.getElementById("googleBtn");
const msgEl = document.getElementById("msg");

function setMsg(t) {
  if (msgEl) msgEl.textContent = t || "";
  console.log(t || "");
}

// Only allow internal paths (prevents /undefined and prevents open redirects)
function getSafeNext() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("next") || "/dashboard.html";
  let next = raw;

  try { next = decodeURIComponent(raw); } catch (_) {}

  // Must be an internal path
  if (!next.startsWith("/")) next = "/" + next;

  // Block protocol-relative or absolute URLs
  if (next.startsWith("//") || next.startsWith("/http")) next = "/dashboard.html";

  // If someone passed literal "undefined" or empty, normalize
  if (!next || next === "/undefined" || next === "undefined") next = "/dashboard.html";

  return next;
}

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  // If missing, create a baseline doc. Merge protects future schema changes.
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || "",
      active: false,
      tier: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { active: false, tier: "" };
  }

  // If exists, just touch updatedAt (optional but helpful)
  await setDoc(ref, { updatedAt: serverTimestamp() }, { merge: true });

  const d = snap.data() || {};
  return { active: d.active === true, tier: d.tier || "" };
}

async function doRedirect() {
  const next = getSafeNext();
  window.location.replace(next);
}

async function signInEmailPassword() {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    setMsg("Enter email + password.");
    return;
  }

  setMsg("Signing in…");

  // Keep sessions stable (prevents surprise sign-outs on refresh)
  await setPersistence(auth, browserLocalPersistence);

  const cred = await signInWithEmailAndPassword(auth, email, password);
  await ensureUserDoc(cred.user);
  await doRedirect();
}

async function signInGoogle() {
  setMsg("Opening Google…");

  await setPersistence(auth, browserLocalPersistence);

  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  await ensureUserDoc(cred.user);
  await doRedirect();
}

loginBtn?.addEventListener("click", async () => {
  try {
    loginBtn.disabled = true;
    await signInEmailPassword();
  } catch (e) {
    console.log(e);
    setMsg("Login failed. Check credentials.");
  } finally {
    loginBtn.disabled = false;
  }
});

googleBtn?.addEventListener("click", async () => {
  try {
    googleBtn.disabled = true;
    await signInGoogle();
  } catch (e) {
    console.log(e);
    setMsg("Google login failed.");
  } finally {
    googleBtn.disabled = false;
  }
});
