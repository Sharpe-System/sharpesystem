// intake.js — Tier 1 gated + Firestore save/load into /users/{uid}
// Stores intake fields inside the SAME users/{uid} doc (matches your rules).

import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

const el = (id) => document.getElementById(id);

const msgEl = el("msg");
const saveBtn = el("saveBtn");
const reloadBtn = el("reloadBtn");
const logoutBtn = el("logoutBtn");

function setMsg(t){ if (msgEl) msgEl.textContent = t || ""; }

function goHomeWithNext(){
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/home.html?next=${next}`);
}

function goTier(){
  window.location.replace("/tier1.html");
}

async function getUserDoc(uid){
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return { ref, snap };
}

function fillFormFromDoc(data){
  el("caseType").value = data.intake_caseType || "";
  el("stage").value = data.intake_stage || "";
  el("goal").value = data.intake_goal || "";
  el("facts").value = data.intake_facts || "";
  el("risks").value = data.intake_risks || "";
}

function collectForm(){
  return {
    intake_caseType: (el("caseType").value || "").trim(),
    intake_stage: (el("stage").value || "").trim(),
    intake_goal: (el("goal").value || "").trim(),
    intake_facts: (el("facts").value || "").trim(),
    intake_risks: (el("risks").value || "").trim(),
    intake_updatedAt: serverTimestamp(),
  };
}

let currentUid = null;

async function enforceTierAndLoad(uid){
  const { snap } = await getUserDoc(uid);
  if (!snap.exists()) {
    // user doc missing => not active by default
    goTier();
    return;
  }
  const d = snap.data() || {};
  const active = d.active === true;
  if (!active) {
    goTier();
    return;
  }

  // Active => load saved intake (if any)
  fillFormFromDoc(d);
  setMsg("Loaded.");
}

async function reload(){
  if (!currentUid) return;
  setMsg("Reloading…");
  await enforceTierAndLoad(currentUid);
}

async function save(){
  if (!currentUid) return;
  setMsg("Saving…");
  saveBtn.disabled = true;

  try{
    const { ref } = await getUserDoc(currentUid);
    const payload = collectForm();

    // Merge into existing user doc (keeps active/tier intact)
    await setDoc(ref, payload, { merge: true });

    setMsg("Saved. Refresh the page to confirm it reloads.");
  }catch(e){
    console.log(e);
    setMsg("Save failed. Check console.");
  }finally{
    saveBtn.disabled = false;
  }
}

reloadBtn?.addEventListener("click", reload);
saveBtn?.addEventListener("click", save);

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  goHomeWithNext();
});

onAuthStateChanged(auth, async (user) => {
  try{
    if (!user){
      goHomeWithNext();
      return;
    }
    currentUid = user.uid;
    setMsg("Checking access…");
    await enforceTierAndLoad(user.uid);
  }catch(e){
    console.log(e);
    // If Firestore read fails, treat as not-active path
    goTier();
  }
});
