// login.js
import app from "/firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

// Persist session across refreshes
await setPersistence(auth, browserLocalPersistence);

const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const googleBtn = document.getElementById("googleBtn");
const msgEl = document.getElementById("msg");

function setMsg(t) {
  if (msgEl) msgEl.textContent = t || "";
  console.log(t);
}

function getNext() {
  const url = new URL(window.location.href);
  const next = url.searchParams.get("next");
  return next && next.startsWith("/") ? next : "/dashboard.html";
}

async function doEmailLogin() {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    setMsg("Enter email + password.");
    return;
  }

  setMsg("Signing in…");
  loginBtn && (loginBtn.disabled = true);

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = getNext();
  } catch (err) {
    console.error(err);
    setMsg(err?.message || "Login failed.");
    loginBtn && (loginBtn.disabled = false);
  }
}

async function doGoogleLogin() {
  setMsg("Opening Google sign-in…");
  googleBtn && (googleBtn.disabled = true);

  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    window.location.href = getNext();
  } catch (err) {
    console.error(err);
    setMsg(err?.message || "Google sign-in failed.");
    googleBtn && (googleBtn.disabled = false);
  }
}

// Button wiring
loginBtn?.addEventListener("click", doEmailLogin);
googleBtn?.addEventListener("click", doGoogleLogin);

// Enter key triggers login
passEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doEmailLogin();
});
emailEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doEmailLogin();
});

// Basic sanity log
setMsg("");
console.log("login.js loaded");
