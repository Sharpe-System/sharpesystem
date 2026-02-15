// start.js — gated intake → save Firestore → redirect to snapshot.html?case=...

import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

function $(id){ return document.getElementById(id); }
const msgEl = $("msg");
const form = $("intakeForm");
const saveBtn = $("saveBtn");

function setMsg(t){ if (msgEl) msgEl.textContent = t || ""; }

function goLogin(nextPath = "/start.html") {
  window.location.replace(`/login.html?next=${encodeURIComponent(nextPath)}`);
}

function normalizeList(s){
  return (s || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    goLogin("/start.html");
    return;
  }
  currentUser = user;
  setMsg("");
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
    goLogin("/start.html");
    return;
  }

  try {
    saveBtn.disabled = true;
    setMsg("Saving intake…");

    const payload = {
      caseType: $("caseType")?.value || "",
      state: $("state")?.value || "",
      nextDate: $("nextDate")?.value || "",
      objective: ($("objective")?.value || "").trim(),
      risk: $("risk")?.value || "",
      orders: $("orders")?.value || "",
      urgency: $("urgency")?.value || "",
      docs: normalizeList($("docs")?.value || ""),
      facts: ($("facts")?.value || "").trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      version: 1
    };

    // Basic validation
    if (!payload.caseType || !payload.state || !payload.risk || !payload.orders || !payload.urgency) {
      setMsg("Please fill the required dropdowns (case type, state, risk, orders, urgency).");
      saveBtn.disabled = false;
      return;
    }

    const casesRef = collection(db, "users", currentUser.uid, "cases");
    const docRef = await addDoc(casesRef, payload);

    setMsg("Saved. Building snapshot…");
    window.location.replace(`/snapshot.html?case=${encodeURIComponent(docRef.id)}`);

  } catch (err) {
    console.log(err);
    setMsg("Save failed. Open console for details.");
    saveBtn.disabled = false;
  }
});
