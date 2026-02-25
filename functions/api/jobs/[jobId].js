const REQUIRED_KV_BINDING = "JOBS_KV";

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function requireKv(env) {
  const kv = env && env[REQUIRED_KV_BINDING];
  if (!kv) return null;
  if (typeof kv.get !== "function" || typeof kv.put !== "function") return null;
  return kv;
}

export async function onRequest(context) {
  const { request, env } = context;

  const kv = requireKv(env);
  if (!kv) {
    return json(500, {
      ok: false,
      error: "Missing KV binding.",
      binding: REQUIRED_KV_BINDING,
      fix: "Add a Pages KV binding named JOBS_KV (Settings → Functions → KV bindings).",
      route: "/api/jobs/:jobId"
    });
  }

  const url = new URL(request.url);
  const m = url.pathname.match(/\/api\/jobs\/([^/]+)$/);
  const jobId = m ? decodeURIComponent(m[1]) : "";

  if (!jobId) {
    return json(400, { ok: false, error: "Missing jobId in path.", route: "/api/jobs/:jobId" });
  }

  const key = "job:" + jobId;
  const raw = await kv.get(key);

  if (!raw) {
    return json(404, { ok: false, error: "Job not found.", jobId, route: "/api/jobs/:jobId" });
  }

  let job;
  try {
    job = JSON.parse(raw);
  } catch {
    return json(500, { ok: false, error: "Stored job is corrupt JSON.", jobId, route: "/api/jobs/:jobId" });
  }

  const pdfUrl = "/api/jobs/get?id=" + encodeURIComponent(jobId) + "&asset=pdf";

  return json(200, {
    ok: true,
    jobId,
    flow: job.flow,
    form: job.form,
    createdAt: job.createdAt,
    rendererId: job.rendererId,
    templateId: job.templateId,
    pdfUrl
  });
}
