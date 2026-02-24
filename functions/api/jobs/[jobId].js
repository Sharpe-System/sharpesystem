export async function onRequest(context) {
  const jobId = context.params.jobId;

  // v1 stub: no persistence yet — just prove the contract.
  // Next step: read from Firestore/R2 via job metadata.
  const job = {
    ok: true,
    jobId,
    status: "stub",
    note: "This is a placeholder job record. Next step: persist jobs.",
    createdAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(job, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
