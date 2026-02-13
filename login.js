// login.js (static-site safe)
import app from "/firebase-config.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

console.log("LOGIN JS LOADED");
const auth = getAuth(app);

// Grab inputs by type (works even if you have no IDs)
const emailEl = document.querySelector('input[type="email"]');
const passEl  = document.querySelector('input[type="password"]');

// Grab the button by text, fallback to submit button
const loginBtn =
  [...document.querySelectorAll("button")].find(b => /log\s*in/i.test(b.textContent || "")) ||
  document.querySelector('button[type="submit"]');

// Make / reuse a message box
let msgEl = document.getElementById("message");
if (!msgEl) {
  msgEl = document.createElement("div");
  msgEl.id = "message";
  msgEl.style.marginTop = "12px";
  msgEl.style.fontSize = "14px";
  msgEl.style.color = "#e8eef6";
  // place it after the button if possible
  if (loginBtn?.parentElement) loginBtn.parentElement.appendChild(msgEl);
  else document.body.appendChild(msgEl);
}

function setMsg(t) {
  msgEl.textContent = t;
  console.log(t);
}

async function doLogin() {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    setMsg("Enter email + password.");
    return;
  }

  setMsg("Signing in...");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    setMsg("Login successful. Redirecting...");
    window.location.href = "/dashboard.html";
  } catch (e) {
    console.error(e);
    setMsg("Login failed: " + (e.code || e.message));
  }
}

// 1) Block ALL form submits (prevents page reload)
document.querySelectorAll("form").forEach((f) => {
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    e.stopPropagation();
    doLogin();
  });
});

// 2) Also bind the button click (in case there’s no form)
if (loginBtn) {
  loginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    doLogin();
  });
} else {
  setMsg("Wiring error: couldn't find Log In button.");
}

setMsg("Ready.");
