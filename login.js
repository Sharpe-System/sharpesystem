// /login.js
import app from "/firebase-config.js";
import { safeNext } from "/safeNext.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const msgEl = document.getElementById("msg");
const btn = document.getElementById("loginBtn");

function setMsg(html) {
  if (msgEl) msgEl.innerHTML = html || "";
}

function disable(v) {
  if (btn) btn.disabled = !!v;
}

function getNext() {
  const params = new URLSearchParams(window.location.search);
  return safeNext(params.get("next"), "/dashboard.html");
}

function go(url) {
  window.location.replace(url);
}

// If already logged in, don't show login form — route immediately.
onAuthStateChanged(auth, (user) => {
  if (user) go(getNext());
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("");
  disable(true);

  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    go(getNext());
  } catch (err) {
    console.log(err);
    setMsg(`<strong>Login failed.</strong> ${err?.message ? `<span class="muted">${err.message}</span>` : ""}`);
    disable(false);
  }
});
