// FILE: functions/_lib/verify-firebase.js
const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts = null;
let cachedAt = 0;

async function getCerts() {
  const now = Date.now();
  if (cachedCerts && now - cachedAt < 60_000) return cachedCerts;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error("cert fetch failed");
  cachedCerts = await res.json();
  cachedAt = now;
  return cachedCerts;
}

function base64urlToUint8(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  const bin = atob(str);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function pemToSpki(pem) {
  const b64 = pem
    .replace("-----BEGIN CERTIFICATE-----", "")
    .replace("-----END CERTIFICATE-----", "")
    .replace(/\s+/g, "");
  return base64urlToUint8(b64);
}

export async function verifyFirebaseIdToken(idToken, context) {
  const projectId = context.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("missing project");

  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed");

  const header = JSON.parse(
    new TextDecoder().decode(base64urlToUint8(parts[0]))
  );
  const payload = JSON.parse(
    new TextDecoder().decode(base64urlToUint8(parts[1]))
  );

  if (payload.aud !== projectId) throw new Error("aud");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new Error("iss");

  const certs = await getCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error("kid");

  const key = await crypto.subtle.importKey(
    "spki",
    pemToSpki(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64urlToUint8(parts[2]),
    new TextEncoder().encode(parts[0] + "." + parts[1])
  );

  if (!valid) throw new Error("sig");

  return payload;
}
