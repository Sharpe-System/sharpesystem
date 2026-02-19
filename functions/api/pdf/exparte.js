import { PDFDocument } from "pdf-lib";

/**
 * Pages Function: POST /api/pdf/exparte?form=FL-300
 *
 * R2 bindings required:
 * - env.SS_FORMS (bucket: forms + registry)
 * - env.SS_MAPS  (bucket: map json)
 *
 * Body:
 * { "packet": { ...ss_rfo_exparte_packet_v1... } }
 */

function bad(msg, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, error: msg }, null, 2),
    { status, headers: { "content-type": "application/json; charset=utf-8" } }
  );
}

async function mustJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function get(obj, dotPath) {
  return dotPath.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

async function r2MustGetBytes(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) throw new Error(`R2 missing: ${key}`);
  return await obj.arrayBuffer();
}

async function r2MustGetJson(bucket, key) {
  const obj = await bucket.get(key);
  if (!obj) throw new Error(`R2 missing: ${key}`);
  return await obj.json();
}

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

function assertRegistryGuards(registry, state, county) {
  const rules = registry?.rules || {};
  if (rules.denyCrossState !== true) {
    throw new Error("Registry misconfigured: rules.denyCrossState must be true.");
  }
  if (rules.denyCrossCounty !== true) {
    throw new Error("Registry misconfigured: rules.denyCrossCounty must be true.");
  }
  if (rules.requireCountyMatch !== true) {
    throw new Error("Registry misconfigured: rules.requireCountyMatch must be true.");
  }
  if (!state || !county) {
    throw new Error("Missing jurisdiction state/county.");
  }
}

function resolveCountyFormKey(registry, state, county, formId) {
  assertRegistryGuards(registry, state, county);

  const entry = (registry.entries || []).find(
    (e) => normalize(e.state) === normalize(state) && normalize(e.county) === normalize(county)
  );

  if (!entry) {
    throw new Error(`No registry entry for ${state}/${county}. Add forms to forms.registry.json and upload PDFs to R2.`);
  }

  const form = (entry.forms || []).find((f) => String(f.formId).toUpperCase() === String(formId).toUpperCase());
  if (!form?.r2Key) {
    throw new Error(`No ${formId} configured for ${state}/${county}. Add it to registry and upload the PDF.`);
  }

  // County-specific guarantee: do not allow paths that aren't under the county prefix.
  const expectedPrefix = `${normalize(state)}/${normalize(county)}/`;
  if (!String(form.r2Key).toLowerCase().startsWith(expectedPrefix)) {
    throw new Error(`Registry violation: ${formId} r2Key must start with ${expectedPrefix}`);
  }

  return form.r2Key;
}

async function fillPdfFromMap(pdfBytes, map, data) {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdf.getForm();

  const actions = Array.isArray(map.actions) ? map.actions : [];
  for (const a of actions) {
    const v = a.from ? get(data, a.from) : a.value;

    if (a.kind === "text") {
      form.getTextField(a.target).setText(String(v ?? ""));
    } else if (a.kind === "checkbox") {
      const cb = form.getCheckBox(a.target);
      v ? cb.check() : cb.uncheck();
    } else if (a.kind === "dropdown") {
      form.getDropdown(a.target).select(String(v ?? ""));
    } else {
      throw new Error(`Unknown map action kind: ${a.kind}`);
    }
  }

  if (map.flatten) form.flatten();
  return await pdf.save();
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const formId = (url.searchParams.get("form") || "").toUpperCase();

  if (!formId) return bad("Missing ?form=FL-300 (or FL-305).");

  // Only allow the forms you intentionally support
  const allowed = new Set(["FL-300", "FL-305"]);
  if (!allowed.has(formId)) return bad(`Unsupported form "${formId}".`);

  let body;
  try {
    body = await mustJson(request);
  } catch (e) {
    return bad(e.message);
  }

  const packet = body?.packet;
  if (!packet) return bad("Missing 'packet' in request body.");
  if (packet.schema !== "ss_rfo_exparte_packet_v1") return bad("Invalid packet schema.");

  const state = normalize(packet?.jurisdiction?.state || "");
  const county = normalize(packet?.jurisdiction?.county || "");
  if (!state || !county) return bad("Packet missing jurisdiction.state or jurisdiction.county.");

  // Guard: ensure packet jurisdiction matches itself (and isn't blank)
  // (Cross-state/county denial is handled by registry resolution.)
  try {
    const registry = await r2MustGetJson(env.SS_FORMS, "assets/forms/forms.registry.json");

    const pdfKey = resolveCountyFormKey(registry, state, county, formId);

    // maps are versioned; keep stable names in R2
    const mapKey = formId === "FL-300" ? "maps/fl300.map.v1.json" : "maps/fl305.map.v1.json";

    const [pdfBytes, map] = await Promise.all([
      r2MustGetBytes(env.SS_FORMS, pdfKey),
      r2MustGetJson(env.SS_MAPS, mapKey)
    ]);

    // Build mapping data object for dotpaths
    const data = {
      packet,
      intake: packet?.slices?.intake || {},
      fl300: packet?.slices?.fl300 || {},
      fl305: packet?.slices?.fl305 || {},
      notice: packet?.slices?.notice || {},
      decl: packet?.slices?.decl || {},
      proposed: packet?.slices?.proposed || {},
      attachments: packet?.attachments || {}
    };

    const filled = await fillPdfFromMap(pdfBytes, map, data);

    // Return a real PDF response so mobile “just downloads/opens”
    const filename = `${formId}.${state}.${county}.filled.pdf`;

    return new Response(filled, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        // prevents caching sensitive PDFs
        "cache-control": "no-store"
      }
    });
  } catch (e) {
    return bad(e?.message || "Worker error.", 500);
  }
}
