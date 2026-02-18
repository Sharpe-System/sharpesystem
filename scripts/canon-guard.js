#!/usr/bin/env node
/* scripts/canon-guard.js
   SharpeSystem canon boundary guard.

   Fails if:
   1) Any non-canon file imports Firebase SDK (firebasejs/*) OR calls initializeApp/getAuth/getFirestore.
   2) Any non-gate.js file contains "auth gating redirects" to /login.html, /tier1.html, /subscribe.html.

   Canon allowlist:
     /firebase-config.js
     /gate.js
     /login.js
     /signup.js
     /billing.js
     /peace/peace.js
     /canon/** (optional expansion path)
*/

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".wrangler",
  ".firebase",
  ".firebaserc",
  "dist",
  "build",
  ".next",
  ".cache",
]);

const ALLOW_FIREBASE = new Set([
  "firebase-config.js",
  "gate.js",
  "login.js",
  "signup.js",
  "billing.js",
  path.join("peace", "peace.js"),
]);

function normRel(p) {
  return p.split(path.sep).join("/");
}

function isUnderCanon(rel) {
  return rel.startsWith("canon/");
}

function isAllowedFirebaseFile(rel) {
  if (ALLOW_FIREBASE.has(rel)) return true;
  if (isUnderCanon(rel)) return true; // optional future expansion
  return false;
}

function shouldScanFile(rel) {
  if (!rel.endsWith(".js") && !rel.endsWith(".mjs") && !rel.endsWith(".html")) return false;
  return true;
}

function walk(dirAbs, outRel = []) {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dirAbs, ent.name);
    const rel = normRel(path.relative(ROOT, abs));

    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(abs, outRel);
    } else {
      if (shouldScanFile(rel)) outRel.push(rel);
    }
  }
  return outRel;
}

/* ---------- Checks ---------- */

// 1) Firebase SDK surface detection
const FIREBASE_IMPORT_RE = /firebasejs\/[0-9.]+\/firebase-(app|auth|firestore)\.js/;
const FIREBASE_CALL_RE = /\b(initializeApp|getAuth|getFirestore|getDocs|setDoc|addDoc|updateDoc|deleteDoc)\b/;

// 2) Auth gating redirect detection (only gate.js may do this)
const GATE_REDIRECT_RE = /\b(location\.href|location\.assign|location\.replace|window\.location)\b[^;\n]*\/(login|tier1|subscribe)\.html\b/;

function readText(rel) {
  const abs = path.join(ROOT, rel);
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return "";
  }
}

function scan() {
  const files = walk(ROOT, []);
  const violations = [];

  for (const rel of files) {
    const txt = readText(rel);
    if (!txt) continue;

    // Firebase SDK surface
    const hasFirebaseImport = FIREBASE_IMPORT_RE.test(txt);
    const hasFirebaseCalls = FIREBASE_CALL_RE.test(txt);

    if ((hasFirebaseImport || hasFirebaseCalls) && !isAllowedFirebaseFile(rel)) {
      violations.push({
        type: "FIREBASE_SURFACE",
        file: rel,
        detail: hasFirebaseImport ? "firebasejs import" : "firebase SDK call(s)",
      });
    }

    // Gate redirects
    const hasGateRedirect = GATE_REDIRECT_RE.test(txt);
    if (hasGateRedirect && rel !== "gate.js") {
      violations.push({
        type: "GATING_REDIRECT",
        file: rel,
        detail: "redirect to login/tier1/subscribe outside gate.js",
      });
    }
  }

  if (violations.length) {
    console.error("\n❌ Canon boundary violations found:\n");
    for (const v of violations) {
      console.error(`- [${v.type}] ${v.file} — ${v.detail}`);
    }
    console.error("\nFix: move Firebase usage into canon modules only, and move gating redirects into gate.js only.\n");
    process.exit(1);
  }

  console.log("✅ canon-guard: OK");
}

scan();
