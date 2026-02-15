// /login.js
import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const msgEl = document.getElementById("msg");

function setMsg(t) {
  if (msgEl) msgEl.textContent = t || "";
}

function safeNext() {
  const params = new URLSearchParams(window.location.search);
  const next = (params.get("next") || "").trim();
  const fallback = "/dashboard.html";

  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("..")) return fallback;
  if (next.includes("://")) return fallback;

  return next;
}

function revealPage() {
  document.documentElement.classList.remove("auth-checking");
}

async function doLogin() {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    setMsg("Enter email and password.");
    return;
  }

  setMsg("Signing in…");
  await signInWithEmailAndPassword(auth, email, password);

  window.location.replace(safeNext());
}

// Auth gate: if already logged in, do not show login page at all.
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace(safeNext());
    return;
  }

  // Logged out: show page + focus email
  revealPage();
  if (emailEl) emailEl.focus();
});

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  doLogin().catch((err) => setMsg(err?.message || "Login failed."));
});
