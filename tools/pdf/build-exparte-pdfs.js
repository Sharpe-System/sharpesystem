/* tools/pdf/build-exparte-pdfs.js
   Build Ex Parte PDFs from a single packet JSON.

   Usage:
     node tools/pdf/build-exparte-pdfs.js out/ss-exparte-packet.json

   Output:
     out/exparte/FL-300.filled.pdf
     out/exparte/FL-305.filled.pdf
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

function mustReadBytes(p) {
  const abs = path.resolve(process.cwd(), p);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  return fs.readFileSync(abs);
}

function get(obj, dotPath) {
  return dotPath.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

async function fillPdfFromMap({ pdfPath, mapPath, data, outPath }) {
  const mapAbs = path.resolve(process.cwd(), mapPath);
  const map = mustReadJson(mapAbs);

  const bytes = mustReadBytes(pdfPath);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = pdf.getForm();

  if (!Array.isArray(map.actions)) {
    throw new Error(`Invalid map.actions in: ${mapPath}`);
  }

  for (const a of map.actions) {
    const v = a.from ? get(data, a.from) : a.value;

    if (a.kind === "text") {
      form.getTextField(a.target).setText(String(v ?? ""));
    } else if (a.kind === "checkbox") {
      const cb = form.getCheckBox(a.target);
      (v ? cb.check() : cb.uncheck());
    } else if (a.kind === "dropdown") {
      form.getDropdown(a.target).select(String(v ?? ""));
    } else {
      throw new Error(`Unknown action kind "${a.kind}" in ${mapPath}`);
    }
  }

  if (map.flatten) form.flatten();

  const outAbs = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, await pdf.save());
  return outPath;
}

function buildMappingData(packet) {
  // Single source-of-truth: your packet JSON.
  // Maps should reference fields using dotpaths from this "data" object.
  return {
    packet,
    // convenience aliases:
    intake: packet?.slices?.intake || {},
    fl300: packet?.slices?.fl300 || {},
    fl305: packet?.slices?.fl305 || {},
    notice: packet?.slices?.notice || {},
    decl: packet?.slices?.decl || {},
    proposed: packet?.slices?.proposed || {},
    attachments: packet?.attachments || {}
  };
}

async function main() {
  const packetPath = process.argv[2];
  if (!packetPath) {
    console.error("Usage:\nnode tools/pdf/build-exparte-pdfs.js <packet.json>");
    process.exit(1);
  }

  const packet = mustReadJson(packetPath);

  const state = packet?.jurisdiction?.state || "ca";
  const county = packet?.jurisdiction?.county || "orange";

  // NOTE: These map files must exist. Keep stable names; version them.
  const mapFL300 = "tools/pdf/maps/fl300.map.v1.json";
  const mapFL305 = "tools/pdf/maps/fl305.map.v1.json";

  const outDir = "out/exparte";
  const outFL300 = `${outDir}/FL-300.filled.pdf`;
  const outFL305 = `${outDir}/FL-305.filled.pdf`;

  const pdfFL300 = resolveForm({ state, county, formId: "FL-300" });
  const pdfFL305 = resolveForm({ state, county, formId: "FL-305" });

  const data = buildMappingData(packet);

  console.log("Jurisdiction:", state, county);
  console.log("Using PDFs:", pdfFL300, "and", pdfFL305);
  console.log("Using maps:", mapFL300, "and", mapFL305);

  await fillPdfFromMap({
    pdfPath: pdfFL300,
    mapPath: mapFL300,
    data,
    outPath: outFL300
  });

  await fillPdfFromMap({
    pdfPath: pdfFL305,
    mapPath: mapFL305,
    data,
    outPath: outFL305
  });

  console.log("Wrote:");
  console.log(" -", outFL300);
  console.log(" -", outFL305);

  // If overflow triggered, remind about pleading paper attachment
  const overflow = packet?.slices?.decl?.overflow;
  if (overflow?.triggered) {
    console.log("NOTE: Overflow triggered. Attach pleading paper (generated separately via /rfo/pleading-paper.html).");
  }
}

main().catch((e) => {
  console.error("ERROR:", e && e.message ? e.message : e);
  process.exit(1);
});
