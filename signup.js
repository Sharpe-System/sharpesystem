/* /signup.js
   Creates user via Firebase Auth email/password.
   Writes /users/{uid} profile with tier + active.
   If local RFO intake exists, syncs it into Firestore.
*/

import { auth, db } from "/firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function $(id) { return document.getElementById(id); }

const emailEl = $("email");
const passEl = $("password");
const tierEl = $("tier");
const btnCreate = $("btnCreate");
const btnLogin = $("btnLogin");
const msgEl = $("msg");

const LS_STATE_KEY = "rfo_intake_state_v1";
const LS_STEP_KEY  = "rfo_intake_step_v1";

function setMsg(t) { if (msgEl) msgEl.textContent = t || ""; }

function disableUI(disabled) {
  [emailEl, passEl, tierEl, btnCreate, btnLogin].forEach(el => {
    if (el) el.disabled = disabled;
  });
}

function getQueryParam(name) {
  try { return new URL(window.location.href).searchParams.get(name); } catch { return null; }
}

function guessTier() {
  const qp = (getQueryParam("tier") || "").toLowerCase();
  if (qp === "1" || qp === "tier1") return "basic";
  if (qp === "2" || qp === "tier2") return "pro";
  if (qp === "attorney") return "attorney";
  return "free";
}

async function syncLocalIntakeToUser(uid) {
  let intakeRaw = null;
  let step = null;

  try {
    intakeRaw = localStorage.getItem(LS_STATE_KEY);
    step = localStorage.getItem(LS_STEP_KEY);
  } catch (e) {}

  if (!intakeRaw) return;

  let parsed = null;
  try { parsed = JSON.parse(intakeRaw); } catch { parsed = null; }
  if (!parsed || typeof parsed !== "object") return;

  // Store under user doc (simple + versioned). You can later move to subcollection if you want.
  await setDoc(
    doc(db, "users", uid),
    {
      rfoIntake: parsed,
      rfoLastStep: String(step || ""),
      rfoSyncedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

async function doSignup() {
  const email = String(emailEl?.value || "").trim();
  const password = String(passEl?.value || "");
  const tier = String(tierEl?.value || "free");

  if (!email) { setMsg("Enter email."); emailEl?.focus(); return; }
  if (!password || password.length < 6) { setMsg("Password must be at least 6 characters."); passEl?.focus(); return; }

  setMsg("Creating account…");
  disableUI(true);

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Create /users/{uid} profile doc
    await setDoc(
      doc(db, "users", uid),
      {
        tier,
        active: true,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Sync local intake if it exists
    await syncLocalIntakeToUser(uid);

    setMsg("Account created. Redirecting…");
    window.location.href = "/dashboard.html";
  } catch (err) {
    console.error(err);
    const code = String(err?.code || "");
    if (code.includes("auth/email-already-in-use")) setMsg("Email already in use. Log in instead.");
    else if (code.includes("auth/invalid-email")) setMsg("Invalid email.");
    else if (code.includes("auth/weak-password")) setMsg("Weak password (min 6 chars).");
    else setMsg("Signup failed. See console.");
    disableUI(false);
  }
}

btnCreate?.addEventListener("click", doSignup);
btnLogin?.addEventListener("click", () => (window.location.href = "/login.html"));

// Preselect tier from URL
try {
  const t = guessTier();
  if (tierEl) tierEl.value = t;
} catch {}
