export async function onRequest(context) {
  return new Response(JSON.stringify({
    ok: true,
    endpoint: "/api/jobs/:jobId",
    jobId: context.params.jobId,
    note: "stub"
  }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
