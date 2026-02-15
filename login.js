// /login.js
import { auth, initAuthPersistence } from "/auth.js";
import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const msgEl = document.getElementById("msg");

function setMsg(t) {
  if (msgEl) msgEl.textContent = t || "";
  console.log(t);
}

function safeNext() {
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get("next") || "").trim();

  // Default
  if (!raw) return "/dashboard.html";

  // Must be internal absolute
  if (!raw.startsWith("/")) return "/dashboard.html";
  if (raw.startsWith("//")) return "/dashboard.html";
  if (raw.includes("://")) return "/dashboard.html";
  if (raw.includes("..")) return "/dashboard.html";

  return raw;
}

async function doLogin() {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    setMsg("Enter email and password.");
    return;
  }

  setMsg("Preparing session…");
  const mode = await initAuthPersistence();
  console.log("Auth persistence:", mode);

  setMsg("Signing in…");
  await signInWithEmailAndPassword(auth, email, password);

  window.location.replace(safeNext());
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  doLogin().catch((err) => setMsg(err?.message || "Login failed."));
});
