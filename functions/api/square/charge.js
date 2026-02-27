export async function onRequestPost(context) {
  const { request, env } = context;

  function json(status, obj) {
    return new Response(JSON.stringify(obj, null, 2), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
    });
  }

  function safeStr(x) {
    return String(x ?? "").trim();
  }

  const accessToken = safeStr(env.SQUARE_ACCESS_TOKEN);
  if (!accessToken) return json(500, { ok: false, error: "missing_env", name: "SQUARE_ACCESS_TOKEN" });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const token = safeStr(body?.token);
  const tierRaw = safeStr(body?.tier || "basic").toLowerCase();
  const tier = tierRaw === "pro" ? "pro" : "basic";

  if (!token) return json(400, { ok: false, error: "missing_token" });

  const amountMap = { basic: 2500, pro: 4999 };
  const amount = amountMap[tier];

  const firebaseUid = safeStr(body?.firebaseUid);
  const email = safeStr(body?.email);

  const payload = {
    idempotency_key: crypto.randomUUID(),
    source_id: token,
    amount_money: { amount, currency: "USD" },
    note: `SharpeSystem ${tier}`,
    metadata: {
      tier,
      firebaseUid: firebaseUid || "",
      email: email || ""
    }
  };

  const res = await fetch("https://connect.squareup.com/v2/payments", {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return json(400, { ok: false, error: "square_payment_failed", status: res.status, details: data });
  }

  return json(200, {
    ok: true,
    tier,
    paymentId: safeStr(data?.payment?.id),
    status: safeStr(data?.payment?.status),
    receiptUrl: safeStr(data?.payment?.receipt_url)
  });
}
