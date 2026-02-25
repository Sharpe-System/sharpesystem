import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

function readJson(relPath) {
  const abs = path.join(repoRoot, relPath);
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw);
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function scanTemplateForms() {
  const base = path.join(repoRoot, "templates", "jcc");
  if (!fs.existsSync(base)) return [];

  const entries = fs.readdirSync(base, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const forms = [];
  for (const id of entries) {
    const src = `templates/jcc/${id}/src.pdf`;
    const tpl = `templates/jcc/${id}/tpl.pdf`;
    const hasSrc = exists(src);
    const hasTpl = exists(tpl);

    if (hasSrc && hasTpl) {
      forms.push({
        id,
        templateSrcPath: src,
        templateTplPath: tpl,
        fieldsPath: `templates/jcc/${id}/fields.json`,
        hasFields: exists(`templates/jcc/${id}/fields.json`)
      });
    }
  }
  return forms.sort((a, b) => a.id.localeCompare(b.id));
}

function main() {
  const registry = readJson("core/forms/forms.registry.v1.json");
  const regIds = new Set((registry.forms || []).map(f => f.id));

  const templateForms = scanTemplateForms();
  const registered = (registry.forms || []).map(f => f.id).sort();
  const unregistered = templateForms.filter(f => !regIds.has(f.id)).map(f => f.id).sort();

  console.log("REGISTERED FORMS (registry):");
  for (const id of registered) console.log(`  - ${id}`);

  console.log("\nTEMPLATES PRESENT (templates/jcc/* with src.pdf + tpl.pdf):");
  for (const f of templateForms) {
    console.log(`  - ${f.id}  (fields.json: ${f.hasFields ? "YES" : "NO"})`);
  }

  console.log("\nUNREGISTERED TEMPLATES (present on disk but not in registry):");
  if (unregistered.length === 0) {
    console.log("  (none)");
  } else {
    for (const id of unregistered) console.log(`  - ${id}`);
  }

  console.log("\nREGISTERED BUT TEMPLATE MISSING (should be none):");
  let anyMissing = false;
  for (const id of registered) {
    const src = `templates/jcc/${id}/src.pdf`;
    const tpl = `templates/jcc/${id}/tpl.pdf`;
    if (!exists(src) || !exists(tpl)) {
      anyMissing = true;
      console.log(`  - ${id} missing: ${!exists(src) ? "src.pdf " : ""}${!exists(tpl) ? "tpl.pdf" : ""}`.trim());
    }
  }
  if (!anyMissing) console.log("  (none)");

  console.log("\nNOTE:");
  console.log("  Registry is the single source of truth.");
  console.log("  Templates may exist in a STAGED state (staged=true) before renderer endpoints exist.");
  console.log("  Non-staged forms (staged=false) must have rendererEndpoint and a corresponding function implementation.");
}

main();
