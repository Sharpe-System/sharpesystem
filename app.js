// app.js (durable gate for /app.html)
// Behavior:
// - Not logged in -> send to HOME with next back to /app.html
// - Logged in but not active -> send to /tier1.html (or /subscribe)
// - Logged in + active -> stay

import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore, doc, getDoc } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

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

    const access = await getUserAccess(user.uid);

    // If not active, go to Tier page (NOT back to app, preventing loops)
    if (!access.active) {
      window.location.replace("/tier1.html");
      return;
    }

    // If active, do nothing (user stays in app)
  } catch (e) {
    console.log(e);
    // If Firestore read fails, route to Tier page so user isn't stuck
    window.location.replace("/tier1.html");
  }
});
