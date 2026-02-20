// /functions/api/pdf/exparte.js
// Canon-safe stub for Pages Functions.
//
// Why:
// Cloudflare Pages Functions bundler is currently failing to resolve "pdf-lib".
// Until we add a proper worker/bundled dependency strategy, we keep deploys green
// and return a clear status to the client.
//
// Rules honored:
// - No secrets here
// - No user data storage here
// - No redirects
// - Explicit "not ready" response

export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: false,
      code: "PDF_EXPORT_DISABLED",
      message:
        "PDF export is temporarily disabled while the PDF engine is being deployed. Public flows still work. Try again soon.",
    }),
    {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}

export async function onRequestPost() {
  return new Response(
    JSON.stringify({
      ok: false,
      code: "PDF_EXPORT_DISABLED",
      message:
        "PDF export is temporarily disabled while the PDF engine is being deployed. Public flows still work. Try again soon.",
    }),
    {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}
