export async function onRequest() {
  return new Response(
    JSON.stringify(
      { ok: true, route: "/api/render/fl300", note: "Endpoint live. Next: fill FL-300." },
      null,
      2
    ),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}
