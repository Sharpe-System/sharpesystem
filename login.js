// login.js
import app from "/firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const googleBtn = document.getElementById("googleBtn");
const statusEl = document.getElementById("status");

function setStatus(t) {
  if (statusEl) statusEl.textContent = t || "";
  console.log(t);
}

function getNextPath() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  // Default after login
  return next && next.startsWith("/") ? next : "/dashboard.html";
}

async function doEmailLogin() {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    setStatus("Enter email + password.");
    return;
  }

  setStatus("Signing in...");
  await signInWithEmailAndPassword(auth, email, password);

  const next = getNextPath();
  window.location.replace(next);
}

async function doGoogleLogin() {
  setStatus("Opening Google...");
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);

  const next = getNextPath();
  window.location.replace(next);
}

// Click handlers
loginBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  doEmailLogin().catch((err) => setStatus(err?.message || "Login failed."));
});

googleBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  doGoogleLogin().catch((err) => setStatus(err?.message || "Google login failed."));
});

// ENTER submits from either field
function onEnterSubmit(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    doEmailLogin().catch((err) => setStatus(err?.message || "Login failed."));
  }
}
emailEl?.addEventListener("keydown", onEnterSubmit);
passEl?.addEventListener("keydown", onEnterSubmit);
