function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function safeStr(x){ return String(x ?? "").trim(); }

export async function onRequestGet(context) {
  const appId = safeStr(context.env.SQUARE_APP_ID);
  const locationId = safeStr(context.env.SQUARE_LOCATION_ID);
  const env = safeStr(context.env.SQUARE_ENV || "sandbox").toLowerCase();

  if (!appId) return json(500, { ok:false, error:"missing_env", name:"SQUARE_APP_ID" });
  if (!locationId) return json(500, { ok:false, error:"missing_env", name:"SQUARE_LOCATION_ID" });

  return json(200, { ok:true, appId, locationId, env });
}
