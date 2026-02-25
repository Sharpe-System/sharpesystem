const REQUIRED_KV_BINDING = "JOBS_KV";
const RENDERER_PATH = "/api/render/fl300";
const TEMPLATE_PATH = "/templates/jcc/fl300/tpl.pdf";
const RENDERER_ID = "render/fl300@v1";

import { verifyFirebaseIdToken } from "../../_lib/verify-firebase.js";

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

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

function toHex(uint8) {
  return Array.from(uint8).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Bytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

function requireKv(env) {
  const kv = env && env[REQUIRED_KV_BINDING];
  if (!kv) return null;
  if (typeof kv.get !== "function" || typeof kv.put !== "function") return null;
  return kv;
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed.", route: "/api/jobs/create" });
  }

  const kv = requireKv(env);
  if (!kv) {
    return json(500, { ok: false, error: "Missing KV binding.", route: "/api/jobs/create" });
  }

  const token = bearerToken(request);
  if (!token) return json(401, { ok: false, error: "Missing token.", route: "/api/jobs/create" });

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(token, context);
  } catch {
    return json(401, { ok: false, error: "Invalid token.", route: "/api/jobs/create" });
  }

  const uid = decoded?.user_id || decoded?.uid;
  if (!uid) return json(401, { ok: false, error: "Invalid token payload.", route: "/api/jobs/create" });

  try {
    await requireExportEntitlement(uid, context);
  } catch {
    return json(403, { ok: false, error: "Entitlement required.", route: "/api/jobs/create" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON.", route: "/api/jobs/create" });
  }

  const flow = body?.flow;
  const form = body?.form;
  const draft = body?.draft;

  if (flow !== "rfo" || form !== "fl300") {
    return json(400, { ok: false, error: "Unsupported flow.", route: "/api/jobs/create" });
  }

  if (!draft || !draft.rfo) {
    return json(400, { ok: false, error: "Invalid draft.", route: "/api/jobs/create" });
  }

  let renderPayload;
  try {
    renderPayload = JSON.parse(JSON.stringify(draft));
  } catch {
    return json(400, { ok: false, error: "Draft not serializable.", route: "/api/jobs/create" });
  }

  const origin = new URL(request.url).origin;

  let templateId = "";
  try {
    const tplRes = await fetch(origin + TEMPLATE_PATH);
    if (!tplRes.ok) return json(500, { ok: false, error: "Template fetch failed.", route: "/api/jobs/create" });
    const tplBuf = await tplRes.arrayBuffer();
    templateId = await sha256Bytes(tplBuf);
  } catch {
    return json(500, { ok: false, error: "Template hash failed.", route: "/api/jobs/create" });
  }

  let pdfBytes;
  let pdfSha256 = "";
  let pdfBase64 = "";

  try {
    const renderRes = await fetch(origin + RENDERER_PATH, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/pdf" },
      body: JSON.stringify(renderPayload)
    });

    if (renderRes.status !== 200) {
      return json(500, { ok: false, error: "Renderer failed.", route: "/api/jobs/create" });
    }

    const buf = await renderRes.arrayBuffer();
    pdfBytes = new Uint8Array(buf);
    pdfSha256 = await sha256Bytes(buf);
    pdfBase64 = Buffer.from(pdfBytes).toString("base64");
  } catch {
    return json(500, { ok: false, error: "Render failed.", route: "/api/jobs/create" });
  }

  const jobId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const job = {
    ok: true,
    jobId,
    flow,
    form,
    createdAt,
    rendererId: RENDERER_ID,
    templatePath: TEMPLATE_PATH,
    templateId,
    renderPayload,
    pdf: {
      contentType: "application/pdf",
      filename: "FL-300.pdf",
      sha256: pdfSha256,
      base64: pdfBase64
    }
  };

  const key = "job:" + jobId;

  const existing = await kv.get(key);
  if (existing) return json(409, { ok: false, error: "Collision.", route: "/api/jobs/create" });

  await kv.put(key, JSON.stringify(job));

  return json(200, {
    ok: true,
    jobId,
    pdfUrl: "/api/jobs/get?id=" + encodeURIComponent(jobId) + "&asset=pdf"
  });
}
