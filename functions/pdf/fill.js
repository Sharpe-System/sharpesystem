// functions/pdf/fill.js
// Pages Function (Lane A safe).
// Canon vNext: PDF fill is a SERVICE (Lane B Worker), not a Pages Function with npm deps.
// This file intentionally contains NO imports (no pdf-lib) so Pages deploy cannot break.
//
// Behavior:
// - If you later deploy a Worker PDF service, set PDF_WORKER_URL and this becomes a proxy.
// - If not set, returns 501 with a clear message.
//
// Optional env var (Cloudflare Pages -> Settings -> Environment variables):
//   PDF_WORKER_URL = https://<your-worker-subdomain>/api/pdf/fill

export async function onRequestPost(context) {
  const workerUrl = context.env?.PDF_WORKER_URL;

  if (!workerUrl) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "PDF_FILL_DISABLED",
        message:
          "PDF fill service is not enabled yet. Deploy the Worker PDF service and set PDF_WORKER_URL.",
      }),
      { status: 501, headers: { "content-type": "application/json" } }
    );
  }

  // Proxy request body through to the Worker
  const req = context.request;
  const body = await req.arrayBuffer();

  const res = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      // Forward auth header if you use it later
      authorization: req.headers.get("authorization") || "",
    },
    body,
  });

  // Pass-through response (PDF bytes or JSON error)
  const outHeaders = new Headers(res.headers);
  // Ensure no caching of sensitive content
  outHeaders.set("cache-control", "no-store");

  return new Response(res.body, { status: res.status, headers: outHeaders });
}
