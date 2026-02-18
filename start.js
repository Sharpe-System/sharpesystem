// /start.js
// Purpose: route user based on whether intake exists yet.
// Auth enforcement handled by /gate.js.
// This file only decides intake → snapshot routing.

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";
import { readUserDoc } from "/db.js";

function $(id){ return document.getElementById(id); }
function setStatus(html){
  const el = $("status");
  if (el) el.innerHTML = html || "";
}

(async function main(){
  try {
    const { user } = await getAuthStateOnce();
    if (!user) return; // gate.js already redirects

    const profile = await getUserProfile(user.uid).catch(() => ({}));

    setStatus(
      `Signed in as <strong>${user.email || "(no email)"}</strong>` +
      ` • Tier: <strong>${profile?.tier || "?"}</strong>` +
      ` • Routing…`
    );

    const data = await readUserDoc(user.uid);
    const intake = data?.intake || null;

    if (!intake || !intake.caseType || !intake.stage) {
      window.location.replace("/intake.html");
      return;
    }

    window.location.replace("/snapshot.html");
  } catch (e) {
    console.warn(e);
    window.location.replace("/tier1.html");
  }
})();
