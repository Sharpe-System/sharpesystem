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

  try {
    const url = new URL(request.url);

    // Template lives in your Pages static assets
    const templateUrl = `${url.origin}/templates/jcc/fl300/FL-300.pdf`;

    const tplRes = await fetch(templateUrl);
    if (!tplRes.ok) throw new Error("Template fetch failed: " + tplRes.status);

    const bytes = new Uint8Array(await tplRes.arrayBuffer());

    // Some court PDFs are "encrypted" in a way pdf-lib flags; ignoreEncryption handles it.
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    const page = pdfDoc.getPages()[0];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Visible stamp so you can confirm you are hitting the deployed code
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
