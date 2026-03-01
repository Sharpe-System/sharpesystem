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

export async function onRequestPost({ request }) {
  try {
    const url = new URL(request.url);
    const form = (url.searchParams.get("form") || "").toLowerCase();

    if (!form) {
      return new Response(JSON.stringify({ error: "Missing form parameter" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    // Expect packet but not using yet
    await request.json().catch(() => null);

    const state = "ca";
    const county = "orange";

    const path = `/assets/forms/${state}/${county}/${form}.pdf`;

    const asset = await fetch(new URL(path, request.url));

    if (!asset.ok) {
      return new Response(JSON.stringify({ error: "Form asset not found" }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response(asset.body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${form.toUpperCase()}.pdf"`
      }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: "Worker error" }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
