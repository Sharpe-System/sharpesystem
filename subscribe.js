// subscribe.js
const WORKER_BASE = "https://sharpe-pay.nd-sharpe.workers.dev";

function $(id){ return document.getElementById(id); }

async function startCheckout() {
  const btn = $("checkoutBtn");
  const msg = $("msg");

  const setMsg = (t) => { if (msg) msg.textContent = t || ""; };

  try {
    btn && (btn.disabled = true);
    setMsg("Creating checkout...");

    const r = await fetch(`${WORKER_BASE}/create-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "tier1" })
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.log("Worker error:", data);
      setMsg("Checkout failed. Open Console for details.");
      btn && (btn.disabled = false);
      return;
    }

    if (!data.checkoutUrl) {
      console.log("Unexpected response:", data);
      setMsg("Checkout URL missing. Open Console.");
      btn && (btn.disabled = false);
      return;
    }

    // Send user to Square-hosted checkout (for now)
    window.location.href = data.checkoutUrl;

  } catch (e) {
    console.log(e);
    setMsg("Network error. Try again.");
    btn && (btn.disabled = false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  $("checkoutBtn")?.addEventListener("click", startCheckout);
});
