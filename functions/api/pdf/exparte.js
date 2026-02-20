// functions/api/pdf/exparte.js
// Canon intent: public-safe endpoint, no auth redirects, no pdf-lib dependency.
// This endpoint returns a deterministic "packet plan" (what to print/download),
// NOT a filled PDF. PDF filling happens client-side (future) or via Node tools.

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);

    // Query parameters
    const state = (url.searchParams.get("state") || "ca").toLowerCase();
    const county = (url.searchParams.get("county") || "orange").toLowerCase();

    // Optional: allow caller to specify desired forms, otherwise use defaults.
    // Ex parte CA family law common bundle:
    // FL-300, FL-305, notice/decl, proposed order are user-authored; the PDFs are FL forms.
    const want = (url.searchParams.get("forms") || "fl300,fl305").toLowerCase();
    const wantList = want.split(",").map(s => s.trim()).filter(Boolean);

    // R2 public path convention you started using:
    // assets/forms/{state}/{county}/{form}.pdf
    // NOTE: public access may be disabled; then these URLs are placeholders for later signed fetch.
    const base = "/assets/forms";

    const forms = [];
    for (const f of wantList) {
      const formId = f.replace(/[^a-z0-9]/g, "");
      const pdfPath = `${base}/${state}/${county}/${formId}.pdf`;
      forms.push({
        formId: formId.toUpperCase(),
        kind: "pdf",
        source: "r2",
        path: pdfPath
      });
    }

    const payload = {
      ok: true,
      packet: {
        type: "exparte",
        state,
        county,
        generatedAt: new Date().toISOString(),
        items: forms
      }
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}
