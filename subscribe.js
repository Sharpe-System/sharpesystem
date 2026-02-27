// /subscribe.js
import { getAuthStateOnce } from "/firebase-config.js";

const WORKER_BASE = "https://sharpe-pay.nd-sharpe.workers.dev";

function $(id){ return document.getElementById(id); }
const msg = $("msg");

function setMsg(t){ if (msg) msg.textContent = t || ""; }

function getTierFromUrl() {
  const u = new URL(window.location.href);
  const t = (u.searchParams.get("tier") || "basic").toLowerCase();
  if (t === "pro" || t === "attorney") return t;
  return "basic";
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = $("payBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      btn.disabled = true;
      setMsg("Creating checkout…");

      const tier = getTierFromUrl();

      const state = await getAuthStateOnce();
      const user = state?.user || null;

      const r = await fetch(`${WORKER_BASE}/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          firebaseUid: user?.uid || null,
          email: user?.email || null
        })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.checkoutUrl) {
        console.log("Checkout error:", data);
        setMsg("Checkout failed. Open Console.");
        btn.disabled = false;
        return;
      }

      window.location.href = data.checkoutUrl;
    } catch (e) {
      console.log(e);
      setMsg("Network error. Try again.");
      btn.disabled = false;
    }
  });
});
