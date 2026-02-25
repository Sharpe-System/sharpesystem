import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

function fail(msg) {
  console.error(`GATE FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

function readJson(relPath) {
  const abs = path.join(repoRoot, relPath);
  const raw = fs.readFileSync(abs, "utf8");
  return JSON.parse(raw);
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function scanTemplateIds() {
  const base = path.join(repoRoot, "templates", "jcc");
  if (!fs.existsSync(base)) return [];

  const dirs = fs.readdirSync(base, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const ids = [];
  for (const id of dirs) {
    const src = `templates/jcc/${id}/src.pdf`;
    const tpl = `templates/jcc/${id}/tpl.pdf`;
    if (exists(src) && exists(tpl)) ids.push(id);
  }
  return ids.sort();
}

function main() {
  const registry = readJson("core/forms/forms.registry.v1.json");
  if (!registry.forms || !Array.isArray(registry.forms)) fail("Registry forms missing or not array");

  const regIds = registry.forms.map(f => f.id).sort();
  const regIdSet = new Set(regIds);

  const templateIds = scanTemplateIds();
  const templateSet = new Set(templateIds);

  // RULE A: Every template present must be declared in registry
  for (const tid of templateIds) {
    if (!regIdSet.has(tid)) {
      fail(`Template present but not in registry: ${tid} (templates/jcc/${tid}/src.pdf + tpl.pdf)`);
    }
  }
  ok("All templates present are declared in registry");

  // RULE B: Registry must not reference templates that don't exist
  for (const f of registry.forms) {
    const src = `templates/jcc/${f.id}/src.pdf`;
    const tpl = `templates/jcc/${f.id}/tpl.pdf`;
    if (!exists(src)) fail(`Registry form ${f.id} missing ${src}`);
    if (!exists(tpl)) fail(`Registry form ${f.id} missing ${tpl}`);
  }
  ok("All registry forms have src.pdf + tpl.pdf");

  // RULE C: Non-staged forms must have rendererEndpoint AND function file when verify path present
  for (const f of registry.forms) {
    const staged = f.staged === true;

    if (!staged) {
      if (!f.rendererEndpoint) fail(`Non-staged form missing rendererEndpoint: ${f.id}`);
      if (typeof f.rendererEndpoint !== "string" || !f.rendererEndpoint.startsWith("/")) {
        fail(`Non-staged form rendererEndpoint invalid: ${f.id} (${f.rendererEndpoint})`);
      }
      if (f.verify && f.verify.rendererFunctionPath) {
        if (!exists(f.verify.rendererFunctionPath)) {
          fail(`Non-staged form renderer function missing: ${f.id} -> ${f.verify.rendererFunctionPath}`);
        }
      }
    } else {
      // staged form may omit rendererEndpoint; if it is present, require verify rendererFunctionPath exists (optional strictness)
      if (f.rendererEndpoint) {
        if (!f.verify || !f.verify.rendererFunctionPath) {
          fail(`Staged form has rendererEndpoint but missing verify.rendererFunctionPath: ${f.id}`);
        }
        if (!exists(f.verify.rendererFunctionPath)) {
          fail(`Staged form renderer function missing: ${f.id} -> ${f.verify.rendererFunctionPath}`);
        }
      }
    }
  }
  ok("Renderer endpoint rules satisfied for staged/non-staged forms");

  // Summary
  console.log("\nGATE SUMMARY:");
  console.log(`  Registry forms: ${regIds.join(", ")}`);
  console.log(`  Template forms: ${templateIds.join(", ")}`);
  console.log("  Status: PASS");
}

main();
