export async function onRequest() {
  return new Response(JSON.stringify({
    ok: true,
    endpoint: "/api/pdf/fill",
    note: "stub"
  }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
