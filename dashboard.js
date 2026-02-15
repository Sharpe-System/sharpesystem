// /dashboard.js
import { auth, ensureUserDoc } from "/db.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const who = document.getElementById("who");
const tierPill = document.getElementById("tierPill");
const activePill = document.getElementById("activePill");

function setText(el, t){ if (el) el.textContent = t || ""; }

function goLogin() {
  window.location.replace("/login.html?next=/dashboard.html");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return goLogin();

  try {
    setText(who, `Signed in as ${user.email || "(no email)"}`);
    const d = await ensureUserDoc(user.uid);

    setText(tierPill, `Tier: ${d?.tier || "(none)"}`);
    setText(activePill, `Active: ${d?.active === true ? "true" : "false"}`);
  } catch (e) {
    console.log(e);
    setText(who, "Error loading user doc. Check console.");
  }
});
