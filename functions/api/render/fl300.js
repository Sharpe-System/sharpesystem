import { PDFDocument } from "pdf-lib";

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use POST.", route: "/api/render/fl300" }, null, 2),
      { status: 405, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  try {
    const url = new URL(request.url);
    const templateUrl =
      url.searchParams.get("template") ||
      "https://sharpesystem.pages.dev/templates/jcc/fl300/FL-300.pdf";

    const res = await fetch(templateUrl);
    if (!res.ok) {
      return new Response(
        JSON.stringify(
          { ok: false, error: "Template fetch failed.", status: res.status, templateUrl, route: "/api/render/fl300" },
          null,
          2
        ),
        { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }

    const bytes = new Uint8Array(await res.arrayBuffer());

    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const out = await pdf.save();

    return new Response(out, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="FL-300.pdf"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify(
        { ok: false, error: "PDF render failed.", message: String(e?.message || e), route: "/api/render/fl300" },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
