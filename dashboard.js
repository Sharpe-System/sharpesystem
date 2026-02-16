import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const who = document.getElementById("who");
const tierPill = document.getElementById("tierPill");
const activePill = document.getElementById("activePill");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  if (who) {
    who.innerHTML = `Signed in as <strong>${user.email || "(no email)"}</strong>`;
  }

  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) return;

  const data = snap.data() || {};

  if (tierPill) tierPill.textContent = `Tier: ${data.tier || "—"}`;
  if (activePill) activePill.textContent = `Active: ${data.active === true}`;
});
