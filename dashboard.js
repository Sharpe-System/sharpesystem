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

function ensureTierArea() {
  let el = document.getElementById("tierArea");
  if (!el) {
    el = document.createElement("div");
    el.id = "tierArea";
    el.style.marginTop = "16px";
    document.body.appendChild(el);
  }
  return el;
}

async function loadUserTier(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() || {};
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  setStatus(`Signed in as: ${user.email} (checking access...)`);

  const tierArea = ensureTierArea();
  tierArea.innerHTML = `<div>Loading plan…</div>`;

  try {
    const data = await loadUserTier(user.uid);

    if (!data) {
      tierArea.innerHTML = `
        <h3>Account setup incomplete</h3>
        <p>No Firestore user record found for your UID.</p>
        <p>Create: <code>users/${user.uid}</code> with <code>tier1: true</code></p>
      `;
      setStatus(`Signed in as: ${user.email}`);
      return;
    }

    const tier1 = !!data.tier1;

    setStatus(`Signed in as: ${user.email}`);
    tierArea.innerHTML = `
      <h3>Plan status</h3>
      <p><strong>Tier 1:</strong> ${tier1 ? "ACTIVE ✅" : "NOT ACTIVE ❌"}</p>
      ${tier1 ? `
        <p><a href="/intake.html">Go to Tier 1 Intake →</a></p>
      ` : `
        <p>You don’t have Tier 1 access yet.</p>
        <p>(Later: this is where we’ll send you to subscribe/pay.)</p>
      `}
    `;

  } catch (err) {
    console.error(err);
    tierArea.innerHTML = `
      <h3>Error reading Firestore</h3>
      <pre style="white-space:pre-wrap;">${String(err?.message || err)}</pre>
    `;
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login";
});
