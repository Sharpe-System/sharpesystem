// /dashboard.js
import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getNextParam, buildNextFromHere, replaceTo } from "/safeNext.js";

const auth = getAuth(app);

const statusEl = document.getElementById("status");
const whoEl = document.getElementById("who");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(t){ if (statusEl) statusEl.textContent = t || ""; }
function setWho(t){ if (whoEl) whoEl.textContent = t || ""; }

function goLoginForThisPage(){
  const next = buildNextFromHere(); // returns encoded current path+query
  replaceTo(`/login?next=${next}`);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // Not logged in -> send to login and come back here
    goLoginForThisPage();
    return;
  }

  // Logged in
  setStatus("Session active.");
  setWho(`Signed in as: ${user.email || user.uid}`);
});

logoutBtn?.addEventListener("click", async () => {
  try {
    setStatus("Signing out…");
    await signOut(auth);
  } catch (e) {
    console.log(e);
  } finally {
    // Always land at home after logout
    replaceTo("/home");
  }
});
