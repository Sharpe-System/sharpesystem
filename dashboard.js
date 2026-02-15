// /dashboard.js  (SAFE: no auto-redirect loops)

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

function $(id){ return document.getElementById(id); }

function setText(id, txt){
  const el = $(id);
  if (el) el.textContent = txt;
}

function setPill(id, label, value){
  const el = $(id);
  if (!el) return;
  el.textContent = `${label}: ${value ?? "—"}`;
}

async function loadUserFlags(uid){
  // Expected: /users/{uid} doc has fields like:
  // tier: "tier1" | null
  // active: true/false
  // (If your fields differ, change them below.)
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

function ensureLoginLink(){
  // If logged out, give user a clear way to get to login with next=dashboard
  const container = document.querySelector(".container.content");
  if (!container) return;

  // Avoid duplicating the button on hot reloads
  if (document.getElementById("loginCta")) return;

  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.innerHTML = `
    <h2 style="margin-top:0;">Sign in</h2>
    <p class="muted">You’re currently logged out.</p>
    <div class="row">
      <a class="button primary" id="loginCta" href="/login?next=/dashboard">Log In</a>
      <a class="button" href="/home">Home</a>
    </div>
  `;
  container.appendChild(wrap);
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      setText("who", "Logged out");
      setPill("tierPill", "Tier", "—");
      setPill("activePill", "Active", "—");
      ensureLoginLink();
      return;
    }

    setText("who", `Signed in: ${user.email || user.uid}`);

    const data = await loadUserFlags(user.uid);

    // Defaults if doc missing
    const tier = data?.tier ?? "none";
    const active = (data?.active === true) ? "yes" : "no";

    setPill("tierPill", "Tier", tier);
    setPill("activePill", "Active", active);

  } catch (e) {
    console.error(e);
    setText("who", "Session check failed (see console).");
    setPill("tierPill", "Tier", "—");
    setPill("activePill", "Active", "—");
  }
});
