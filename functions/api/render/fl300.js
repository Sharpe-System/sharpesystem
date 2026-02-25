// functions/api/render/fl300.js
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * POST /api/render/fl300
 * Body: { rfo: { county, branch, caseNumber, requestDetails, ... } }
 *
 * v1 vertical slice:
 * - Loads the official FL-300 template PDF from /templates/jcc/fl300/FL-300.pdf
 * - Fills 6–10 text fields deterministically (proof of pipeline)
 * - Flattens and returns PDF bytes
 *
 * NOTE: We are NOT trying to be “correct field mapping” yet.
 * This is: prove that the official court PDF can be loaded + written + returned.
 */
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

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON body.", route: "/api/render/fl300" }, null, 2),
      { status: 400, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const rfo = body?.rfo || {};

  // Values we want to visibly stamp into the PDF (proof-of-life).
  const values = [
    `County: ${String(rfo.county || "Orange")}`,
    `Branch: ${String(rfo.branch || "Lamoreaux")}`,
    `Case #: ${String(rfo.caseNumber || "TEST-1234")}`,
    `Role: ${String(rfo.role || "respondent")}`,
    `Custody: ${rfo.reqCustody ? "Yes" : "No"}`,
    `Support: ${rfo.reqSupport ? "Yes" : "No"}`,
    `Other: ${rfo.reqOther ? "Yes" : "No"}`,
    `Details: ${String(rfo.requestDetails || "Test details").slice(0, 140)}`
  ];

  // Fetch the OFFICIAL template PDF from your deployed static assets.
  // This avoids bundling the PDF into the function package.
  const templateUrl = new URL("/templates/jcc/fl300/FL-300.pdf", request.url);

  let templateBytes;
  try {
    const res = await fetch(templateUrl.toString(), { method: "GET" });
    if (!res.ok) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            error: "Template fetch failed.",
            templateUrl: templateUrl.toString(),
            status: res.status
          },
          null,
          2
        ),
        { status: 502, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }
    templateBytes = await res.arrayBuffer();
  } catch (err) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: "Template fetch error.",
          templateUrl: templateUrl.toString(),
          message: String(err?.message || err)
        },
        null,
        2
      ),
      { status: 502, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  try {
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    // Ensure we have a standard font available.
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Gather text fields deterministically (sorted by name).
    const fields = form.getFields();
    const textFields = [];

    for (const f of fields) {
      // pdf-lib text fields have setText(); other fields (checkbox, etc.) won’t.
      if (typeof f.setText === "function") textFields.push(f);
    }

    textFields.sort((a, b) => {
      const an = String(a.getName?.() || "");
      const bn = String(b.getName?.() || "");
      return an.localeCompare(bn);
    });

    // Fill 6–10 text fields (as requested).
    const N = Math.min(10, textFields.length, values.length);
    for (let i = 0; i < N; i++) {
      const tf = textFields[i];
      const v = values[i];

      tf.setText(v);

      // Make it look machine-filled: consistent font + size.
      // Not all pdf-lib versions expose updateAppearances the same way; guard it.
      if (typeof tf.updateAppearances === "function") {
        tf.updateAppearances(helv);
      }
    }

    // Optional: force black text by updating appearances at the form level where supported.
    // Guard for compatibility; not all environments expose the same helpers.
    if (typeof form.updateFieldAppearances === "function") {
      form.updateFieldAppearances(helv);
    }

    // Flatten so the output is print-stable (and not “editable fields”).
    form.flatten();

    const outBytes = await pdfDoc.save();

    return new Response(outBytes, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        // Inline makes browser preview easy; attachment triggers download.
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
          message: String(err?.message || err)
        },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
