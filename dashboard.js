// dashboard.js
import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

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

    setStatus("Checking access…");

    const access = await getUserAccess(user.uid);

    if (access.active === true) {
      setStatus(`Signed in as: ${user.email} — Active (${access.tier || "tier"})`);
      // Paid users go to the app home
      window.location.replace("/app.html");
      return;
    }

    // Logged in but not active → send to Tier 1 page
    window.location.replace("/tier1.html");
  } catch (e) {
    console.log(e);
    setStatus("Error checking access. Redirecting home…");
    setTimeout(goHomeWithNext, 600);
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  goHomeWithNext();
});
