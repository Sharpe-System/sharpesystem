// login.js — durable submit + safe ?next= redirect
import app from "/firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

// These IDs must exist in login.html:
// <form id="loginForm"> ... </form>
// <input id="email" ...>
// <input id="password" ...>
// <button id="googleBtn" type="button">Google</button>
// <div id="status"></div>
const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const statusEl = document.getElementById("status");
const googleBtn = document.getElementById("googleBtn");

function setStatus(t) {
  if (statusEl) statusEl.textContent = t || "";
}

function safeNext(raw, fallback = "/dashboard.html") {
  if (!raw) return fallback;
  if (raw === "undefined" || raw === "null") return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
}

function getNext() {
  const params = new URLSearchParams(window.location.search);
  return safeNext(params.get("next"), "/dashboard.html");
}

async function doEmailLogin(e) {
  e.preventDefault(); // <-- makes Enter submit work
  setStatus("Signing in…");
  try {
    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";
    if (!email || !password) {
      setStatus("Enter email and password.");
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
    window.location.replace(getNext());
  } catch (err) {
    console.log(err);
    setStatus("Login failed. Check email/password.");
  }
}

form?.addEventListener("submit", doEmailLogin);

// Optional: allow Enter from password field even if form markup is weird
passEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    // If form exists, submit it; otherwise run handler directly
    if (form) form.requestSubmit?.();
  }
});

googleBtn?.addEventListener("click", async () => {
  setStatus("Signing in…");
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    window.location.replace(getNext());
  } catch (err) {
    console.log(err);
    setStatus("Google sign-in failed.");
  }
});
