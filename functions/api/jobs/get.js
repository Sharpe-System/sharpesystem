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
      route: "/api/jobs/get"
    });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  const asset = (url.searchParams.get("asset") || "").toLowerCase();

  if (!id) {
    return json(400, { ok: false, error: "Missing id.", route: "/api/jobs/get" });
  }

  const key = "job:" + id;
  const raw = await kv.get(key);

  if (!raw) {
    return json(404, { ok: false, error: "Job not found.", id, route: "/api/jobs/get" });
  }

  let job;
  try {
    job = JSON.parse(raw);
  } catch (e) {
    return json(500, { ok: false, error: "Stored job is corrupt JSON.", id, route: "/api/jobs/get" });
  }

  // Serve PDF bytes if requested.
  if (asset === "pdf") {
    const b64 = job?.pdf?.base64 || "";
    if (!b64) {
      return json(500, { ok: false, error: "Job missing pdf bytes.", id, route: "/api/jobs/get" });
    }
    const bytes = Buffer.from(b64, "base64");
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="FL-300.pdf"',
        "cache-control": "no-store"
      }
    });
  }

  // Full immutable job object.
  return json(200, job);
}
