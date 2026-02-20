// functions/pdf/fill.js
// Pages Function (Lane A safe).
// No npm deps allowed here. Do NOT import pdf-lib.
// This unblocks Cloudflare Pages builds.
// Later: proxy to Worker by setting PDF_WORKER_URL.

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestPost(context) {
  const workerUrl = context.env?.PDF_WORKER_URL;

  if (!workerUrl) {
    return json(501, {
      ok: false,
      error: "PDF_FILL_DISABLED",
      message:
        "PDF fill is disabled in Pages. Deploy a Worker PDF service and set PDF_WORKER_URL.",
    });
  }

  const req = context.request;
  const body = await req.arrayBuffer();

  const res = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      authorization: req.headers.get("authorization") || "",
    },
    body,
  });

  const outHeaders = new Headers(res.headers);
  outHeaders.set("cache-control", "no-store");

  return new Response(res.body, { status: res.status, headers: outHeaders });
}
