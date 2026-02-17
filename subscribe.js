// /subscribe.js
// Creates a checkout session via your Worker and redirects to the provider checkout URL.
// Tier names must match Authconan tier model: free | basic | pro | attorney

const WORKER_BASE = "https://sharpe-pay.nd-sharpe.workers.dev";

function $(id){ return document.getElementById(id); }
const msg = $("msg");

function setMsg(t){ if (msg) msg.textContent = t || ""; }

document.addEventListener("DOMContentLoaded", () => {
  const btn = $("payBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      btn.disabled = true;
      setMsg("Creating checkout…");

      const r = await fetch(`${WORKER_BASE}/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "basic" })
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
