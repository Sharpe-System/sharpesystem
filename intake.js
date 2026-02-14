// intake.js
import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const form = document.getElementById("intakeForm");
const statusEl = document.getElementById("status");

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
  console.log(msg);
}

let currentUser = null;

// Require login
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/login.html?next=/intake.html";
    return;
  }
  currentUser = user;
  setStatus("Signed in. Ready to save intake.");
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const data = {
    caseType: document.getElementById("caseType")?.value || "",
    state: (document.getElementById("state")?.value || "").toUpperCase().trim(),
    nextCourtDate: document.getElementById("nextCourtDate")?.value || "",
    goal: (document.getElementById("goal")?.value || "").trim(),
    risk: document.getElementById("risk")?.value || "",
    facts: (document.getElementById("facts")?.value || "").trim(),
    documents: (document.getElementById("documents")?.value || "").trim(),
    createdAt: serverTimestamp(),
    uid: currentUser.uid,
    email: currentUser.email || ""
  };

  try {
    setStatus("Saving…");
    const ref = collection(db, "users", currentUser.uid, "intake");
    const docRef = await addDoc(ref, data);
    setStatus(`Saved ✅ intake id: ${docRef.id}`);
    // optional: go to dashboard after save
    // setTimeout(() => window.location.href = "/dashboard.html", 900);
  } catch (err) {
    console.error(err);
    setStatus(`Save failed ❌ ${err?.message || err}`);
  }
});
