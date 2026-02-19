/* tools/pdf/fill-from-registry.js
   Fill PDF using jurisdiction registry instead of direct file path

   Usage:
   node tools/pdf/fill-from-registry.js ca orange FL-300 tools/pdf/maps/fl300.map.v1.json tools/pdf/samples/exparte.sample.json out/FL-300.filled.pdf
*/

const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const { resolveForm } = require("./load-form");

function mustReadJson(p) {
  const abs = path.resolve(process.cwd(), p);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

function get(obj, dotPath) {
  return dotPath.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

async function main() {
  const state = process.argv[2];
  const county = process.argv[3];
  const formId = process.argv[4];
  const mapPath = process.argv[5];
  const dataPath = process.argv[6];
  const outPath = process.argv[7];

  if (!state || !formId || !mapPath || !dataPath || !outPath) {
    console.error(
      "Usage:\nnode tools/pdf/fill-from-registry.js <state> <county> <formId> <map.json> <data.json> <out.pdf>"
    );
    process.exit(1);
  }

  const pdfPath = resolveForm({ state, county, formId });

  const map = mustReadJson(mapPath);
  const data = mustReadJson(dataPath);

  const bytes = fs.readFileSync(pdfPath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();

  for (const a of map.actions) {
    const v = a.from ? get(data, a.from) : a.value;

    if (a.kind === "text") form.getTextField(a.target).setText(String(v || ""));
    if (a.kind === "checkbox")
      v ? form.getCheckBox(a.target).check() : form.getCheckBox(a.target).uncheck();
    if (a.kind === "dropdown")
      form.getDropdown(a.target).select(String(v || ""));
  }

  if (map.flatten) form.flatten();

  const outAbs = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, await pdf.save());

  console.log("Filled:", outPath);
}

main();
