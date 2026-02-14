// login.js (durable, Enter works, respects ?next=)

import app from "/firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const formEl = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const msgEl = document.getElementById("msg");

function setMsg(t){
  if (msgEl) msgEl.textContent = t || "";
}

function getNextPath(){
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "/dashboard.html";
}

formEl?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Signing in...");

  try {
    await signInWithEmailAndPassword(
      auth,
      emailEl.value.trim(),
      passEl.value
    );

    window.location.replace(getNextPath());

  } catch (err) {
    console.log(err);
    setMsg("Login failed. Check credentials.");
  }
});
