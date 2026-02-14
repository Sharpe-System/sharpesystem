// dashboard.js
import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(t) {
  if (statusEl) statusEl.textContent = t;
  console.log(t);
}

async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  setStatus("Loading account…");

  let profile = null;
  try {
    profile = await getUserProfile(user.uid);
  } catch (e) {
    console.error(e);
    setStatus("Error loading account profile.");
    return;
  }

  const tier = profile?.tier ?? "none";
  const active = profile?.active === true;

  // Optional: show the status briefly (you may see it flash)
  setStatus(`Email: ${user.email}  Tier: ${tier}  Active: ${active}`);

  // Gate: must have active true + known tier
  if (!profile || !active || tier === "none") {
    window.location.href = "/subscribe.html";
    return;
  }

  // Tier routing
  if (tier === "tier1") {
    window.location.href = "/tier1.html";
    return;
  }

  // Safe default for future tiers
  window.location.href = "/tier1.html";
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login.html";
});
