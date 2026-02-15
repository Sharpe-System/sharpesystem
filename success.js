// /success.js (durable activation without uid in URL)
// - Uses Firebase ID token so Worker can verify identity
// - Adds timeout + safer error parsing

import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const WORKER_BASE = "https://sharpe-pay.nd-sharpe.workers.dev";
const auth = getAuth(app);

function setMsg(t) {
  const el = document.getElementById("msg");
  if (el) el.textContent = t || "";
}

async function readJsonSafe(resp) {
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    return resp.json().catch(() => ({}));
  }
  const txt = await resp.text().catch(() => "");
  return { error: txt || "Non-JSON response" };
}

async function activateWithToken(idToken) {
  const controller = new AbortController();
  const timeoutMs = 15000;
  const to = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(`${WORKER_BASE}/activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Worker should verify this token and derive uid server-side
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ tier: "tier1" }),
      signal: controller.signal,
    });

    const data = await readJsonSafe(r);

    if (!r.ok || !data.ok) {
      throw new Error(data?.error || `Activation failed (${r.status})`);
    }

    return data;
  } finally {
    clearTimeout(to);
  }
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      setMsg("Payment received. Please log in to finalize access.");
      return;
    }

    setMsg("Finalizing access…");

    // Force-refresh token to avoid edge cases after login
    const idToken = await user.getIdToken(true);

    await activateWithToken(idToken);

    setMsg("Access activated. Redirecting to app…");
    setTimeout(() => window.location.replace("/app.html"), 900);
  } catch (e) {
    console.log(e);
    const msg =
      e?.name === "AbortError"
        ? "Activation timed out. Refresh and try again."
        : (e?.message || "Activation error. Try refreshing or visit dashboard.");
    setMsg(msg);
  }
});
