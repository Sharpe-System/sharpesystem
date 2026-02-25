import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const registryPath = path.join(repoRoot, "core/forms/forms.registry.v1.json");

function fail(msg) {
  console.error(`VERIFY FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

if (!fs.existsSync(registryPath)) {
  fail(`Missing registry file: ${registryPath}`);
}

const regRaw = fs.readFileSync(registryPath, "utf8");
let reg;
try {
  reg = JSON.parse(regRaw);
} catch (e) {
  fail(`Registry JSON parse error: ${e.message}`);
}

if (!reg || typeof reg !== "object") fail("Registry must be an object");
if (reg.registryVersion !== 1) fail(`Unsupported registryVersion: ${reg.registryVersion}`);
if (!Array.isArray(reg.forms)) fail("Registry forms must be an array");

const seen = new Set();

for (const f of reg.forms) {
  if (!f || typeof f !== "object") fail("Form node must be an object");
  if (typeof f.id !== "string" || f.id.trim() === "") fail("Form id must be non-empty string");
  if (seen.has(f.id)) fail(`Duplicate form id: ${f.id}`);
  seen.add(f.id);

  // Required for all forms
  const requiredAlways = ["templateSrcUrl", "templateTplUrl"];
  for (const k of requiredAlways) {
    if (typeof f[k] !== "string" || f[k].trim() === "") fail(`${f.id}: missing required ${k}`);
    if (!f[k].startsWith("/")) fail(`${f.id}: ${k} must start with "/" (got: ${f[k]})`);
  }

  const staged = f.staged === true;

  // rendererEndpoint required only when staged=false
  if (!staged) {
    if (typeof f.rendererEndpoint !== "string" || f.rendererEndpoint.trim() === "") {
      fail(`${f.id}: rendererEndpoint required when staged=false`);
    }
    if (!f.rendererEndpoint.startsWith("/")) fail(`${f.id}: rendererEndpoint must start with "/" (got: ${f.rendererEndpoint})`);
  } else {
    if (f.rendererEndpoint != null) {
      if (typeof f.rendererEndpoint !== "string") fail(`${f.id}: rendererEndpoint must be string if present`);
      if (!f.rendererEndpoint.startsWith("/")) fail(`${f.id}: rendererEndpoint must start with "/" (got: ${f.rendererEndpoint})`);
    }
  }

  if (f.fieldsUrl != null) {
    if (typeof f.fieldsUrl !== "string") fail(`${f.id}: fieldsUrl must be string if present`);
    if (!f.fieldsUrl.startsWith("/")) fail(`${f.id}: fieldsUrl must start with "/" (got: ${f.fieldsUrl})`);
  }

  if (f.verify && typeof f.verify === "object") {
    const checks = [
      ["templateSrcPath", f.verify.templateSrcPath],
      ["templateTplPath", f.verify.templateTplPath],
      ["fieldsPath", f.verify.fieldsPath],
      ["rendererFunctionPath", f.verify.rendererFunctionPath]
    ];

    for (const [label, rel] of checks) {
      if (rel == null) continue;
      if (typeof rel !== "string" || rel.trim() === "") fail(`${f.id}: verify.${label} must be non-empty string if present`);
      const abs = path.join(repoRoot, rel);
      if (!fs.existsSync(abs)) fail(`${f.id}: verify.${label} does not exist: ${rel}`);
      ok(`${f.id}: exists ${rel}`);
    }

    // Additional enforcement: if staged=false and rendererFunctionPath is provided, it must exist.
    // If staged=true, rendererFunctionPath should generally be omitted until endpoint exists.
    if (!staged && f.verify.rendererFunctionPath == null) {
      console.warn(`WARN: ${f.id}: staged=false but verify.rendererFunctionPath is not set (recommended to set).`);
    }
  } else {
    console.warn(`WARN: ${f.id} has no verify{} node; filesystem existence not checked for this form.`);
  }
}

ok(`Registry verified: ${reg.forms.length} form(s)`);
