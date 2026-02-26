// FILE: functions/api/jobs/create.js  (OVERWRITE)
//
// Canon:
// - POST /api/jobs/create
// - Verify Firebase token (Bearer)
// - Verify export entitlement (Firestore)
// - Render PDF via canonical renderer endpoint(s)
// - Store immutable job at job:{jobId}
// - Store dashboard meta at users/{uid}/jobs/{jobId}  (meta MUST NOT require uid)
// - Return { ok, jobId, renderUrl, pdfUrl }
//
// KV binding: JOBS_KV
// Keyspaces:
// - job:{jobId}
// - users/{uid}/jobs/{jobId}

const REQUIRED_KV_BINDING = "JOBS_KV";

import { verifyFirebaseIdToken } from "../../_lib/verify-firebase.js";

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function requireKv(env) {
  const kv = env && env[REQUIRED_KV_BINDING];
  if (!kv) return null;
  if (typeof kv.get !== "function" || typeof kv.put !== "function" || typeof kv.list !== "function") return null;
  return kv;
}

function bearerToken(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function isObj(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function safeStr(x) {
  return String(x ?? "");
}

function safeFlow(x) {
  const v = safeStr(x).trim();
  return v;
}

function pickMeta(jobId, createdAt, contract, draft) {
  const flow = safeStr(contract?.flow || "");
  const form = safeStr(contract?.form || "");

  const pleading = isObj(draft?.pleading) ? draft.pleading : null;
  const rfo = isObj(draft?.rfo) ? draft.rfo : null;

  const title =
    flow === "pleading"
      ? safeStr(pleading?.documentTitle || "Pleading Paper")
      : safeStr(rfo?.title || rfo?.captionTitle || "RFO");

  const caseNumber =
    flow === "pleading"
      ? safeStr(pleading?.caseNumber || "")
      : safeStr(rfo?.caseNumber || "");

  const county =
    flow === "pleading"
      ? safeStr(pleading?.county || pleading?.courtCounty || "")
      : safeStr(rfo?.county || "");

  // Canon: UID is implied by prefix. Do NOT write uid in meta.
  return {
    jobId,
    flow,
    form,
    title,
    caseNumber,
    county,
    pageCount: null,
    createdAt
  };
}

function toHex(uint8) {
  return Array.from(uint8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Bytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

function normalizeDraft(flow, draft) {
  if (!isObj(draft)) return null;

  if (flow === "pleading") {
    if (isObj(draft.pleading)) return { pleading: draft.pleading };
    return null;
  }

  if (flow === "rfo") {
    if (isObj(draft.rfo)) return { rfo: draft.rfo };
    return null;
  }

  return null;
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

async function requireExportEntitlement(uid, context) {
  const projectId = context.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("missing_project_id");

  const access = await googleAccessToken(context);

  const url =
    "https://firestore.googleapis.com/v1/projects/" +
    projectId +
    "/databases/(default)/documents/users/" +
    uid +
    "/entitlements/export";

  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + access }
  });

  if (res.status === 404) throw new Error("entitlement");
  if (!res.ok) throw new Error("firestore");

  const doc = await res.json();
  if (doc?.fields?.enabled?.booleanValue !== true) throw new Error("entitlement");
}

function rendererEndpointFor(flow) {
  // Canon: do not redesign renderers; just call canonical endpoints.
  if (flow === "pleading") return "/api/render/pleading";
  if (flow === "rfo") return "/api/render/rfo";
  return "";
}

function base64ToUint8Array(b64) {
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function fetchTemplateBytes(context, templatePath) {
  const path = safeStr(templatePath).trim();
  if (!path) return null;

  // Resolve relative to current origin
  const url = new URL(path, new URL(context.request.url).origin);
  const res = await fetch(url.toString(), { method: "GET" });

  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

async function renderPdfBytes(context, flow, renderPayload) {
  const endpoint = rendererEndpointFor(flow);
  if (!endpoint) throw new Error("unsupported_flow");

  const url = new URL(endpoint, new URL(context.request.url).origin);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(renderPayload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("renderer_failed:" + res.status + ":" + text.slice(0, 200));
  }

  const ct = safeStr(res.headers.get("content-type")).toLowerCase();

  // Support either application/pdf bytes OR JSON with base64 (tolerant)
  if (ct.includes("application/pdf")) {
    return new Uint8Array(await res.arrayBuffer());
  }

  const data = await res.json().catch(() => null);
  const b64 =
    safeStr(data?.pdfBase64 || data?.pdf?.base64 || data?.base64 || "").trim();
  if (!b64) throw new Error("renderer_missing_pdf");
  return base64ToUint8Array(b64);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed.", route: "/api/jobs/create" });
  }

  const kv = requireKv(env);
  if (!kv) {
    return json(500, { ok: false, error: "Missing KV binding.", binding: REQUIRED_KV_BINDING, route: "/api/jobs/create" });
  }

  const token = bearerToken(request);
  if (!token) {
    return json(401, { ok: false, error: "Missing token.", route: "/api/jobs/create" });
  }

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(token, context);
  } catch {
    return json(401, { ok: false, error: "Invalid token.", route: "/api/jobs/create" });
  }

  const uid = decoded?.user_id || decoded?.uid;
  if (!uid) {
    return json(401, { ok: false, error: "Invalid token payload.", route: "/api/jobs/create" });
  }

  try {
    await requireExportEntitlement(uid, context);
  } catch (e) {
    // Canon: entitlement gates create.
    return json(403, { ok: false, error: "Export entitlement required.", route: "/api/jobs/create" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON body.", route: "/api/jobs/create" });
  }

  const contract = isObj(body?.contract) ? body.contract : null;
  const draftIn = isObj(body?.draft) ? body.draft : null;

  if (!contract || !draftIn) {
    return json(400, { ok: false, error: "Missing contract or draft.", route: "/api/jobs/create" });
  }

  const flow = safeFlow(contract?.flow);
  const normalized = normalizeDraft(flow, draftIn);
  if (!normalized) {
    return json(400, { ok: false, error: "Invalid draft for flow.", flow, route: "/api/jobs/create" });
  }

  const createdAt = new Date().toISOString();
  const jobId = crypto.randomUUID();

  // Hash template (best-effort; allowed to be null if templatePath not fetchable)
  let templateSha256 = "";
  try {
    const tplBytes = await fetchTemplateBytes(context, contract?.templatePath);
    if (tplBytes) templateSha256 = await sha256Bytes(tplBytes);
  } catch {
    templateSha256 = "";
  }

  // Render PDF bytes
  let pdfBytes;
  try {
    pdfBytes = await renderPdfBytes(context, flow, normalized);
  } catch (e) {
    return json(500, { ok: false, error: "Render failed.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  const pdfSha256 = await sha256Bytes(pdfBytes);
  const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

  const templateId = safeStr(body?.templateId || contract?.templateId || "").trim();

  const job = {
    ok: true,
    jobId,
    uid,
    flow: contract.flow,
    form: contract.form,
    createdAt,
    rendererId: contract.rendererId,
    templatePath: contract.templatePath,
    templateId,
    templateSha256,
    renderPayload: normalized,
    pdf: {
      contentType: "application/pdf",
      filename: safeStr(contract.filename || `${flow || "document"}.pdf`),
      sha256: pdfSha256,
      base64: pdfBase64
    }
  };

  const jobKey = "job:" + jobId;
  const indexKey = `users/${uid}/jobs/${jobId}`;

  try {
    const existing = await kv.get(jobKey);
    if (existing) {
      return json(409, { ok: false, error: "Collision.", route: "/api/jobs/create" });
    }

    // Canon: immutable after write.
    await kv.put(jobKey, JSON.stringify(job));

    const meta = pickMeta(jobId, createdAt, contract, normalized);
    await kv.put(indexKey, JSON.stringify(meta));
  } catch (e) {
    return json(500, { ok: false, error: "KV write failed.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  return json(200, {
    ok: true,
    jobId,
    renderUrl: "/print.html?job=" + encodeURIComponent(jobId),
    pdfUrl: "/api/jobs/get?id=" + encodeURIComponent(jobId) + "&asset=pdf"
  });
}
