import { resolveForm, listForms } from "../../../core/forms/resolveForm.mjs";

export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);

    // If no id provided, return list for UI selection
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ ok: true, forms: listForms() }, null, 2), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" }
      });
    }

    const resolved = resolveForm(id);

    return new Response(JSON.stringify({ ok: true, form: resolved }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2), {
      status: 400,
      headers: { "content-type": "application/json", "cache-control": "no-store" }
    });
  }
}
