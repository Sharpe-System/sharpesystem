// /login.js
import { auth } from "/auth.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

  if (!next) return "/dashboard.html";
  if (!next.startsWith("/")) return "/dashboard.html";
  if (next.startsWith("//")) return "/dashboard.html";
  if (next.includes("://")) return "/dashboard.html";
  if (next.includes("..")) return "/dashboard.html";

  return next;
}

// If already logged in, DO NOT show login page. Send them where they intended.
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace(safeNext());
  }
});

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

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  doLogin().catch((err) => setMsg(err?.message || "Login failed."));
});
