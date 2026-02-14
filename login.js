// login.js
import app from "/firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Elements
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const googleBtn = document.getElementById("googleBtn");
const statusEl = document.getElementById("status");

// Always compute next safely
function getNext() {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "/dashboard.html";
}

function goNext() {
  const next = getNext();
  window.location.href = next;
}

function setStatus(t) {
  if (statusEl) statusEl.textContent = t || "";
}

// If already logged in, go immediately
onAuthStateChanged(auth, (user) => {
  if (user) {
    goNext();
  }
});

// Email login
loginBtn?.addEventListener("click", async () => {
  try {
    setStatus("Signing in...");
    await signInWithEmailAndPassword(
      auth,
      emailInput.value.trim(),
      passwordInput.value
    );
    goNext();
  } catch (err) {
    console.error(err);
    setStatus("Login failed. Check credentials.");
  }
});

// Google login
googleBtn?.addEventListener("click", async () => {
  try {
    setStatus("Signing in with Google...");
    await signInWithPopup(auth, provider);
    goNext();
  } catch (err) {
    console.error(err);
    setStatus("Google login failed.");
  }
});
