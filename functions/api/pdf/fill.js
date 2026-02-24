export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }, null, 2), {
      status: 405,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }

  const jobId =
    (globalThis.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : ("job_" + Math.random().toString(16).slice(2));

  // Stub: always point to a known PDF artifact.
  const pdfUrl = "/assets/sample.pdf";

  return new Response(
    JSON.stringify(
      { ok: true, jobId, pdfUrl, status: "stub", note: "Next: persist job record + generate real PDF." },
      null,
      2
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}
