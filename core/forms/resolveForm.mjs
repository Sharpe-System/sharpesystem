import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function loadRegistry() {
  const repoRoot = process.cwd();
  const registryPath = path.join(repoRoot, "core/forms/forms.registry.v1.json");
  const raw = fs.readFileSync(registryPath, "utf8");
  return JSON.parse(raw);
}

function normalizeUrl(u, fieldName) {
  if (typeof u !== "string" || u.trim() === "") {
    throw new Error(`Registry error: ${fieldName} must be a non-empty string`);
  }
  if (!u.startsWith("/")) {
    throw new Error(`Registry error: ${fieldName} must start with "/" (got: ${u})`);
  }
  return u;
}

function validateFormNode(node) {
  const requiredBase = ["id", "templateSrcUrl", "templateTplUrl"];
  for (const k of requiredBase) {
    if (!(k in node)) throw new Error(`Registry error: missing required key "${k}" in form node`);
  }

  if (typeof node.id !== "string" || node.id.trim() === "") {
    throw new Error(`Registry error: form.id must be non-empty string`);
  }

  node.templateSrcUrl = normalizeUrl(node.templateSrcUrl, `${node.id}.templateSrcUrl`);
  node.templateTplUrl = normalizeUrl(node.templateTplUrl, `${node.id}.templateTplUrl`);

  // staged: true => rendererEndpoint optional (because endpoint may not exist yet)
  const staged = node.staged === true;

  if (!staged) {
    if (!( "rendererEndpoint" in node )) {
      throw new Error(`Registry error: ${node.id} missing rendererEndpoint (required when staged=false)`);
    }
    node.rendererEndpoint = normalizeUrl(node.rendererEndpoint, `${node.id}.rendererEndpoint`);
  } else {
    if ("rendererEndpoint" in node && node.rendererEndpoint != null) {
      node.rendererEndpoint = normalizeUrl(node.rendererEndpoint, `${node.id}.rendererEndpoint`);
    }
  }

  if (node.fieldsUrl != null) {
    node.fieldsUrl = normalizeUrl(node.fieldsUrl, `${node.id}.fieldsUrl`);
  }

  if (node.version != null && typeof node.version !== "number") {
    throw new Error(`Registry error: ${node.id}.version must be a number if present`);
  }

  if (node.quirks != null && typeof node.quirks !== "object") {
    throw new Error(`Registry error: ${node.id}.quirks must be an object if present`);
  }

  if (node.staged != null && typeof node.staged !== "boolean") {
    throw new Error(`Registry error: ${node.id}.staged must be boolean if present`);
  }

  return node;
}

function validateRegistry(reg) {
  if (!reg || typeof reg !== "object") throw new Error("Registry error: registry must be an object");
  if (reg.registryVersion !== 1) throw new Error(`Registry error: unsupported registryVersion ${reg.registryVersion}`);
  if (!Array.isArray(reg.forms)) throw new Error("Registry error: forms must be an array");

  const seen = new Set();
  for (const raw of reg.forms) {
    const node = validateFormNode({ ...raw });
    if (seen.has(node.id)) throw new Error(`Registry error: duplicate form id "${node.id}"`);
    seen.add(node.id);
  }
}

const registry = loadRegistry();
validateRegistry(registry);

export function listForms() {
  return registry.forms.map(f => ({
    id: f.id,
    displayName: f.displayName ?? f.id,
    version: f.version,
    staged: f.staged === true
  }));
}

export function resolveForm(id) {
  if (typeof id !== "string" || id.trim() === "") {
    throw new Error("resolveForm(id) requires a non-empty string id");
  }

  const node = registry.forms.find(f => f.id === id);
  if (!node) throw new Error(`Unknown form id: ${id}`);

  // Resolver output contract: always normalized object.
  // For staged forms, rendererEndpoint is omitted (not a lie).
  return {
    id: node.id,
    templateSrcUrl: node.templateSrcUrl,
    templateTplUrl: node.templateTplUrl,
    ...(node.fieldsUrl ? { fieldsUrl: node.fieldsUrl } : {}),
    ...(node.rendererEndpoint ? { rendererEndpoint: node.rendererEndpoint } : {}),
    ...(node.version != null ? { version: node.version } : {})
  };
}
