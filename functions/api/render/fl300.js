import { PDFDocument } from "pdf-lib";

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify(
        { ok: false, error: "Method not allowed. Use POST.", route: "/api/render/fl300" },
        null,
        2
      ),
      { status: 405, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  let body = null;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body.", route: "/api/render/fl300" }, null, 2),
      { status: 400, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  try {
    const templatePath = "/templates/jcc/fl300/FL-300.pdf";
    const templateUrl = new URL(templatePath, request.url);

    const tplRes = await fetch(templateUrl.toString(), { headers: { accept: "application/pdf" } });
    if (!tplRes.ok) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            error: "Template fetch failed.",
            route: "/api/render/fl300",
            templatePath,
            status: tplRes.status
          },
          null,
          2
        ),
        { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }

    const tplBytes = await tplRes.arrayBuffer();

    const pdfDoc = await PDFDocument.load(tplBytes, { ignoreEncryption: true });

    const outBytes = await pdfDoc.save();

    return new Response(outBytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="FL-300-filled.pdf"',
        "cache-control": "no-store"
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: "PDF render failed.",
          message: String(err?.message || err),
          route: "/api/render/fl300"
        },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
