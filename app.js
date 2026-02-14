// app.js (durable gate for /app.html)
// - Not logged in -> HOME with next back to /app.html
// - Logged in but NOT active -> /subscribe.html
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

    if (!access.active) {
      window.location.replace("/subscribe.html");
      return;
    }

    // active -> stay on app
  } catch (e) {
    console.log(e);
    // If Firestore read fails, send to subscribe (single place to resolve)
    window.location.replace("/subscribe.html");
  }
});
