import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const who = document.getElementById("who");
const tierPill = document.getElementById("tierPill");
const activePill = document.getElementById("activePill");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  who.textContent = `Signed in as ${user.email}`;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return;

  const data = snap.data() || {};
  const tier = data.tier || "—";
  const active = data.active === true;

  tierPill.textContent = `Tier: ${tier}`;
  activePill.textContent = `Active: ${active}`;

  // 🔥 Subscription logic fix
  const subscribeBtn = document.querySelector('a[href="/subscribe.html"]');
  if (subscribeBtn && active) {
    subscribeBtn.textContent = "Manage Subscription";
    subscribeBtn.href = "/dashboard.html"; // change later to Stripe portal if desired
  }
});
