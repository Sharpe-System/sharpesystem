/* /login.js
   Minimal, known-good login using Firebase Auth modular SDK.
   Depends only on named exports from /firebase-config.js
*/

import { auth } from "/firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

function $(id) { return document.getElementById(id); }

const emailEl = $("email");
const passEl  = $("password");
const btnLogin = $("btnLogin");
const btnSignup = $("btnSignup");
const msgEl = $("msg");

function setMsg(text) {
  if (msgEl) msgEl.textContent = text || "";
}

function disableUI(disabled) {
  if (btnLogin) btnLogin.disabled = disabled;
  if (btnSignup) btnSignup.disabled = disabled;
  if (emailEl) emailEl.disabled = disabled;
  if (passEl) passEl.disabled = disabled;
}

async function doLogin() {
  const email = String(emailEl?.value || "").trim();
  const password = String(passEl?.value || "");

  if (!email) { setMsg("Enter email."); emailEl?.focus(); return; }
  if (!password) { setMsg("Enter password."); passEl?.focus(); return; }

  setMsg("Signing in…");
  disableUI(true);

  try {
    await signInWithEmailAndPassword(auth, email, password);
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

// Enter key submits (but not in a way that interferes with other pages)
passEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});
emailEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") passEl?.focus();
});

// Initial
setMsg("");
