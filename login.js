// /login.js
import app from "/firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const msgEl = document.getElementById("msg");
const loginBtn = document.getElementById("loginBtn");

function setMsg(t) {
  if (msgEl) msgEl.textContent = t || "";
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function safeNext() {
  const params = new URLSearchParams(window.location.search);
  let next = (params.get("next") || "").trim();

  if (!next) return "/dashboard.html";

  // Block absolute URLs, protocols, traversal, fragments
  if (
    next.includes(":") ||
    next.startsWith("//") ||
    next.includes("..") ||
    next.startsWith("#")
  ) {
    return "/dashboard.html";
  }

  // Always force root-relative
  if (!next.startsWith("/")) {
    next = "/" + next;
  }

  return next;
}

function friendlyError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email format.";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    default:
      return "Login failed.";
  }
}

async function doLogin() {
  const email = normalizeEmail(emailEl?.value || "");
  const password = passEl?.value || "";

  if (!email || !password) {
    setMsg("Enter email and password.");
    return;
  }

  loginBtn.disabled = true;
  setMsg("Signing in…");

  try {
    await setPersistence(auth, browserLocalPersistence);

    await signInWithEmailAndPassword(auth, email, password);

    window.location.replace(safeNext());
  } catch (err) {
    setMsg(friendlyError(err?.code));
  } finally {
    loginBtn.disabled = false;
  }
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  doLogin();
});
