export async function onRequest(context) {
  return new Response(JSON.stringify({
    ok: true,
    endpoint: "/api/drafts/:draftId",
    draftId: context.params.draftId,
    note: "stub"
  }, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
