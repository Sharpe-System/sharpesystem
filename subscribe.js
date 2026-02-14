// success / activation inline script (FIXED)
const WORKER_BASE = "https://sharpe-pay.nd-sharpe.workers.dev";
const msg = document.getElementById("msg");

const params = new URLSearchParams(window.location.search);
const uid = params.get("uid") || ""; // only present if we pass it through create-checkout

msg.textContent = uid
  ? "Finalizing access…"
  : "Payment complete. Please log in to continue.";

if (uid) {
  (async () => {
    try {
      const r = await fetch(`${WORKER_BASE}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, tier: "tier1" }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) throw new Error("Activation failed");

      msg.textContent = "Activated. Sending you to dashboard…";
      setTimeout(() => (window.location.href = "/dashboard.html"), 900);
    } catch (e) {
      console.log(e);
      msg.textContent = "Activation error. Please contact support.";
    }
  })();
}
