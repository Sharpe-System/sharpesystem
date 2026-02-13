import app from "/firebase-config.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

console.log("LOGIN JS LOADED");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const createBtn = document.getElementById("createBtn");
const statusEl = document.getElementById("status");

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
  console.log(text);
}

async function login(email, password) {
  try {
    setStatus("Signing in...");
    await setPersistence(auth, browserLocalPersistence);
    await signInWithEmailAndPassword(auth, email, password);
    setStatus("Success. Redirecting...");
    window.location.href = "/dashboard.html";
  } catch (err) {
    console.error(err);
    setStatus("Login failed: " + err.message);
  }
}

async function createAccount(email, password) {
  try {
    setStatus("Creating account...");
    await setPersistence(auth, browserLocalPersistence);
    await createUserWithEmailAndPassword(auth, email, password);
    setStatus("Account created. Redirecting...");
    window.location.href = "/dashboard.html";
  } catch (err) {
    console.error(err);
    setStatus("Create failed: " + err.message);
  }
}

loginBtn?.addEventListener("click", () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  login(email, password);
});

createBtn?.addEventListener("click", () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  createAccount(email, password);
});

setStatus("Ready.");
