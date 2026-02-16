/* /login.js
   Login + post-login sync
   - Signs in with email/password
   - After successful login, syncs local RFO intake (if present) into Firestore:
       /users/{uid}  (merge)
       fields: rfoIntake, rfoLastStep, rfoSyncedAt
   - Then redirects to /dashboard.html
*/

import { auth, db } from "/firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function $(id) { return document.getElementById(id); }

const emailEl = $("email");
const passEl  = $("password");
const btnLogin = $("btnLogin");
const btnSignup = $("btnSignup");
const msgEl = $("msg");

const LS_STATE_KEY = "rfo_intake_state_v1";
const LS_STEP_KEY  = "rfo_intake_step_v1";

function setMsg(text) {
  if (msgEl) msgEl.textContent = text || "";
}

function disableUI(disabled) {
  if (btnLogin) btnLogin.disabled = disabled;
  if (btnSignup) btnSignup.disabled = disabled;
  if (emailEl) emailEl.disabled = disabled;
  if (passEl) passEl.disabled = disabled;
}

function readLocalIntake() {
  try {
    const raw = localStorage.getItem(LS_STATE_KEY);
    const step = localStorage.getItem(LS_STEP_KEY);
    if (!raw) return { intake: null, step: step || "" };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { intake: null, step: step || "" };
    return { intake: parsed, step: step || "" };
  } catch {
    return { intake: null, step: "" };
  }
}

async function syncLocalIntakeToUser(uid) {
  const { intake, step } = readLocalIntake();
  if (!intake) return false;

  await setDoc(
    doc(db, "users", uid),
    {
      rfoIntake: intake,
      rfoLastStep: String(step || ""),
      rfoSyncedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return true;
}

async function doLogin() {
  const email = String(emailEl?.value || "").trim();
  const password = String(passEl?.value || "");

  if (!email) { setMsg("Enter email."); emailEl?.focus(); return; }
  if (!password) { setMsg("Enter password."); passEl?.focus(); return; }

  setMsg("Signing in…");
  disableUI(true);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // Sync local intake if present (non-fatal if it fails)
    try {
      setMsg("Signed in. Syncing intake…");
      await syncLocalIntakeToUser(cred.user.uid);
    } catch (e) {
      console.warn("Intake sync failed (non-fatal):", e);
    }

    setMsg("Success. Redirecting…");
    window.location.href = "/dashboard.html";
  } catch (err) {
    console.error(err);
    const code = String(err?.code || "");
    if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) {
      setMsg("Invalid email or password.");
    } else if (code.includes("auth/user-not-found")) {
      setMsg("No account found for that email.");
    } else if (code.includes("auth/too-many-requests")) {
      setMsg("Too many attempts. Try again later.");
    } else {
      setMsg("Login failed. See console.");
    }
    disableUI(false);
  }
}

// Click handlers
btnLogin?.addEventListener("click", doLogin);

btnSignup?.addEventListener("click", () => {
  window.location.href = "/signup.html";
});

// Enter key submits
passEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});
emailEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") passEl?.focus();
});

// Initial
setMsg("");
