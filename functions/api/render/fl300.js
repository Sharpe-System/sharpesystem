import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify(
        { ok: false, error: "Invalid JSON body.", message: String(e?.message || e), route: "/api/render/fl300" },
        null,
        2
      ),
      { status: 400, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const rfo = payload && typeof payload === "object" ? payload.rfo : null;
  if (!rfo || typeof rfo !== "object") {
    return new Response(
      JSON.stringify(
        { ok: false, error: "Missing required key: rfo", route: "/api/render/fl300" },
        null,
        2
      ),
      { status: 400, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  try {
    const url = new URL(request.url);

    const templateUrl = `${url.origin}/templates/jcc/fl300/tpl.pdf`;

    const tplRes = await fetch(templateUrl);
    if (!tplRes.ok) throw new Error("Template fetch failed: " + tplRes.status);

    const bytes = new Uint8Array(await tplRes.arrayBuffer());

    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const page = pdfDoc.getPages()[0];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText("TEST RENDER OK", {
      x: 72,
      y: 72,
      size: 18,
      font,
      color: rgb(1, 0, 0),
    });

    const out = await pdfDoc.save();

    return new Response(out, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "inline; filename=\"FL-300.pdf\"",
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
