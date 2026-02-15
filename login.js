// login.js
import app from "./firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

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
  const next = (params.get("next") || "").trim();

  // Allow only relative file paths like "app.html" or "dashboard.html"
  // Block anything with ":" or leading "//" or "../"
  if (!next) return "dashboard.html";
  if (next.includes(":") || next.startsWith("//") || next.includes("..")) return "dashboard.html";

  // If user passed "/app.html" by accident, normalize it to "app.html"
  return next.startsWith("/") ? next.slice(1) : next;
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

form?.addEventListener("submit", (e) => {
  e.preventDefault();
  doLogin().catch((err) => setMsg(err?.message || "Login failed."));
});
