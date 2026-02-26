const REQUIRED_KV_BINDING = "JOBS_KV";

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

function requireKv(env) {
  const kv = env && env[REQUIRED_KV_BINDING];
  if (!kv) return null;
  if (typeof kv.get !== "function" || typeof kv.put !== "function" || typeof kv.list !== "function") return null;
  return kv;
}

function isObj(x) {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function safeStr(x) {
  return String(x ?? "");
}

function clampInt(n, lo, hi, fallback) {
  const v = Number.parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, v));
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "GET") {
    return json(405, { ok: false, error: "Method not allowed. Use GET.", route: "/api/jobs/list" });
  }

  const kv = requireKv(env);
  if (!kv) {
    return json(500, { ok: false, error: "Missing KV binding.", binding: REQUIRED_KV_BINDING, route: "/api/jobs/list" });
  }

  const token = bearerToken(request);
  if (!token) return json(401, { ok: false, error: "Missing token.", route: "/api/jobs/list" });

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(token, context);
  } catch {
    return json(401, { ok: false, error: "Invalid token.", route: "/api/jobs/list" });
  }

  const uid = decoded?.user_id || decoded?.uid;
  if (!uid) return json(401, { ok: false, error: "Invalid token payload.", route: "/api/jobs/list" });

  const url = new URL(request.url);
  const prefix = `users/${uid}/jobs/`;

  const limit = clampInt(url.searchParams.get("limit"), 1, 200, 50);
  const cursor = safeStr(url.searchParams.get("cursor") || "") || undefined;

  let resp;
  try {
    resp = await kv.list({ prefix, limit, cursor });
  } catch (e) {
    return json(500, { ok: false, error: "KV list failed.", message: String(e?.message || e), route: "/api/jobs/list" });
  }

  const keys = Array.isArray(resp?.keys) ? resp.keys : [];

  // Canon: nextCursor MUST be null when list_complete.
  const listComplete = resp?.list_complete === true;
  const nextCursor = listComplete ? null : (safeStr(resp?.cursor || "") || null);

  const jobs = [];
  for (const k of keys) {
    const keyName = safeStr(k?.name);
    if (!keyName) continue;

    let raw = null;
    try {
      raw = await kv.get(keyName);
    } catch {
      continue;
    }
    if (!raw) continue;

    let meta;
    try {
      meta = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!isObj(meta)) continue;

    const jobId = safeStr(meta.jobId || keyName.replace(prefix, ""));

    // HARDENING: only list jobs that actually exist in immutable space.
    // This is NOT a scan. It's a direct key lookup for items already paged.
    try {
      const exists = await kv.get("job:" + jobId);
      if (!exists) continue;
    } catch {
      continue;
    }

    jobs.push({
      jobId,
      flow: safeStr(meta.flow),
      form: safeStr(meta.form),
      title: safeStr(meta.title),
      caseNumber: safeStr(meta.caseNumber),
      county: safeStr(meta.county),
      pageCount: meta.pageCount ?? null,
      createdAt: safeStr(meta.createdAt)
    });
  }

  jobs.sort((a, b) => safeStr(b.createdAt).localeCompare(safeStr(a.createdAt)));

  return json(200, {
    ok: true,
    count: jobs.length,
    jobs,
    nextCursor
  });
}
