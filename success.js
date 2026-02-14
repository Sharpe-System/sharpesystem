// success.js
const WORKER_BASE = "https://sharpe-pay.nd-sharpe.workers.dev";

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
  if (!r.ok || !data.ok) throw new Error("Activation failed");
  return data;
}

(async () => {
  try {
    // If Square adds query params, they’ll be here; we only care about uid if we pass it.
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid") || "";

    if (!uid) {
      setMsg("Payment received. Log in to unlock (activation needs your user id).");
      return;
    }

    setMsg("Finalizing access…");
    await activate(uid);
    setMsg("Activated. Sending you to dashboard…");
    setTimeout(() => (window.location.href = "/dashboard.html"), 900);

  } catch (e) {
    console.log(e);
    setMsg("Activation error. Log in and contact support if it persists.");
  }
})();
