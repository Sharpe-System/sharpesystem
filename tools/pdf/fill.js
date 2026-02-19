/* /tools/pdf/inspect-fields.js
   Usage:
     node tools/pdf/inspect-fields.js assets/forms/FL-300.pdf
     node tools/pdf/inspect-fields.js assets/forms/FL-305.pdf

   Output:
     - prints all AcroForm field names found in the PDF
     - prints field type hints where available
*/

const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

async function main() {
  const inPath = process.argv[2];
  if (!inPath) {
    console.error("Missing input PDF path.\nExample: node tools/pdf/inspect-fields.js assets/forms/FL-300.pdf");
    process.exit(1);
  }

  const abs = path.resolve(process.cwd(), inPath);
  if (!fs.existsSync(abs)) {
    console.error("PDF not found:", abs);
    process.exit(1);
  }

  const bytes = fs.readFileSync(abs);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();

  const fields = form.getFields();
  console.log("\nPDF:", inPath);
  console.log("Fields found:", fields.length);
  console.log("--------------------------------------------------");

  const rows = fields.map((f) => {
    const name = f.getName();
    const ctor = f.constructor && f.constructor.name ? f.constructor.name : "UnknownField";
    return { name, type: ctor };
  });

  // stable sorting for diff-friendly output
  rows.sort((a, b) => a.name.localeCompare(b.name));

  for (const r of rows) {
    console.log(`${r.type.padEnd(18)}  ${r.name}`);
  }

  console.log("--------------------------------------------------\n");
  console.log("Next step:");
  console.log("1) Copy these field names into a mapping JSON (see tools/pdf/maps/*.json).");
  console.log("2) Run: node tools/pdf/fill.js <pdf> <mapping> <data> <output>\n");
}

main().catch((err) => {
  console.error("inspect-fields failed:", err && err.stack ? err.stack : err);
  process.exit(1);
});/* /tools/pdf/fill.js
   Generic PDF filler using pdf-lib AcroForm fields.

   Usage:
     node tools/pdf/fill.js assets/forms/FL-300.pdf tools/pdf/maps/fl300.map.v1.json tools/pdf/samples/exparte.sample.json out/FL-300.filled.pdf

   Inputs:
     - PDF: official blank Judicial Council form (fillable)
     - MAP: mapping JSON describing how to write values into PDF fields
     - DATA: your SharpeSystem packet export JSON (you’ll generate this from your app next)
*/

const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");

function mustReadJson(p) {
  const abs = path.resolve(process.cwd(), p);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw);
}

function get(obj, dotPath) {
  if (!dotPath) return undefined;
  const parts = dotPath.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function asString(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function truthy(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y";
}

async function main() {
  const pdfPath = process.argv[2];
  const mapPath = process.argv[3];
  const dataPath = process.argv[4];
  const outPath = process.argv[5];

  if (!pdfPath || !mapPath || !dataPath || !outPath) {
    console.error(
      "Usage:\n  node tools/pdf/fill.js <pdf> <mapping.json> <data.json> <output.pdf>\n" +
      "Example:\n  node tools/pdf/fill.js assets/forms/FL-300.pdf tools/pdf/maps/fl300.map.v1.json tools/pdf/samples/exparte.sample.json out/FL-300.filled.pdf"
    );
    process.exit(1);
  }

  const pdfAbs = path.resolve(process.cwd(), pdfPath);
  if (!fs.existsSync(pdfAbs)) throw new Error(`PDF not found: ${pdfAbs}`);

  const map = mustReadJson(mapPath);
  const data = mustReadJson(dataPath);

  const bytes = fs.readFileSync(pdfAbs);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const form = pdf.getForm();
  const fields = form.getFields();
  const fieldSet = new Set(fields.map((f) => f.getName()));

  const actions = Array.isArray(map.actions) ? map.actions : [];
  const missingFields = [];
  const applied = [];

  for (const a of actions) {
    const target = a && a.target ? String(a.target) : "";
    const kind = a && a.kind ? String(a.kind) : "";
    const from = a && a.from ? String(a.from) : "";
    const value = a && Object.prototype.hasOwnProperty.call(a, "value") ? a.value : undefined;

    if (!target || !kind) continue;

    if (!fieldSet.has(target)) {
      missingFields.push(target);
      continue;
    }

    const v = from ? get(data, from) : value;

    try {
      if (kind === "text") {
        const f = form.getTextField(target);
        f.setText(asString(v));
      } else if (kind === "checkbox") {
        const f = form.getCheckBox(target);
        if (truthy(v)) f.check();
        else f.uncheck();
      } else if (kind === "dropdown") {
        const f = form.getDropdown(target);
        f.select(asString(v));
      } else if (kind === "radio") {
        // pdf-lib radio groups are usually treated as options on a single field name.
        // Map should provide the option string in v.
        const f = form.getRadioGroup(target);
        f.select(asString(v));
      } else {
        // ignore unknown
        continue;
      }
      applied.push({ target, kind, from: from || null });
    } catch (e) {
      throw new Error(`Failed to apply action to field "${target}" (${kind}): ${e.message || e}`);
    }
  }

  // Make appearance updates reliable
  try {
    form.updateFieldAppearances();
  } catch (_) {
    // safe ignore; some PDFs still render okay without it
  }

  // Flatten (optional) — many courts prefer non-editable final copies.
  if (map.flatten === true) {
    try {
      form.flatten();
    } catch (_) {}
  }

  const outAbs = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  const outBytes = await pdf.save();
  fs.writeFileSync(outAbs, outBytes);

  console.log("\nFilled PDF written:", outPath);
  console.log("Actions applied:", applied.length);
  if (missingFields.length) {
    console.log("\nWARNING: mapping referenced fields not found in this PDF:");
    [...new Set(missingFields)].sort().forEach((n) => console.log(" -", n));
    console.log("\nRun inspect to verify field names:");
    console.log("  npm run pdf:inspect --", pdfPath);
  }
  console.log("");
}

main().catch((err) => {
  console.error("fill failed:", err && err.stack ? err.stack : err);
  process.exit(1);
});
