// POST /api/square/charge
// Body: { token, tier, firebaseUid, email }

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const token = body?.token;
    const tier = body?.tier || "basic";
    const uid = body?.firebaseUid || null;
    const email = body?.email || null;

    if (!token) {
      return new Response(JSON.stringify({ ok:false, error:"missing_token" }), { status:400 });
    }

    const amountMap = {
      basic: 1000,   // $10
      pro: 2900      // $29
    };

    const amount = amountMap[tier] || 1000;

    const res = await fetch("https://connect.squareup.com/v2/payments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${env.SQUARE_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        source_id: token,
        amount_money: {
          amount,
          currency: "USD"
        },
        note: `SharpeSystem ${tier}`,
        metadata: {
          firebaseUid: uid || "",
          email: email || "",
          tier
        }
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ ok:false, error:data }), { status:400 });
    }

    return new Response(JSON.stringify({ ok:true, payment:data.payment }), {
      headers:{ "content-type":"application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String(e) }), { status:500 });
  }
}
