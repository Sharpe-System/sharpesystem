#!/usr/bin/env node
/**
 * RFO Guard (Canon + Flow Guardrails)
 * - Fails build if RFO public pages violate canon or common-link invariants.
 * - No deletions. Only detection + actionable errors.
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const RFO_DIR = path.join(ROOT, "rfo");

const REQUIRED_STACK_PUBLIC = [
  "/ui.js",
  "/header-loader.js",
  "/partials/header.js",
  "/i18n.js",
];

const DISALLOWED_ON_PUBLIC = [
  "/gate.js", // public pages must not include gate.js
];

const REQUIRED_OFFRAMPS = [
  "/amicable.html",
  "/peace-path.html",
];

const BAD_LOGIN_ROUTES = [
  "/login",        // must be /login.html
  "/signup",       // must be /signup.html
];

const BAD_API_PREFIXES = [
  "/functions/api/", // Pages functions are exposed at /api/ not /functions/api/
];

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch (_) { return null; }
}

function listHtmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith(".html")) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function rel(p) {
  return "/" + path.relative(ROOT, p).replaceAll(path.sep, "/");
}

function isPublicRfoPage(filePath) {
  // Treat everything under /rfo as public unless explicitly named paid/print.html (paid) etc.
  // You can refine later; default is safety: assume public.
  const r = rel(filePath);
  // Paid equivalents you mentioned
  if (r === "/rfo/print.html") return false;
  if (r === "/rfo/exparte-print.html") return false;
  if (r.includes("/paid-")) return false;
  return true;
}

function extractScriptSrcs(html) {
  const srcs = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) srcs.push(m[1]);
  return srcs;
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) hrefs.push(m[1]);
  return hrefs;
}

function hasAny(html, needles) {
  return needles.some((n) => html.includes(n));
}

function assert(cond, msg, errors) {
  if (!cond) errors.push(msg);
}

function checkPublicPage(filePath, html) {
  const errors = [];
  const r = rel(filePath);

  // Canon stack required
  for (const s of REQUIRED_STACK_PUBLIC) {
    assert(html.includes(`src="${s}"`) || html.includes(`src='${s}'`), `${r}: missing canonical script ${s}`, errors);
  }

  // No gate.js on public
  for (const s of DISALLOWED_ON_PUBLIC) {
    assert(!html.includes(`src="${s}"`) && !html.includes(`src='${s}'`), `${r}: public page must NOT include ${s}`, errors);
  }

  // Required off-ramps present somewhere in page (not necessarily header)
  for (const link of REQUIRED_OFFRAMPS) {
    assert(html.includes(`href="${link}"`) || html.includes(`href='${link}'`), `${r}: missing required off-ramp link to ${link}`, errors);
  }

  // Ban /login (no .html)
  for (const bad of BAD_LOGIN_ROUTES) {
    assert(!html.includes(`href="${bad}"`) && !html.includes(`href='${bad}'`), `${r}: bad link route "${bad}" — must use "${bad}.html"`, errors);
  }

  // Ban wrong api prefix usage
  for (const badApi of BAD_API_PREFIXES) {
    assert(!html.includes(badApi), `${r}: uses "${badApi}" — must use "/api/..." not "/functions/api/..."`, errors);
  }

  // Anti-redirect sanity on public pages (no inline JS redirects)
  const redirectish = [
    "window.location=",
    "window.location.replace(",
    "window.location.href=",
    "location.href=",
    "location.replace(",
  ];
  assert(!hasAny(html, redirectish), `${r}: redirect-like code found in HTML. Public pages must not redirect.`, errors);

  return errors;
}

function checkGeneralRfoPage(filePath, html) {
  const errors = [];
  const r = rel(filePath);

  // If a page includes /gate.js it must be marked as non-public by naming convention
  const scripts = extractScriptSrcs(html);
  if (scripts.includes("/gate.js") && isPublicRfoPage(filePath)) {
    errors.push(`${r}: includes /gate.js but is treated as public. Remove gate.js OR rename/classify as paid page.`);
  }

  // Catch common “/login?…” without .html
  const hrefs = extractHrefs(html);
  for (const h of hrefs) {
    if (h.startsWith("/login?")) {
      errors.push(`${r}: link starts with "/login?" — must be "/login.html?..."`);
    }
    if (h.startsWith("/signup?")) {
      errors.push(`${r}: link starts with "/signup?" — must be "/signup.html?..."`);
    }
  }

  return errors;
}

function main() {
  const errors = [];

  if (!fs.existsSync(RFO_DIR)) {
    console.error("RFO Guard: /rfo directory not found.");
    process.exit(2);
  }

  const pages = listHtmlFiles(RFO_DIR);
  if (!pages.length) {
    console.error("RFO Guard: no .html files found under /rfo.");
    process.exit(2);
  }

  for (const p of pages) {
    const html = readFileSafe(p);
    if (!html) {
      errors.push(`${rel(p)}: unreadable file`);
      continue;
    }

    errors.push(...checkGeneralRfoPage(p, html));

    if (isPublicRfoPage(p)) {
      errors.push(...checkPublicPage(p, html));
    } else {
      // Paid pages: still require stack, but gate.js may be present
      for (const s of REQUIRED_STACK_PUBLIC) {
        if (!html.includes(`src="${s}"`) && !html.includes(`src='${s}'`)) {
          errors.push(`${rel(p)}: missing canonical script ${s}`);
        }
      }
      // Paid pages should include gate.js (recommended)
      if (!html.includes(`src="/gate.js"`) && !html.includes(`src='/gate.js'`)) {
        errors.push(`${rel(p)}: paid page missing /gate.js (expected for gated/paid pages)`);
      }
    }
  }

  if (errors.length) {
    console.error("\nRFO Guard FAILED:\n");
    for (const e of errors) console.error(" - " + e);
    console.error(`\nTotal issues: ${errors.length}\n`);
    process.exit(1);
  }

  console.log(`RFO Guard OK (${pages.length} pages checked)`);
  process.exit(0);
}

main();
