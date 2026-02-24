export async function onRequest(context) {
  // v1 stub:
  // Later: read auth/profile and return entitlement flags.
  // For now: always false to drive upgrade CTA in review.
  return new Response(
    JSON.stringify({ ok: true, entitled: false, tier: "none" }, null, 2),
    { headers: { "content-type": "application/json; charset=utf-8" } }
  );
}
