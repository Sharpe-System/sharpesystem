export async function onRequest(context) {
  return new Response(
    JSON.stringify(
      {
        ok: true,
        endpoint: "/api/square/webhook",
        methods: ["POST"],
        note: "Square webhook receiver (signature-verified)."
      },
      null,
      2
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function safeStr(x) {
  return String(x ?? "");
}

function isObj(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function constantTimeEqual(a, b) {
  a = safeStr(a);
  b = safeStr(b);
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function base64FromBytes(bytes) {
  let s = "";
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

async function hmacSha256Base64(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64FromBytes(sig);
}

function notificationUrlFromRequest(reqUrl) {
  const u = new URL(reqUrl);
  return u.origin + u.pathname;
}

function extractPayment(payload) {
  const p =
    payload?.data?.object?.payment ||
    payload?.data?.object?.data?.payment ||
    payload?.payment ||
    null;
  return isObj(p) ? p : null;
}

function extractMeta(payload, payment) {
  const m =
    payment?.metadata ||
    payload?.data?.object?.metadata ||
    payload?.metadata ||
    null;
  return isObj(m) ? m : {};
}

function pickUid(meta) {
  const a = safeStr(meta?.firebaseUid).trim();
  if (a) return a;
  const b = safeStr(meta?.userId).trim();
  if (b) return b;
  return "";
}

function pickEmail(meta) {
  return safeStr(meta?.email).trim().toLowerCase();
}

async function googleAccessToken(context) {
  const clientEmail = context.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (context.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  if (!clientEmail || !privateKey) throw new Error("missing_service_account");

  const enc = (o) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/datastore"
  };

  const data = enc(header) + "." + enc(payload);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    new TextEncoder().encode(privateKey),
    { name: "RSASSA-PKCS1_v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1_v1_5",
    key,
    new TextEncoder().encode(data)
  );

  const jwt =
    data +
    "." +
    btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", jwt);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });

  if (!res.ok) throw new Error("oauth_token_failed");
  const tok = await res.json();
  if (!tok?.access_token) throw new Error("oauth_token_missing");
  return tok.access_token;
}

function firestoreDocUrl(projectId, path) {
  return (
    "https://firestore.googleapis.com/v1/projects/" +
    projectId +
    "/databases/(default)/documents/" +
    path
  );
}

function fsString(v) {
  return { stringValue: safeStr(v) };
}

function fsTimestamp(iso) {
  return { timestampValue: iso };
}

async function firestoreGetUser(uid, context, access) {
  const projectId = context.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("missing_project_id");

  const url = firestoreDocUrl(projectId, "users/" + uid);
  const res = await fetch(url, { headers: { Authorization: "Bearer " + access } });
  if (res.status === 404) return { exists: false, doc: null };
  if (!res.ok) throw new Error("firestore_get_failed");
  const doc = await res.json();
  return { exists: true, doc };
}

async function firestoreCreateUser(uid, fields, context, access) {
  const projectId = context.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("missing_project_id");

  const url =
    firestoreDocUrl(projectId, "users") +
    "?documentId=" +
    encodeURIComponent(uid);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + access, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ fields })
  });

  if (!res.ok) throw new Error("firestore_create_failed");
  return await res.json();
}

async function firestorePatchUser(uid, fields, context, access) {
  const projectId = context.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("missing_project_id");

  const masks = Object.keys(fields)
    .map((k) => "updateMask.fieldPaths=" + encodeURIComponent(k))
    .join("&");

  const url = firestoreDocUrl(projectId, "users/" + uid) + (masks ? "?" + masks : "");

  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + access, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ fields })
  });

  if (!res.ok) throw new Error("firestore_patch_failed");
  return await res.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const sigHeader =
    request.headers.get("x-square-hmacsha256-signature") ||
    request.headers.get("X-Square-Hmacsha256-Signature") ||
    request.headers.get("x-square-signature") ||
    request.headers.get("X-Square-Signature") ||
    "";

  const sigKey = safeStr(env.SQUARE_WEBHOOK_SIGNATURE_KEY || "").trim();
  if (!sigKey) return json(500, { ok: false, error: "missing_env", name: "SQUARE_WEBHOOK_SIGNATURE_KEY" });

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return json(400, { ok: false, error: "body_read_failed" });
  }

  const notificationUrl = notificationUrlFromRequest(request.url);

  let expected = "";
  try {
    expected = await hmacSha256Base64(sigKey, notificationUrl + rawBody);
  } catch {
    return json(500, { ok: false, error: "signature_compute_failed" });
  }

  if (!sigHeader || !constantTimeEqual(sigHeader, expected)) {
    return json(403, { ok: false, error: "invalid_signature" });
  }

  let payload = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const payment = extractPayment(payload);
  const meta = extractMeta(payload, payment);

  const status = safeStr(payment?.status || payload?.data?.object?.payment?.status || "").trim().toUpperCase();
  if (status !== "COMPLETED") {
    return json(200, { ok: true, ignored: true, reason: "status_not_completed", status: status || "unknown" });
  }

  const paymentId = safeStr(payment?.id || payment?.payment_id || "").trim();
  const customerId = safeStr(payment?.customer_id || payment?.customerId || "").trim();

  const uid = pickUid(meta);
  const email = pickEmail(meta);

  if (!uid) {
    return json(200, { ok: true, ignored: true, reason: "uid_unresolved", hasEmail: !!email });
  }

  if (!paymentId) {
    return json(200, { ok: true, ignored: true, reason: "missing_payment_id" });
  }

  let access = "";
  try {
    access = await googleAccessToken(context);
  } catch {
    return json(500, { ok: false, error: "google_access_token_failed" });
  }

  let existing = null;
  try {
    existing = await firestoreGetUser(uid, context, access);
  } catch {
    return json(500, { ok: false, error: "firestore_get_failed" });
  }

  if (existing?.exists) {
    const prev = safeStr(existing?.doc?.fields?.squarePaymentId?.stringValue || "").trim();
    if (prev && prev === paymentId) {
      return json(200, { ok: true, noop: true, reason: "idempotent", paymentId });
    }
  }

  const nowIso = new Date().toISOString();

  const fields = {
    tier: fsString("paid"),
    tierSource: fsString("square"),
    tierUpdatedAt: fsTimestamp(nowIso),
    squareCustomerId: fsString(customerId),
    squarePaymentId: fsString(paymentId)
  };

  try {
    if (!existing?.exists) {
      await firestoreCreateUser(uid, fields, context, access);
    } else {
      await firestorePatchUser(uid, fields, context, access);
    }
  } catch {
    return json(500, { ok: false, error: "firestore_write_failed" });
  }

  return json(200, { ok: true, uid, tier: "paid", paymentId });
}
