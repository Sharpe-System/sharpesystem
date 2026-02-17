// /start.js
// Routes user to /intake.html if intake is incomplete, otherwise /snapshot.html.
// Authconan-compliant: no imports from /gate.js (gate is enforcement only).

import { getAuthStateOnce, getUserProfile, db } from "/firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function $(id){ return document.getElementById(id); }

function setStatus(html){
  const el = $("status");
  if (el) el.innerHTML = html || "";
}

(async function main(){
  try {
    // Gate should already have enforced auth+tier, but we stay defensive.
    const { user } = await getAuthStateOnce();
    if (!user) {
      window.location.replace(`/login.html?next=${encodeURIComponent("/start.html")}`);
      return;
    }

    const profile = await getUserProfile(user.uid);
    const tier = (profile?.tier || "free").toString();
    const active = !!profile?.active;

    setStatus(
      `Signed in as <strong>${user.email || "(no email)"}</strong> • ` +
      `Tier: <strong>${tier}</strong> • ` +
      `Active: <strong>${active ? "Yes" : "No"}</strong> • Routing…`
    );

    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? (snap.data() || {}) : {};
    const intake = data.intake || null;

    // Minimal “complete enough” intake check
    const ok = !!(intake && intake.caseType && intake.stage);

    window.location.replace(ok ? "/snapshot.html" : "/intake.html");
  } catch (e) {
    console.error(e);
    // Safe fallback: send user to tier landing if something is off
    window.location.replace("/tier1.html");
  }
})();
