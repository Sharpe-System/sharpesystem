// login.js — durable submit + next= routing
import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const btn     = document.getElementById("loginBtn");
const msgEl   = document.getElementById("msg");

function setMsg(t) {
  if (msgEl) msgEl.textContent = t || "";
}

function getNextPath() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  // Only allow same-site paths
  if (next && next.startsWith("/")) return next;
  return "/dashboard.html";
}

function goNext() {
  window.location.replace(getNextPath());
}

// If user is already logged in, skip login page
onAuthStateChanged(auth, (user) => {
  if (user) goNext();
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    setMsg("Enter email and password.");
    return;
  }

  try {
    btn.disabled = true;
    setMsg("Signing in…");

    await signInWithEmailAndPassword(auth, email, password);

    setMsg("Signed in. Redirecting…");
    goNext();

  } catch (err) {
    console.log(err);
    const code = err?.code || "";
    if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) {
      setMsg("Invalid email or password.");
    } else if (code.includes("auth/user-not-found")) {
      setMsg("No account found for that email.");
    } else if (code.includes("auth/too-many-requests")) {
      setMsg("Too many attempts. Try again later.");
    } else {
      setMsg("Login failed. Check console for details.");
    }
    btn.disabled = false;
  }
});
