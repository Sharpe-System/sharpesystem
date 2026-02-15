// app.js — durable gate for /app.html with visible routing status
import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const statusEl = document.getElementById("acctStatus");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(t){
  if (statusEl) statusEl.textContent = t || "";
}

function go(url){
  setStatus("Routing → " + url);
  window.location.replace(url);
}

function goHomeWithNext() {
  const next = encodeURIComponent("/app.html");
  go(`/home.html?next=${next}`);
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
      setStatus("Not logged in → sending to Home");
      goHomeWithNext();
      return;
    }

    setStatus("Logged in. Checking access…");
    const access = await getUserAccess(user.uid);

    if (!access.active || access.tier !== "tier1") {
      setStatus("Not active or wrong tier → sending to Tier 1 page");
      go("/tier1.html");
      return;
    }

    setStatus("Access OK. Loading app…");
    // stay on app
  } catch (e) {
    console.log(e);
    setStatus("Access check failed → sending to Tier 1");
    go("/tier1.html");
  }
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.replace("/home.html");
  } catch (e) {
    console.log(e);
  }
});
