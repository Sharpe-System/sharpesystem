<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Success</title>
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 16px;">
    <section style="max-width:720px;width:100%;background:var(--panel);border:1px solid var(--border);border-radius:18px;padding:26px;box-shadow:var(--shadow);">
      <h1 style="margin:0 0 8px;">Payment received</h1>
      <p style="color:var(--muted);margin:0 0 14px;line-height:1.45;">
        Activating your account…
      </p>
      <div id="msg" style="color:var(--muted);"></div>
    </section>
  </main>

  <script type="module">
    const WORKER_BASE = "https://sharpe-pay.nd-sharpe.workers.dev";
    const msg = document.getElementById("msg");

    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid") || ""; // will be present once we pass it in create-checkout

    msg.textContent = uid ? "Finalizing access…" : "Payment complete. Please log in to continue.";

    if (uid) {
      try {
        const r = await fetch(`${WORKER_BASE}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, tier: "tier1" })
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.ok) throw new Error("Activation failed");
        msg.textContent = "Activated. Sending you to dashboard…";
        setTimeout(() => (window.location.href = "/dashboard.html"), 900);
      } catch (e) {
        console.log(e);
        msg.textContent = "Activation error. Please contact support.";
      }
    }
  </script>
</body>
</html>
