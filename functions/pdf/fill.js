// functions/pdf/fill.js
// Canon-safe stub for PDF fill.
// - NO pdf-lib import (prevents Cloudflare Pages Functions build failure)
// - Preserves endpoint contract for the UI
// - Later: replace body with proxy to a Worker endpoint (Lane B)

export async function onRequestPost({ request }) {
  // Optional: read request safely without logging it
  // (Never log sensitive payloads)
  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch (_) {}

  return new Response(
    JSON.stringify(
      {
        ok: false,
        status: 501,
        code: "PDF_FILL_NOT_IMPLEMENTED",
        message:
          "PDF fill is not enabled on Pages Functions. This endpoint is reserved for a future Worker implementation.",
        hint:
          "Deploy a Worker endpoint (e.g. /api/pdf/fill) and change this function to proxy requests to it.",
      },
      null,
      2
    ),
    {
      status: 501,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}

export async function onRequestGet() {
  return new Response(
    JSON.stringify(
      {
        ok: false,
        status: 405,
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST /pdf/fill.",
      },
      null,
      2
    ),
    {
      status: 405,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}
