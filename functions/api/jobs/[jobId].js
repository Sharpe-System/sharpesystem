export async function onRequest(context) {
  const url = new URL(context.request.url);
  const m = url.pathname.match(/\/api\/jobs\/([^/]+)$/);
  const jobId = m ? decodeURIComponent(m[1]) : null;

  // Stub: job lookup always returns the placeholder pdfUrl.
  const pdfUrl = "/assets/sample.pdf";

  return new Response(
    JSON.stringify(
      {
        ok: true,
        jobId,
        status: "stub",
        pdfUrl,
        note: "This is a placeholder job record. Next step: persist jobs."
      },
      null,
      2
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}
