// dashboard.js
import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(t) {
  if (statusEl) statusEl.textContent = t;
  console.log(t);
}

function goHomeWithNext() {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/?next=${next}`);
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    setStatus(`Signed in as: ${user.email}`);
  } else {
    // Session ended / logged out -> go HOME (not login), with next=
    goHomeWithNext();
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  goHomeWithNext();
});
