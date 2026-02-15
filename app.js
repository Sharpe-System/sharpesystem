import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore, doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const acctStatus = document.getElementById("acctStatus");
const logoutBtn = document.getElementById("logoutBtn");

function setAcctStatus(t){ if (acctStatus) acctStatus.textContent = t || ""; }

function goHomeWithNext() {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/home.html?next=${next}`);
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
    if (!user) { goHomeWithNext(); return; }

    setAcctStatus(`Signed in as ${user.email}. Checking access…`);
    const access = await getUserAccess(user.uid);

    if (!access.active) {
      setAcctStatus("Not active yet. Redirecting to Tier 1…");
      window.location.replace("/tier1.html");
      return;
    }

    setAcctStatus(`Active: yes • Tier: ${access.tier || "tier1"}`);
  } catch (e) {
    console.log(e);
    setAcctStatus("Access check failed. Redirecting to Tier 1…");
    window.location.replace("/tier1.html");
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.replace("/home.html");
});
