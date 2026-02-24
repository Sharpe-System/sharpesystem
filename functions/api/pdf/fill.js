export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { "content-type": "application/json" }
    });
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch (_) {}

  const jobId = crypto.randomUUID();

  // For now, fake job storage via response only.
  // Next step: real job persistence.
  return new Response(JSON.stringify({
    ok: true,
    jobId,
    received: body
  }), {
    headers: { "content-type": "application/json" }
  });
}
