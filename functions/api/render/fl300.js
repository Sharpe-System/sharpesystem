// functions/api/render/fl300.js
import { PDFDocument, StandardFonts } from "pdf-lib";

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: "Method not allowed. Use POST.",
          route: "/api/render/fl300",
        },
        null,
        2
      ),
      { status: 405, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch (_) {
    payload = {};
  }

  const url = new URL(request.url);
  const templateUrl = new URL("/templates/jcc/fl300/FL-300.pdf", url);

  const tplRes = await fetch(templateUrl.toString(), { method: "GET" });
  if (!tplRes.ok) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: "Failed to fetch template PDF",
          status: tplRes.status,
          templateUrl: templateUrl.toString(),
        },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const tplBytes = new Uint8Array(await tplRes.arrayBuffer());

  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(tplBytes, { ignoreEncryption: true });
  } catch (e) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: "PDFDocument.load failed",
          message: String(e?.message || e),
        },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const rfo = payload?.rfo || {};
  const fields = {
    county: String(rfo.county || "").trim(),
    branch: String(rfo.branch || "").trim(),
    caseNumber: String(rfo.caseNumber || "").trim(),
    role: String(rfo.role || "").trim(),
    reqCustody: !!rfo.reqCustody,
    reqSupport: !!rfo.reqSupport,
    reqOther: !!rfo.reqOther,
    requestDetails: String(rfo.requestDetails || "").trim(),
  };

  const debug = { ok: true, route: "/api/render/fl300", filled: {}, missing: [] };

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9 ]+/g, "")
      .trim();
  }

  function pickFieldByKeywords(all, keywords) {
    const keys = keywords.map(norm);
    for (const f of all) {
      const n = norm(f.getName());
      if (keys.every((k) => n.includes(k))) return f;
    }
    return null;
  }

  function safeSetText(form, candidates, value) {
    if (!value) return false;
    const all = form.getFields();
    for (const cand of candidates) {
      const f = pickFieldByKeywords(all, cand);
      if (!f) continue;

      try {
        const tf = form.getTextField(f.getName());
        tf.setText(value);
        tf.updateAppearances(helv);
        debug.filled[f.getName()] = value;
        return true;
      } catch (_) {
        continue;
      }
    }
    return false;
  }

  function safeSetCheck(form, candidates, checked) {
    const all = form.getFields();
    for (const cand of candidates) {
      const f = pickFieldByKeywords(all, cand);
      if (!f) continue;

      try {
        const cb = form.getCheckBox(f.getName());
        if (checked) cb.check();
        else cb.uncheck();
        debug.filled[f.getName()] = checked ? "checked" : "unchecked";
        return true;
      } catch (_) {
        continue;
      }
    }
    return false;
  }

  try {
    const form = pdfDoc.getForm();

    safeSetText(
      form,
      [
        ["county"],
        ["court", "county"],
        ["superior", "court", "county"],
      ],
      fields.county
    ) || debug.missing.push("county");

    safeSetText(
      form,
      [
        ["branch"],
        ["courthouse"],
        ["branch", "name"],
      ],
      fields.branch
    ) || debug.missing.push("branch");

    safeSetText(
      form,
      [
        ["case", "number"],
        ["case", "no"],
        ["case"],
      ],
      fields.caseNumber
    ) || debug.missing.push("caseNumber");

    safeSetCheck(
      form,
      [
        ["custody"],
        ["visitation"],
        ["parenting", "time"],
      ],
      fields.reqCustody
    ) || debug.missing.push("reqCustody");

    safeSetCheck(
      form,
      [
        ["support"],
        ["child", "support"],
      ],
      fields.reqSupport
    ) || debug.missing.push("reqSupport");

    safeSetCheck(
      form,
      [
        ["other"],
      ],
      fields.reqOther
    ) || debug.missing.push("reqOther");

    safeSetText(
      form,
      [
        ["details"],
        ["requested", "orders"],
        ["orders", "requested"],
        ["facts"],
        ["supporting", "facts"],
      ],
      fields.requestDetails
    ) || debug.missing.push("requestDetails");

    try {
      form.updateFieldAppearances(helv);
    } catch (_) {}

    try {
      form.flatten();
    } catch (_) {}
  } catch (e) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: "PDF form fill failed",
          message: String(e?.message || e),
          debug,
        },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  let outBytes;
  try {
    outBytes = await pdfDoc.save({ useObjectStreams: false });
  } catch (e) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: "PDF save failed",
          message: String(e?.message || e),
          debug,
        },
        null,
        2
      ),
      { status: 500, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }

  return new Response(outBytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="FL-300-filled.pdf"',
      "cache-control": "no-store",
      "x-sharpesystem-debug": encodeURIComponent(JSON.stringify(debug)),
    },
  });
}
