// dashboard.js
import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(t) {
  if (statusEl) statusEl.textContent = t;
  console.log(t);
}

// Wait for Firebase to tell us if user is signed in
onAuthStateChanged(auth, (user) => {
  if (user) {
    setStatus(`Signed in as: ${user.email}`);
  } else {
    // Not signed in -> go back to login
    window.location.href = "/login";
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});
