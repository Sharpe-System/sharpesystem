// dashboard.js (durable gate)
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
  if (statusEl) statusEl.textContent = t || "";
  console.log(t || "");
}

function goHomeWithNext() {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/?next=${next}`);
}

async function getUserAccess(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { active: false, tier: "" };
  const d = snap.data() || {};
  return { active: d.active === true, tier: d.tier || "" };
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      goHomeWithNext();
      return;
    }

    setStatus(`Signed in as: ${user.email || user.uid}`);

    // Optional: show access status on dashboard (no redirect here)
    const access = await getUserAccess(user.uid);
    if (!access.active) {
      setStatus(`Signed in as: ${user.email || user.uid} — NOT ACTIVE (Tier required)`);
    }
  } catch (e) {
    console.log(e);
    setStatus("Error loading account status.");
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  // Explicit logout should go to public home (no next= loop)
  window.location.replace("/home.html");
});
