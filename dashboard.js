// dashboard.js
import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

const statusEl = document.getElementById("status");
const logoutBtn = document.getElementById("logoutBtn");

function setStatus(t) {
  if (statusEl) statusEl.textContent = t;
  console.log(t);
}

function injectTier1Card() {
  if (!statusEl) return;

  // Prevent duplicate injection if script reruns for any reason
  if (document.getElementById("tier1Card")) return;

  const card = document.createElement("div");
  card.id = "tier1Card";
  card.style.marginTop = "16px";
  card.style.padding = "14px";
  card.style.border = "1px solid #1b2a3f";
  card.style.borderRadius = "14px";
  card.style.maxWidth = "520px";

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-weight:800;">Tier 1</div>
      <div style="font-size:12px;border:1px solid #fb7185;padding:4px 10px;border-radius:999px;color:#fb7185;">
        Locked
      </div>
    </div>

    <div style="margin-top:6px;font-size:18px;font-weight:900;">$10/month</div>

    <div style="margin-top:6px;color:#b6c2d2;font-size:13px;line-height:1.35;">
      Unlock guided intake + checklists + template launchers.
    </div>

    <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">
      <button id="tier1ActivateBtn" type="button">Activate Tier 1</button>
      <button id="tier1ViewBtn" type="button">View Tier 1</button>
    </div>

    <div style="margin-top:8px;color:#b6c2d2;font-size:12px;">
      Payments will run through Square. This dashboard is the “locked vs active” gate.
    </div>
  `;

  statusEl.insertAdjacentElement("afterend", card);

  const activateBtn = document.getElementById("tier1ActivateBtn");
  const viewBtn = document.getElementById("tier1ViewBtn");

  activateBtn?.addEventListener("click", () => {
    window.location.href = "/tier1.html";
  });

  viewBtn?.addEventListener("click", () => {
    window.location.href = "/tier1.html";
  });
}

// Wait for Firebase to tell us if user is signed in
onAuthStateChanged(auth, (user) => {
  if (user) {
    setStatus(`Signed in as: ${user.email || user.uid}`);
    injectTier1Card();
  } else {
    // Not signed in -> go back to login
    window.location.href = "/login.html?next=/dashboard.html";
  }
});

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/login.html";
});
