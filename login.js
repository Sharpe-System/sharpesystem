// login.js (CDN version for static sites)
import app from "/firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

console.log("LOGIN JS LOADED");

const auth = getAuth(app);

// These IDs must exist in login.html:
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const createBtn = document.getElementById("createBtn");
const msgEl = document.getElementById("message");

function setMsg(t) {
  if (msgEl) msgEl.textContent = t;
}

// LOGIN
loginBtn?.addEventListener("click", async () => {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  setMsg("Signing in...");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setMsg("Login successful.");
    window.location.href = "/dashboard.html";
  } catch (e) {
    console.error(e);
    setMsg("Login failed: " + (e.code || e.message));
  }
});

// CREATE ACCOUNT
createBtn?.addEventListener("click", async () => {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  setMsg("Creating account...");

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    setMsg("Account created. Redirecting...");
    window.location.href = "/dashboard.html";
  } catch (e) {
    console.error(e);
    setMsg("Create failed: " + (e.code || e.message));
  }
});
