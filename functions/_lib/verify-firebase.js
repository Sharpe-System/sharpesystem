// FILE: functions/_lib/verify-firebase.js
import jwt from "@tsndr/cloudflare-worker-jwt";

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts = null;
let cachedAt = 0;

async function getCerts() {
  const now = Date.now();
  if (cachedCerts && (now - cachedAt) < 60_000) return cachedCerts;

  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error("Failed to fetch Firebase certs");
  cachedCerts = await res.json();
  cachedAt = now;
  return cachedCerts;
}

export async function verifyFirebaseIdToken(idToken, context) {
  const projectId = context.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("Missing FIREBASE_PROJECT_ID");

  const certs = await getCerts();

  const decodedHeader = jwt.decode(idToken, { complete: true })?.header;
  const kid = decodedHeader?.kid;
  const cert = kid ? certs[kid] : null;
  if (!cert) throw new Error("Unknown key id");

  const isValid = await jwt.verify(idToken, cert, {
    algorithm: "RS256",
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  });

  if (!isValid) throw new Error("Token invalid");

  return jwt.decode(idToken);
}
