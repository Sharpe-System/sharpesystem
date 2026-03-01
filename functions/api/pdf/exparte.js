// functions/api/pdf/exparte.js
//
// GET  = registry preview (existing behavior)
// POST = generate a PDF for a specific form using packet JSON
//
// Canon intent:
// - One endpoint for ex parte PDF generation
// - Deterministic error messages (no silent 405)

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const state = (url.searchParams.get("state") || "ca").toLowerCase();
  const county = (url.searchParams.get("county") || "orange").toLowerCase();
  const forms = (url.searchParams.get("forms") || "fl300,fl305")
    .split(",")
    .map((f) => f.trim().toLowerCase());

  const items = forms.map((f) => ({
    formId: f.toUpperCase(),
    path: `/assets/forms/${state}/${county}/${f}.pdf`,
  }));

  return json({
    ok: true,
    packet: { state, county, items },
  });
}

export async function onRequestPost({ request }) {
  const url = new URL(request.url);
  const formRaw = (url.searchParams.get("form") || "FL-300").trim();
  const form = formRaw.toLowerCase().replace(/[^a-z0-9]/g, "");

  let body = null;
  try {
    body = await request.json();
  } catch (_) {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const packet = body?.packet || null;
  if (!packet || typeof packet !== "object") {
    return json({ ok: false, error: "Missing packet in request body." }, 400);
  }

  // Form routing
  // FL-300: use existing working renderer endpoint (returns PDF bytes)
  if (form === "fl300") {
    const fl300 = packet?.slices?.fl300 || {};
    const renderUrl = new URL("/api/render/fl300", request.url);

    return fetch(renderUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rfo: fl300 }),
    });
  }

  // FL-305 not wired yet here (deterministic error instead of 405)
  if (form === "fl305") {
    return json(
      {
        ok: false,
        error: "FL-305 generator not implemented in /api/pdf/exparte yet.",
        hint: "Implement FL-305 render path here (county-specific) the same way as FL-300.",
      },
      501
    );
  }

  return json(
    {
      ok: false,
      error: `Unknown form "${formRaw}".`,
      allowed: ["FL-300", "FL-305"],
    },
    400
  );
}
