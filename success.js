// success.js (durable activation without uid in URL)

import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const WORKER_BASE = "https://sharpe-pay.nd-sharpe.workers.dev";
const auth = getAuth(app);

function setMsg(t){
  const el = document.getElementById("msg");
  if (el) el.textContent = t || "";
}

async function activate(uid){
  const r = await fetch(`${WORKER_BASE}/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, tier: "tier1" })
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data.ok) {
    throw new Error(data?.error || "Activation failed");
  }

  return data;
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      setMsg("Payment received. Please log in to finalize access.");
      return;
    }

    setMsg("Finalizing access...");
    await activate(user.uid);

    setMsg("Access activated. Redirecting to app...");
    setTimeout(() => {
      window.location.href = "/app.html";
    }, 900);

  } catch (e) {
    console.log(e);
    setMsg("Activation error. Try refreshing or visit dashboard.");
  }
});
