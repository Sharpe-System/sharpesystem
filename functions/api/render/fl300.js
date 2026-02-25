cat > functions/api/render/fl300.js <<'EOF'
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use POST." }, null, 2),
      { status: 405, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const url = new URL(request.url);
    const templateUrl = new URL("/templates/jcc/fl300/FL-300.pdf", url.origin).toString();

    const tplRes = await fetch(templateUrl);
    if (!tplRes.ok) {
      throw new Error("Template fetch failed");
    }

    const bytes = new Uint8Array(await tplRes.arrayBuffer());

    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    firstPage.drawText("TEST RENDER OK", {
      x: 50,
      y: 750,
      size: 18,
      font,
      color: rgb(1, 0, 0)
    });

    const out = await pdfDoc.save();

    return new Response(out, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "inline; filename
