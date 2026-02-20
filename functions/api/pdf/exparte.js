// /functions/api/pdf/exparte.js
// TEMP STUB (canon-safe): keeps Pages deploy green.
// Paid-side PDF generation will be implemented later (Worker/DO or server-side) without breaking Pages builds.

export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      ok: false,
      code: "NOT_IMPLEMENTED",
      message:
        "PDF generation is not enabled on public Pages Functions yet. Use the public print gate for now.",
    }),
    {
      status: 501,
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
      code: "NOT_IMPLEMENTED",
      message:
        "PDF generation is not enabled on public Pages Functions yet. Use the public print gate for now.",
    }),
    {
      status: 501,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}
