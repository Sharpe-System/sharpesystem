cat > functions/api/render/fl300.js <<'EOF'
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use POST." }, null, 2),
      { status: 405, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  try {
    const url = new URL(request.url);
    const templateUrl = new URL("/templates/jcc/fl300/FL-300.pdf", url.origin).toString();

    const tplRes = await fetch(templateUrl);
    if (!tplRes.ok) throw new Error("Template fetch failed: " + tplRes.status);

    const bytes = new Uint8Array(await tplRes.arrayBuffer());
    const pdfDoc = await PDFDocument.load(bytes);

    const page = pdfDoc.getPages()[0];
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    page.drawText("TEST RENDER OK", {
      x: 50,
      y: 750,
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
      JSON.stringify({ ok: false, error: "Render failed", message: String(e?.message || e) }, null, 2),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
EOF

git add functions/api/render/fl300.js
git commit -m "Fix fl300.js syntax + add stamp test"
git pull --rebase origin main
git push
