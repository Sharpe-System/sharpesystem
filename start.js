// /start.js
import { auth, ensureUserDoc, readUserDoc } from "/db.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const statusEl = document.getElementById("status");

function setStatus(html) {
  if (statusEl) statusEl.innerHTML = html || "";
}

function goLoginNext() {
  window.location.replace("/login.html?next=/start.html");
}

function goTier() {
  window.location.replace("/tier1.html");
}

function goIntake() {
  window.location.replace("/intake.html");
}

function goSnapshot() {
  window.location.replace("/snapshot.html");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return goLoginNext();

  try {
    setStatus(`Signed in as <strong>${user.email || "(no email)"}</strong> • Checking access…`);

    const u = await ensureUserDoc(user.uid);
    const active = u?.active === true;
    const tier = String(u?.tier || "");

    if (!active || tier !== "tier1") return goTier();

    setStatus(`Signed in as <strong>${user.email || "(no email)"}</strong> • Tier: <strong>${tier}</strong> • Routing…`);

    const data = await readUserDoc(user.uid);
    const intake = data?.intake || null;

    // If intake isn't present / doesn't have minimum structure, send them to intake.
    if (!intake || !intake.caseType || !intake.stage) return goIntake();

    // Otherwise go snapshot.
    return goSnapshot();

  } catch (e) {
    console.log(e);
    // Fail closed and keep user moving.
    return goTier();
  }
});
