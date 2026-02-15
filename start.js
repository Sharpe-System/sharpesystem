// /start.js
import { requireTier1, readUserDoc } from "/gate.js";

function $(id){ return document.getElementById(id); }
function setStatus(html) {
  const el = $("status");
  if (el) el.innerHTML = html || "";
}

(async function main(){
  const { user, userDoc } = await requireTier1();

  try {
    setStatus(`Signed in as <strong>${user.email || "(no email)"}</strong> • Tier: <strong>${userDoc.tier || "?"}</strong> • Routing…`);

    const data = await readUserDoc(user.uid);
    const intake = data?.intake || null;

    if (!intake || !intake.caseType || !intake.stage) {
      window.location.replace("/intake.html");
      return;
    }

    window.location.replace("/snapshot.html");
  } catch (e) {
    console.log(e);
    window.location.replace("/tier1.html");
  }
})();
