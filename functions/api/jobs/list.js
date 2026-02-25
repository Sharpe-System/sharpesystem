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
  if (typeof kv.get !== "function") return null;
  return kv;
}

function bearerToken(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "GET") {
    return json(405, { ok: false });
  }

  const kv = requireKv(env);
  if (!kv) {
    return json(500, { ok: false, error: "Missing KV binding." });
  }

  const token = bearerToken(request);
  if (!token) return json(401, { ok: false });

  let decoded;
  try {
    decoded = await verifyFirebaseIdToken(token, context);
  } catch {
    return json(401, { ok: false });
  }

  const uid = decoded?.user_id || decoded?.uid;
  if (!uid) return json(401, { ok: false });

  const indexKey = "jobs_index:" + uid;
  const raw = await kv.get(indexKey);
  if (!raw) return json(200, { ok: true, jobs: [] });

  let jobIds = [];
  try {
    jobIds = JSON.parse(raw);
  } catch {
    return json(200, { ok: true, jobs: [] });
  }

  const jobs = [];

  for (const jobId of jobIds) {
    const rawJob = await kv.get("job:" + jobId);
    if (!rawJob) continue;

    try {
      const job = JSON.parse(rawJob);
      jobs.push({
        jobId,
        flow: job.flow,
        form: job.form,
        createdAt: job.createdAt,
        pageCount: null
      });
    } catch {}
  }

  return json(200, { ok: true, jobs });
}
