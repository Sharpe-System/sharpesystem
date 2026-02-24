export async function onRequest(context) {
  const url = new URL(context.request.url);
  const m = url.pathname.match(/\/api\/jobs\/([^/]+)$/);
  const jobId = m ? decodeURIComponent(m[1]) : null;

  // v1 stub: job lookup always returns a print-render URL (Path B).
  // This is the "perfect print" artifact.
  const renderUrl = "/rfo/fl300-print.html?flow=rfo&job=" + encodeURIComponent(jobId || "");

  // Keep pdfUrl around for now as a fallback (Path A / legacy).
  const pdfUrl = "/assets/sample.pdf";

  return new Response(
    JSON.stringify(
      {
        ok: true,
        jobId,
        status: "stub",
        renderUrl,
        pdfUrl,
        note: "renderUrl is the primary artifact (print-perfect). pdfUrl is fallback."
      },
      null,
      2
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}
