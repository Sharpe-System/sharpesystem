// functions/api/pdf/exparte.js
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const state = (url.searchParams.get("state") || "ca").toLowerCase();
  const county = (url.searchParams.get("county") || "orange").toLowerCase();
  const forms = (url.searchParams.get("forms") || "fl300,fl305")
    .split(",")
    .map(f => f.trim().toLowerCase());

  const items = forms.map(f => ({
    formId: f.toUpperCase(),
    path: `/assets/forms/${state}/${county}/${f}.pdf`
  }));

  return new Response(JSON.stringify({
    ok: true,
    packet: { state, county, items }
  }, null, 2), {
    headers: { "content-type": "application/json" }
  });
}
