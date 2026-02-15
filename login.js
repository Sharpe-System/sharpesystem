import app from "/firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");
const statusEl = document.getElementById("status");
const googleBtn = document.getElementById("googleBtn");
const loginBtn = document.getElementById("loginBtn");

function setStatus(t){ if (statusEl) statusEl.textContent = t || ""; }

function safeNext(raw, fallback="/dashboard.html"){
  if (!raw) return fallback;
  if (raw === "undefined" || raw === "null") return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  return raw;
}
function getNext(){
  const params = new URLSearchParams(window.location.search);
  return safeNext(params.get("next"), "/dashboard.html");
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("Signing in…");
  try {
    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";
    if (!email || !password) { setStatus("Enter email and password."); return; }

    loginBtn && (loginBtn.disabled = true);
    await signInWithEmailAndPassword(auth, email, password);
    window.location.replace(getNext());
  } catch (err) {
    console.log(err);
    setStatus("Login failed. Check email/password.");
    loginBtn && (loginBtn.disabled = false);
  }
});

googleBtn?.addEventListener("click", async () => {
  setStatus("Signing in…");
  try {
    googleBtn.disabled = true;
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    window.location.replace(getNext());
  } catch (err) {
    console.log(err);
    setStatus("Google sign-in failed.");
    googleBtn.disabled = false;
  }
});
