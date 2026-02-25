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

  const prefix = `users/${uid}/jobs/`;
  const limit = 200;

  let cursor = null;
  const jobs = [];

  try {
    while (jobs.length < limit) {
      const resp = await kv.list({ prefix, cursor, limit: 200 });
      const keys = Array.isArray(resp?.keys) ? resp.keys : [];
      cursor = resp?.cursor || null;

      for (const k of keys) {
        if (jobs.length >= limit) break;

        const keyName = safeStr(k?.name);
        if (!keyName) continue;

        const raw = await kv.get(keyName);
        if (!raw) continue;

        let meta;
        try {
          meta = JSON.parse(raw);
        } catch {
          continue;
        }

        if (!isObj(meta)) continue;
        if (safeStr(meta.uid) !== safeStr(uid)) continue;

        jobs.push({
          jobId: safeStr(meta.jobId || keyName.replace(prefix, "")),
          flow: safeStr(meta.flow),
          form: safeStr(meta.form),
          title: safeStr(meta.title),
          caseNumber: safeStr(meta.caseNumber),
          county: safeStr(meta.county),
          pageCount: meta.pageCount ?? null,
          createdAt: safeStr(meta.createdAt)
        });
      }

      if (!cursor) break;
      if (resp?.list_complete === true) break;
      if (!keys.length) break;
    }
  } catch (e) {
    return json(500, { ok: false, error: "KV list/read failed.", message: String(e?.message || e), route: "/api/jobs/list" });
  }

  jobs.sort((a, b) => safeStr(b.createdAt).localeCompare(safeStr(a.createdAt)));

  return json(200, { ok: true, count: jobs.length, jobs });
}
