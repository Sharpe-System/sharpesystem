// /tools/validizer.js
// Validizer: static canon checks for pasted HTML.
// Adaptable: add/edit rules in RULES[] without changing the UI.

function $(id) { return document.getElementById(id); }

function normalize(s) { return String(s || "").replace(/\r\n/g, "\n"); }

function findAllLines(text, re) {
  const lines = normalize(text).split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) hits.push({ line: i + 1, text: lines[i].trim() });
  }
  return hits;
}

function hasInOrder(text, needles) {
  const t = normalize(text);
  let idx = 0;
  for (const n of needles) {
    const j = t.indexOf(n, idx);
    if (j === -1) return false;
    idx = j + n.length;
  }
  return true;
}

// Canon rules (editable over time)
const RULES = [
  {
    id: "C5",
    severity: "MAJOR",
    name: "Canonical script stack (order)",
    test: (html) => {
      const ok = hasInOrder(html, [
        `<div id="site-header"></div>`,
        `<script src="/ui.js"`,
        `<script src="/header-loader.js"`,
        `<script src="/partials/header.js"`,
        `<script src="/i18n.js"`,
        `<script type="module" src="/gate.js"`,
      ]);
      return ok ? [] : [{ msg: "Missing or out-of-order canonical stack." }];
    }
  },
  {
    id: "C1",
    severity: "CRITICAL",
    name: "No Firebase CDN imports outside firebase-config.js",
    test: (html) => {
      const hits = findAllLines(html, /https:\/\/www\.gstatic\.com\/firebasejs\//);
      return hits.length ? hits.map(h => ({ msg: `Firebase CDN import found`, ...h })) : [];
    }
  },
  {
    id: "C2",
    severity: "CRITICAL",
    name: "No onAuthStateChanged listeners in pages/modules",
    test: (html) => {
      const hits = findAllLines(html, /\bonAuthStateChanged\b/);
      return hits.length ? hits.map(h => ({ msg: `onAuthStateChanged usage found`, ...h })) : [];
    }
  },
  {
    id: "C7",
    severity: "CRITICAL",
    name: "No window.firebase* legacy globals",
    test: (html) => {
      const hits = findAllLines(html, /\bwindow\.firebase\b/);
      return hits.length ? hits.map(h => ({ msg: `window.firebase legacy surface found`, ...h })) : [];
    }
  },
  {
    id: "C3",
    severity: "CRITICAL",
    name: "No auth/tier gating redirects inside page code",
    test: (html) => {
      const hits = findAllLines(html, /\b(location\.href|location\.replace|window\.location)\b/);
      return hits.length ? hits.map(h => ({ msg: `Redirect primitive found (verify not used for gating)`, ...h })) : [];
    }
  }
];

function renderReport(violations) {
  if (!violations.length) return "PASS ✅\nNo violations detected by Validizer ruleset.";

  const bySeverity = { CRITICAL: [], MAJOR: [], MINOR: [] };
  for (const v of violations) bySeverity[v.severity]?.push(v);

  let out = "FAIL ❌\n\n";
  for (const sev of ["CRITICAL", "MAJOR", "MINOR"]) {
    if (!bySeverity[sev].length) continue;
    out += `${sev}:\n`;
    for (const v of bySeverity[sev]) {
      const loc = v.line ? ` (line ${v.line})` : "";
      const lineText = v.text ? `\n  > ${v.text}` : "";
      out += `- [${v.id}] ${v.name}${loc}: ${v.msg}${lineText}\n`;
    }
    out += "\n";
  }
  out += "Tip: Validizer is static. Passing here does not guarantee business logic correctness.\n";
  return out;
}

function validateNow() {
  const html = normalize($("inHtml").value);
  const violations = [];

  for (const rule of RULES) {
    const hits = rule.test(html) || [];
    for (const h of hits) {
      violations.push({
        id: rule.id,
        name: rule.name,
        severity: rule.severity,
        msg: h.msg || "Violation",
        line: h.line || null,
        text: h.text || null,
      });
    }
  }

  $("out").textContent = renderReport(violations);
}

document.addEventListener("DOMContentLoaded", () => {
  $("btnValidate").addEventListener("click", validateNow);
  $("btnClear").addEventListener("click", () => {
    $("inHtml").value = "";
    $("out").textContent = "";
  });
});
