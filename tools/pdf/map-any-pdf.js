import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PDFDocument, StandardFonts } from "pdf-lib";

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function usage() {
  console.error("usage:");
  console.error("  node tools/pdf/map-any-pdf.js inspect <file.pdf>");
  console.error("  node tools/pdf/map-any-pdf.js apply <file.pdf> <map.json> <data.json> <out.pdf>");
  process.exit(1);
}

async function inspect(pdfPath) {
  const bytes = fs.readFileSync(pdfPath);
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });

  const pages = doc.getPages().map((p, i) => {
    const { width, height } = p.getSize();
    return { page: i, width, height };
  });

  let fields = [];
  try {
    const form = doc.getForm();
    fields = form.getFields().map(f => ({ name: f.getName(), type: f.constructor.name }));
  } catch {}

  return {
    pdf: {
      file: pdfPath,
      sha256: sha256(bytes),
      pageCount: doc.getPageCount(),
      pages
    },
    fields
  };
}

function getByPath(obj, dotted) {
  if (!dotted) return undefined;
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

async function apply(pdfPath, mapPath, dataPath, outPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);

  if (map?.pdf?.sha256 && map.pdf.sha256 !== sha256(pdfBytes)) {
    throw new Error("map/pdf fingerprint mismatch (sha256). Refusing to render.");
  }

  for (const t of map.targets || []) {
    const mode = String(t.mode || "");
    if (mode !== "coords") continue;

    const pageIndex = Number(t.page);
    const page = doc.getPage(pageIndex);
    if (!page) throw new Error(`bad page index: ${t.page}`);

    const rect = t.rect;
    if (!Array.isArray(rect) || rect.length !== 4) throw new Error(`bad rect for ${t.id || "(no id)"}`);

    const [x, y, w, h] = rect.map(Number);

    const val = t.source ? getByPath(data, t.source) : undefined;

    if (t.type === "text") {
      const s = val == null ? "" : String(val);
      const size = Number(t.font?.size || 10);
      page.drawText(s, { x, y, size, font, maxWidth: w, lineHeight: Number(t.font?.lineHeight || (size + 2)) });
    } else if (t.type === "check") {
      const truthy = t.truthy === undefined ? true : t.truthy;
      const on = (val === truthy) || (truthy === true && !!val);
      if (on) {
        const size = Math.min(w, h);
        page.drawText("X", { x: x + 1, y: y + 1, size: Math.max(8, size), font });
      }
    } else {
      throw new Error(`unsupported coords type: ${t.type}`);
    }
  }

  const out = await doc.save();
  fs.writeFileSync(outPath, out);
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd) usage();

  if (cmd === "inspect") {
    const pdf = process.argv[3];
    if (!pdf) usage();
    const info = await inspect(pdf);
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (cmd === "apply") {
    const pdf = process.argv[3];
    const mapPath = process.argv[4];
    const dataPath = process.argv[5];
    const outPath = process.argv[6];
    if (!pdf || !mapPath || !dataPath || !outPath) usage();
    await apply(pdf, mapPath, dataPath, outPath);
    console.log(JSON.stringify({ ok: true, out: outPath }, null, 2));
    return;
  }

  usage();
}

main().catch(e => {
  console.error(String(e?.stack || e));
  process.exit(1);
});
