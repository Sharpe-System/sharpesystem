// dashboard.js
import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(t) {
  if (statusEl) statusEl.textContent = t;
  console.log(t);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  setStatus("Loading account...");

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      setStatus("No account record found.");
      return;
    }

    const data = snap.data();

    setStatus(`
Email: ${user.email}
Tier: ${data.tier}
Active: ${data.active}
    `);
  } catch (err) {
    console.error(err);
    setStatus("Error loading account data.");
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});
