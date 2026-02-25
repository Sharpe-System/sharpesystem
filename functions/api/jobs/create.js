// ---- Auth + Entitlement Gate (canonical) ----
import { verifyFirebaseIdToken } from "../../_lib/verify-firebase.js";

function bearerToken(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

async function googleAccessToken(context) {
  const clientEmail = context.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (context.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);

  const enc = (o) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/datastore",
  };

  const data = enc(header) + "." + enc(payload);

  const key = await crypto.subtle.importKey(
    "pkcs8",
    new TextEncoder().encode(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
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
    body: form.toString(),
  });

  const tok = await res.json();
  return tok.access_token;
}

async function requireExportEntitlement(uid, context) {
  const projectId = context.env.FIREBASE_PROJECT_ID;
  const access = await googleAccessToken(context);

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    projectId +
    "/databases/(default)/documents/users/" +
    uid +
    "/entitlements/export";

  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + access },
  });

  if (res.status === 404) throw new Error("entitlement");
  if (!res.ok) throw new Error("firestore");

  const doc = await res.json();
  if (doc?.fields?.enabled?.booleanValue !== true) {
    throw new Error("entitlement");
  }
}
