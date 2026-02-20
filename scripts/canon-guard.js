#!/usr/bin/env node
/**
 * Canon Guard (Lane & Import Guardrails)
 * - Prevents reintroducing the classes of breakage you just hit.
 * - Especially: Node-only deps inside /functions/** and wrong clean-url links.
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const SCAN_DIRS = [
  "functions",
  "rfo",
  "partials",
];

const FORBIDDEN_FUNCTION_IMPORTS = [
  "pdf-lib", // ban in Pages runtime lane
  "fs",
  "path",
  "child_process",
];

const FORBIDDEN_HTML_LINKS = [
  'href="/login?"',
  "href='/login?'",
  'href="/signup?"',
  "href='/signup?'",
  'href="/login"',
  "href='/login'",
  'href="/signup"',
  "href='/signup'",
];

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch (_) { return null; }
}

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
    const full = path.join(abs, ent.name);
    if (ent.isDirectory()) walk(path.join(dir, ent.name), out);
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

function rel(p) {
  return "/" + path.relative(ROOT, p).replaceAll(path.sep, "/");
}

function main() {
  const files = [];
  for (const d of SCAN_DIRS) files.push(...walk(d));

  const errors = [];

  for (const f of files) {
    const text = readFileSafe(f);
    if (!text) continue;

    const r = rel(f);

    // /functions/** may not import Node-only / heavy deps
    if (r.startsWith("/functions/") && r.endsWith(".js")) {
      for (const bad of FORBIDDEN_FUNCTION_IMPORTS) {
        const importRe = new RegExp(`\\bfrom\\s+["']${bad}["']|\\brequire\$begin:math:text$\[\"\'\]\$\{bad\}\[\"\'\]\\$end:math:text$`, "g");
        if (importRe.test(text)) {
          errors.push(`${r}: forbidden import "${bad}" in /functions lane`);
        }
      }
    }

    // HTML: forbid clean-url login links
    if (r.endsWith(".html")) {
      for (const bad of FORBIDDEN_HTML_LINKS) {
        if (text.includes(bad)) errors.push(`${r}: forbidden route usage (${bad}) — must use .html`);
      }
      // Forbid using /functions/api paths directly
      if (text.includes("/functions/api/")) {
        errors.push(`${r}: uses "/functions/api/" — must call "/api/..."`);
      }
    }
  }

  if (errors.length) {
    console.error("\nCanon Guard FAILED:\n");
    for (const e of errors) console.error(" - " + e);
    console.error(`\nTotal issues: ${errors.length}\n`);
    process.exit(1);
  }

  console.log(`Canon Guard OK (${files.length} files checked)`);
  process.exit(0);
}

main();
