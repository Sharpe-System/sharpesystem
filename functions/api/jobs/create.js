const REQUIRED_KV_BINDING = "JOBS_KV";

import { verifyFirebaseIdToken } from "../../_lib/verify-firebase.js";

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
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

function pickMeta(uid, jobId, createdAt, contract, draft) {
  const flow = String(contract?.flow || "");
  const form = String(contract?.form || "");

  const pleading = isObj(draft?.pleading) ? draft.pleading : null;
  const rfo = isObj(draft?.rfo) ? draft.rfo : null;

  const title =
    flow === "pleading"
      ? String(pleading?.documentTitle || "Pleading Paper")
      : String(rfo?.title || rfo?.captionTitle || "RFO");

  const caseNumber =
    flow === "pleading"
      ? String(pleading?.caseNumber || "")
      : String(rfo?.caseNumber || "");

  const county =
    flow === "pleading"
      ? String(pleading?.county || pleading?.courtCounty || "")
      : String(rfo?.county || "");

  return {
    uid,
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
    scope: "https://www.googleapis.com/auth/datastore"
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
    body: form.toString()
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
    headers: { Authorization: "Bearer " + access }
  });

  if (res.status === 404) throw new Error("entitlement");
  if (!res.ok) throw new Error("firestore");

  const doc = await res.json();
  if (doc?.fields?.enabled?.booleanValue !== true) throw new Error("entitlement");
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
  } catch {
    return json(403, { ok: false, error: "Entitlement required.", route: "/api/jobs/create" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON.", route: "/api/jobs/create" });
  }

  const flow = String(body?.flow || "").trim();
  const form = String(body?.form || "").trim();
  const draftIn = body?.draft;

  if (!flow || !form || !draftIn) {
    return json(400, { ok: false, error: "Missing flow/form/draft.", route: "/api/jobs/create" });
  }

  const draft = normalizeDraft(flow, draftIn);
  if (!draft) {
    return json(400, {
      ok: false,
      error: "Invalid draft payload shape.",
      expected:
        flow === "pleading"
          ? "{ draft: { pleading: { ... } } }"
          : "{ draft: { rfo: { ... } } }",
      route: "/api/jobs/create"
    });
  }

  const contract = {
    flow,
    form,
    rendererPath: flow === "pleading" ? "/api/render/pleading" : "/api/render/fl300",
    templatePath: flow === "pleading" ? "/templates/pleading/blank.pdf" : "/templates/jcc/fl300/tpl.pdf",
    rendererId: flow === "pleading" ? "render/pleading@v1" : "render/fl300@v1",
    filename: flow === "pleading" ? "pleading-paper.pdf" : "FL-300.pdf"
  };

  const origin = new URL(request.url).origin;

  let templateId = "none";
  try {
    const tplRes = await fetch(origin + contract.templatePath);
    if (tplRes.ok) {
      const tplBuf = await tplRes.arrayBuffer();
      templateId = await sha256Bytes(tplBuf);
    }
  } catch {}

  let pdfSha256 = "";
  let pdfBase64 = "";

  try {
    const renderRes = await fetch(origin + contract.rendererPath, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/pdf" },
      body: JSON.stringify(draft)
    });

    if (renderRes.status !== 200) {
      return json(500, { ok: false, error: "Renderer failed.", status: renderRes.status, route: "/api/jobs/create" });
    }

    const buf = await renderRes.arrayBuffer();
    pdfSha256 = await sha256Bytes(buf);

    // nodejs_compat required; wrangler.toml already sets nodejs_compat
    // eslint-disable-next-line no-undef
    pdfBase64 = Buffer.from(new Uint8Array(buf)).toString("base64");
  } catch (e) {
    return json(500, { ok: false, error: "Render failed.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  const jobId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

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
    renderPayload: draft,
    pdf: {
      contentType: "application/pdf",
      filename: contract.filename,
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

    await kv.put(jobKey, JSON.stringify(job));

    const meta = pickMeta(uid, jobId, createdAt, contract, draft);
    await kv.put(indexKey, JSON.stringify(meta));
  } catch (e) {
    return json(500, { ok: false, error: "KV write failed.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  return json(200, {
    ok: true,
    jobId,
    renderUrl: "/rfo/print.html?job=" + encodeURIComponent(jobId),
    pdfUrl: "/api/jobs/get?id=" + encodeURIComponent(jobId) + "&asset=pdf"
  });
}
