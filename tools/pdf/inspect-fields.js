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
});
