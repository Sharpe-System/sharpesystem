// functions/api/render/fl300.js
import { PDFDocument, StandardFonts } from "pdf-lib";

export async function onRequest(context) {
  const { request } = context;

  // Health check (optional)
  if (request.method === "GET") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use POST.", route: "/api/render/fl300" }, null, 2),
      { status: 405, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed. Use POST.", route: "/api/render/fl300" }, null, 2),
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

  const rfo = body?.rfo || {};
  const county = String(rfo.county || "").trim();
  const branch = String(rfo.branch || "").trim();
  const caseNumber = String(rfo.caseNumber || "").trim();
  const requestDetails = String(rfo.requestDetails || "").trim();
  const reqCustody = !!rfo.reqCustody;
  const reqSupport = !!rfo.reqSupport;
  const reqOther = !!rfo.reqOther;

  // v1: Return a VALID PDF every time (proves binary pipeline + headers)
  // Next step: load the official FL-300 template and overlay/fill fields.
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // US Letter, points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const lines = [
    "SharpeSystem — FL-300 Render (v1)",
    "",
    `County: ${county || "—"}`,
    `Branch: ${branch || "—"}`,
    `Case #: ${caseNumber || "—"}`,
    "",
    `Requests: Custody=${reqCustody ? "Yes" : "No"} | Support=${reqSupport ? "Yes" : "No"} | Other=${reqOther ? "Yes" : "No"}`,
    "",
    "Requested orders:",
    requestDetails || "—"
  ];

  let y = 740;
  for (const line of lines) {
    const text = String(line);
    page.drawText(text, {
      x: 48,
      y,
      size: 12,
      font
    });
    y -= 18;
    if (y < 48) break;
  }

  const pdfBytes = await pdfDoc.save();
  const filename = "fl300.pdf";

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "no-store"
    }
  });
}
