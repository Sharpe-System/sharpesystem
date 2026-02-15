// /app.js — durable gate for /app.html with visible routing status

import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const statusEl = document.getElementById("acctStatus");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(html){
  if (statusEl) statusEl.innerHTML = html || "";
}

function route(url){
  setStatus(`Routing → <strong>${url}</strong>`);
  window.location.replace(url);
}

function goLoginNext() {
  route("/login.html?next=" + encodeURIComponent("/app.html"));
}

async function getUserAccess(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return { active: false, tier: "" };
  const d = snap.data() || {};
  return { active: d.active === true, tier: String(d.tier || "") };
}

// ---- Logout ----
logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } finally {
    window.location.replace("/home.html");
  }
});

// ---- Gate ----
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      setStatus("Not logged in → sending to Login…");
      goLoginNext();
      return;
    }

    setStatus(`Signed in as <strong>${user.email || "(no email)"}</strong> • Checking access…`);

    const access = await getUserAccess(user.uid);

    if (!access.active || access.tier !== "tier1") {
      setStatus("Not active or wrong tier → sending to Tier 1…");
      route("/tier1.html");
      return;
    }

    setStatus(`Access OK • Tier: <strong>${access.tier}</strong> • Active: <strong>true</strong>`);
    // Stay on /app.html

  } catch (e) {
    console.log(e);
    setStatus("Access check failed → sending to Tier 1…");
    route("/tier1.html");
  }
});
