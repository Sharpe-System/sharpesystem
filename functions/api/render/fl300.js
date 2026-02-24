export async function onRequest(context) {
  // v1: keep deploy green (no npm deps required)
  // Next step (after Pages runs npm ci): import pdf-lib and return a real PDF.
  return new Response(
    JSON.stringify(
      { ok: true, route: "/api/render/fl300", note: "Deploy green. Next: enable npm deps, then fill FL-300." },
      null,
      2
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}
