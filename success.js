// /success.js
// Authconan-compliant: no Firebase init, imports only from /firebase-config.js.
// Goal: If logged in, attempt to finalize tier access after payment success.
// This script is intentionally defensive: if the worker endpoint or token is missing,
// it shows a clear message and exits without breaking anything.

import { auth, db } from "/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const WORKER_BASE = "https://sharpe-pay.nd-sharpe.workers.dev"; // your billing worker

function $(id){ return document.getElementById(id); }
function setMsg(t){ const el=$("msg"); if (el) el.textContent = t || ""; }
function setDetail(t){ const el=$("detail"); if (el) el.textContent = t || ""; }

function qp(name){
  try { return new URL(window.location.href).searchParams.get(name); } catch { return null; }
}

/**
 * Expected: your payment provider redirects to /success.html?session_id=...
 * If your worker uses a different param, add it here.
 */
function getCheckoutToken(){
  return (
    qp("session_id") ||
    qp("checkout_id") ||
    qp("payment_intent") ||
    qp("sid") ||
    ""
  );
}

async function finalizeAccess(uid){
  // Token is optional: if absent, we still let the user proceed manually.
  const token = getCheckoutToken();

  // 1) Ask worker to confirm/attach subscription (preferred: server-authoritative)
  // Endpoint name is intentionally conservative; adjust if your worker differs.
  // If worker call fails, we fall back to NOT changing tier here.
  if (token) {
    try {
      setDetail("Confirming subscription…");

      const r = await fetch(`${WORKER_BASE}/confirm-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.log("confirm-checkout failed:", data);
        setDetail("Could not confirm automatically. You can still log in and access will update once synced.");
        return;
      }

      // If worker returns tier, use it; otherwise default to basic.
      const tier = String(data.tier || "basic");

      // 2) Write tier to user doc (client-side merge)
      await setDoc(
        doc(db, "users", uid),
        {
          tier,
          active: true,
          billing: {
            lastCheckoutToken: token,
            confirmedAt: new Date().toISOString(),
          }
        },
        { merge: true }
      );

      setDetail(`Access updated: ${tier}`);
      return;
    } catch (e) {
      console.log(e);
      setDetail("Network error while confirming. You can still proceed; access may update after login.");
      return;
    }
  }

  // No token present: don’t guess tier.
  setDetail("No confirmation token found in URL. If access doesn’t update, log in and try again from your billing link.");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    setMsg("Not logged in.");
    setDetail("Log in, then return to this page to finalize access automatically.");
    return;
  }

  try {
    setMsg(`Logged in as ${user.email || "user"}. Finalizing…`);
    await finalizeAccess(user.uid);
    setMsg("Done.");
  } catch (e) {
    console.log(e);
    setMsg("Could not finalize automatically.");
    setDetail("Go to Dashboard. If access looks wrong, log out/in once and try again.");
  }
});
