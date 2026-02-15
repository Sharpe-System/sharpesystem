// /dashboard.js
import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const statusEl = document.getElementById("status");
const whoEl = document.getElementById("who");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(html) {
  if (statusEl) statusEl.innerHTML = html;
}

function goLogin(next = "/dashboard.html") {
  const n = encodeURIComponent(next);
  window.location.replace(`/login.html?next=${n}`);
}

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } finally {
    window.location.replace("/home.html");
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    goLogin("/dashboard.html");
    return;
  }

  const email = user.email || "(no email)";
  setStatus(`Signed in as <strong>${email}</strong>`);
  if (whoEl) whoEl.textContent = email;
});
