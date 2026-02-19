import { PDFDocument } from "pdf-lib";

/**
 * Pages Function
 * POST /pdf/fill?form=FL-300
 *
 * Requires R2 bindings on the Pages project:
 * - env.FORMS (bucket: forms)
 * - env.MAPS  (bucket: maps)
 *
 * Request body:
 * { "packet": { ... }, "data": { ...optional... } }
 *
 * We use packet as the canonical source. "data" is optional and ignored unless you later want overrides.
 */

function bad(msg, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: msg }, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

function get(obj, dotPath) {
  return dotPath.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

async function mustJson(req) {
  try {
    return await req.json();
  } catch {
    throw new Error("Invalid JSON body.");
  }
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

function assertRegistryGuards(registry) {
  const rules = registry?.rules || {};
  if (rules.requireCountyMatch !== true) throw new Error("Registry rules.requireCountyMatch must be true.");
  if (rules.denyCrossState !== true) throw new Error("Registry rules.denyCrossState must be true.");
  if (rules.denyCrossCounty !== true) throw new Error("Registry rules.denyCrossCounty must be true.");
}

function resolveCountyFormKey(registry, state, county, formId) {
  assertRegistryGuards(registry);

  const entry = (registry.entries || []).find(
    (e) => normalize(e.state) === normalize(state) && normalize(e.county) === normalize(county)
  );
  if (!entry) throw new Error(`No registry entry for ${state}/${county}.`);

  const form = (entry.forms || []).find(
    (f) => String(f.formId).toUpperCase() === String(formId).toUpperCase()
  );
  if (!form?.r2Key) throw new Error(`No ${formId} configured for ${state}/${county}.`);

  // Hard county guarantee: key must live under state/county prefix.
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
  if (!formId) return bad("Missing ?form=FL-300 (example).");

  // Lock down supported forms (expand as you add maps)
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

  const state = normalize(packet?.jurisdiction?.state || "");
  const county = normalize(packet?.jurisdiction?.county || "");
  if (!state || !county) return bad("Packet missing jurisdiction.state or jurisdiction.county.");

  try {
    // Registry location in FORMS bucket
    const registry = await r2MustGetJson(env.FORMS, "assets/forms/forms.registry.json");

    const pdfKey = resolveCountyFormKey(registry, state, county, formId);

    // Map location in MAPS bucket (versioned keys)
    const mapKey =
      formId === "FL-300" ? "maps/fl300.map.v1.json" :
      formId === "FL-305" ? "maps/fl305.map.v1.json" :
      null;

    if (!mapKey) throw new Error(`No map key configured for ${formId}.`);

    const [pdfBytes, map] = await Promise.all([
      r2MustGetBytes(env.FORMS, pdfKey),
      r2MustGetJson(env.MAPS, mapKey)
    ]);

    // Canonical mapping data object
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

    // Return a real PDF so mobile can open/download normally
    const filename = `${formId}.${state}.${county}.filled.pdf`;
    return new Response(filled, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store"
      }
    });
  } catch (e) {
    return bad(e?.message || "Worker error.", 500);
  }
}
