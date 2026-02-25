// FILE: functions/api/jobs/create.js
const REQUIRED_KV_BINDING = "JOBS_KV";
const RENDERER_PATH = "/api/render/fl300";
const TEMPLATE_PATH = "/templates/jcc/fl300/tpl.pdf";
const RENDERER_ID = "render/fl300@v1";

import { verifyFirebaseIdToken } from "../../_lib/verify-firebase.js";
import { requireExportEntitlement } from "../../_lib/entitlement.js";

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
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

function bearerToken(request) {
  const authz = request.headers.get("Authorization") || "";
  const m = authz.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed. Use POST.", route: "/api/jobs/create" });
  }

  const kv = requireKv(env);
  if (!kv) {
    return json(500, {
      ok: false,
      error: "Missing KV binding.",
      binding: REQUIRED_KV_BINDING,
      fix: "Add a Pages KV binding named JOBS_KV (Settings → Functions → KV bindings).",
      route: "/api/jobs/create"
    });
  }

  const token = bearerToken(request);
  if (!token) {
    return json(401, { ok: false, error: "Missing bearer token.", route: "/api/jobs/create" });
  }

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(token, context);
  } catch (e) {
    return json(401, { ok: false, error: "Invalid token.", route: "/api/jobs/create" });
  }

  const uid = decoded?.user_id || decoded?.uid;
  if (!uid) {
    return json(401, { ok: false, error: "Invalid token payload.", route: "/api/jobs/create" });
  }

  try {
    await requireExportEntitlement(uid, context);
  } catch (e) {
    return json(e?.status || 403, { ok: false, error: "Entitlement required.", route: "/api/jobs/create" });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json(400, { ok: false, error: "Invalid JSON body.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  const flow = body && typeof body === "object" ? body.flow : null;
  const form = body && typeof body === "object" ? body.form : null;
  const draft = body && typeof body === "object" ? body.draft : null;

  if (flow !== "rfo" || form !== "fl300") {
    return json(400, { ok: false, error: "Unsupported flow/form.", expected: { flow: "rfo", form: "fl300" }, got: { flow, form }, route: "/api/jobs/create" });
  }

  if (!draft || typeof draft !== "object" || !draft.rfo || typeof draft.rfo !== "object") {
    return json(400, { ok: false, error: "Invalid draft payload. Expected { draft: { rfo: {...} } }.", route: "/api/jobs/create" });
  }

  let renderPayload;
  try {
    renderPayload = JSON.parse(JSON.stringify(draft));
  } catch (e) {
    return json(400, { ok: false, error: "Draft is not JSON-serializable.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  const origin = new URL(request.url).origin;

  let templateId = "";
  try {
    const tplRes = await fetch(origin + TEMPLATE_PATH);
    if (!tplRes.ok) {
      return json(500, { ok: false, error: "Template fetch failed.", status: tplRes.status, path: TEMPLATE_PATH, route: "/api/jobs/create" });
    }
    const tplBuf = await tplRes.arrayBuffer();
    templateId = await sha256Bytes(tplBuf);
  } catch (e) {
    return json(500, { ok: false, error: "Template hash failed.", message: String(e?.message || e), route: "/api/jobs/create" });
  }

  let pdfBytes;
  let pdfSha256 = "";
  let pdfBase64 = "";
  try {
    const renderRes = await fetch(origin + RENDERER_PATH, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/pdf, application/json"
      },
      body: JSON.stringify(renderPayload)
    });

    const ct = (renderRes.headers.get("content-type") || "").toLowerCase();

    if (renderRes.status !== 200 || ct.indexOf("application/pdf") === -1) {
      let errBody = "";
      try {
        if (ct.indexOf("application/json") !== -1) errBody = JSON.stringify(await renderRes.json(), null, 2);
        else errBody = await renderRes.text();
      } catch (_) {}
      return json(500, {
        ok: false,
        error: "Renderer did not return PDF.",
        status: renderRes.status,
        contentType: ct,
        body: (errBody || "").slice(0, 4000),
        route: "/api/jobs/create"
      });
    }

    const buf = await renderRes.arrayBuffer();
    pdfBytes = new Uint8Array(buf);
    pdfSha256 = await sha256Bytes(buf);
    pdfBase64 = Buffer.from(pdfBytes).toString("base64");
  } catch (e) {
    return json(500, { ok: false, error: "Render fetch failed.", message: String(e?.message || e), route: "/api/jobs/create" });
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
  if (existing) {
    return json(409, { ok: false, error: "JobId collision (refused overwrite).", jobId, route: "/api/jobs/create" });
  }

  await kv.put(key, JSON.stringify(job));

  return json(200, {
    ok: true,
    jobId,
    pdfUrl: "/api/jobs/get?id=" + encodeURIComponent(jobId) + "&asset=pdf",
    renderPayload: job.renderPayload
  });
}
