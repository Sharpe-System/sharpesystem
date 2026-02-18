// /start.js
// Purpose: route user based on whether intake exists yet.
// AUTH-COMPLIANT: no gate exports, no firebase re-init.

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";
import { readUserDoc } from "/db.js";

function $(id){ return document.getElementById(id); }
function setStatus(html){
  const el = $("status");
  if (el) el.innerHTML = html || "";
}

(async function main(){
  try {
    // Session
    const { user } = await getAuthStateOnce();
    if (!user) {
      window.location.replace("/login.html?next=%2Fstart.html");
      return;
    }

    // Profile (tier check belongs in gate.js; here we just route)
    const profile = await getUserProfile(user.uid).catch(() => ({}));

    setStatus(
      `Signed in as <strong>${user.email || "(no email)"}</strong>` +
      ` • Tier: <strong>${profile?.tier || "?"}</strong>` +
      ` • Routing…`
    );

    // Read user doc (intake lives on /users/{uid}.intake per your /db.js)
    const data = await readUserDoc(user.uid);
    const intake = data?.intake || null;

    if (!intake || !intake.caseType || !intake.stage) {
      window.location.replace("/intake.html");
      return;
    }

    window.location.replace("/snapshot.html");
  } catch (e) {
    console.warn(e);
    // If anything fails, fall back to tier page (your existing UX)
    window.location.replace("/tier1.html");
  }
})();
