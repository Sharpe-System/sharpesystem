import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(t){ if (statusEl) statusEl.textContent = t || ""; }

function goHomeWithNext() {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/home.html?next=${next}`);
}

onAuthStateChanged(auth, (user) => {
  if (user) setStatus(`Signed in as: ${user.email}`);
  else goHomeWithNext();
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("/home.html");
});
