/* /tools/validizer.js
   Deterministic canon checks.
   Canon rules (high level):
   - No Firebase CDN imports (only /firebase-config.js owns Firebase imports)
   - No onAuthStateChanged usage in pages/modules (only /firebase-config.js)
   - No redirects/gating in pages/modules (gate.js owns)
*/

(function () {
  "use strict";

  const KEY_PAYLOAD = "shs_validizer_payload_v1";

  function $(id) { return document.getElementById(id); }

  function nowISO() { return new Date().toISOString(); }

  function safeText(s) { return String(s ?? ""); }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function safeCopy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  function detectIsFullHtml(text) {
    return /<!doctype\s+html/i.test(text) || /<html[\s>]/i.test(text);
  }

  function checkTemplateStack(html) {
    // Only meaningful for full HTML pages.
    // Required canonical stack (order-sensitive):
    // ui.js, header-loader.js, /partials/header.js, i18n.js, gate.js (module)
    const want = [
      /<script[^>]+src=["']\/ui\.js["'][^>]*>\s*<\/script>/i,
      /<script[^>]+src=["']\/header-loader\.js["'][^>]*>\s*<\/script>/i,
      /<script[^>]+src=["']\/partials\/header\.js["'][^>]*>\s*<\/script>/i,
      /<script[^>]+src=["']\/i18n\.js["'][^>]*>\s*<\/script>/i,
      /<script[^>]+type=["']module["'][^>]+src=["']\/gate\.js["'][^>]*>\s*<\/script>/i,
    ];

    const found = want.map((re) => {
      const m = re.exec(html);
      return m ? { ok: true, index: m.index } : { ok: false, index: -1 };
    });

    const okAll = found.every(x => x.ok);
    let okOrder = false;

    if (okAll) {
      okOrder = found.every((x, i) => i === 0 || x.index > found[i - 1].index);
    }

    const missing = [];
    if (!found[0].ok) missing.push("ui.js");
    if (!found[1].ok) missing.push("header-loader.js");
    if (!found[2].ok) missing.push("partials/header.js");
    if (!found[3].ok) missing.push("i18n.js");
    if (!found[4].ok) missing.push("gate.js (module)");

    return { okAll, okOrder, missing };
  }

  function runChecks(input) {
    const text = safeText(input);
    const isFullHtml = detectIsFullHtml(text);

    const findings = [];
    function add(rule, severity, pass, desc, evidence) {
      findings.push({
        rule,
        severity,
        status: pass ? "PASS" : "FAIL",
        desc,
        evidence: pass ? "" : (evidence || "")
      });
    }

    // Basic stability checks (only enforce hard when full HTML)
    const hasCharset = /<meta\s+charset=["']utf-8["']/i.test(text);
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(text);
    const hasLang = /<html[^>]+lang=["'][^"']+["']/i.test(text);
    const hasStyles = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']\/styles\.css["']/i.test(text);
    const hasHeaderMount = /<div\s+id=["']site-header["']\s*>\s*<\/div>/i.test(text);

    if (isFullHtml) {
      add("STABLE-META-CHARSET", "MAJOR", hasCharset, "meta charset utf-8 present", hasCharset ? "" : "Missing <meta charset=\"utf-8\">");
      add("STABLE-VIEWPORT", "MAJOR", hasViewport, "meta viewport present", hasViewport ? "" : "Missing <meta name=\"viewport\" ...>");
      add("STABLE-LANG", "MINOR", hasLang, "html lang present", hasLang ? "" : "Missing <html lang=\"...\">");
      add("STABLE-STYLES", "MAJOR", hasStyles, "styles.css linked", hasStyles ? "" : "Missing <link rel=\"stylesheet\" href=\"/styles.css\">");
      add("STABLE-HEADER-MOUNT", "MINOR", hasHeaderMount, "header mount present", hasHeaderMount ? "" : "Missing <div id=\"site-header\"></div>");
    } else {
      add("STABLE-SKIP", "MINOR", true, "basic HTML stability checks skipped (fragment input)", "");
    }

    // Canon checks
    const firebaseCDN = /https:\/\/www\.gstatic\.com\/firebasejs/i;
    add("C1", "CRITICAL", !firebaseCDN.test(text), "No Firebase CDN imports (must be only in /firebase-config.js)", "Found firebasejs CDN reference");

    const onAuth = /\bonAuthStateChanged\b/i;
    add("C2", "CRITICAL", !onAuth.test(text), "No onAuthStateChanged usage here (must be only in /firebase-config.js)", "Found onAuthStateChanged reference");

    const winFirebase = /\bwindow\.firebase\b/i;
    add("C7", "CRITICAL", !winFirebase.test(text), "No legacy window.firebase usage", "Found window.firebase usage");

    // Redirect/gating heuristics (not perfect, still useful)
    const redirects = /\b(location\.href|location\.replace|window\.location)\b/i;
    add("C3-HEUR", "MAJOR", !redirects.test(text), "No redirect-like calls in this pasted code (gate.js owns gating/redirects)", "Found redirect-like usage");

    const headerAuthDupes = /\b(ensureAuth|renderUser|authState|headerAuth|data-auth-|userTier|tierGate)\b/i;
    add("C6-HEUR", "MAJOR", !headerAuthDupes.test(text), "Avoid duplicating header-auth logic in pages/modules", "Found header-auth style hooks");

    // Template stack check (only for full HTML)
    if (isFullHtml) {
      const stack = checkTemplateStack(text);
      add("C5", "MAJOR", stack.okAll, "Canonical script stack present", stack.okAll ? "" : ("Missing: " + stack.missing.join(", ")));
      add("C5-ORDER", "MAJOR", stack.okOrder, "Canonical script stack order correct", stack.okOrder ? "" : "Scripts present but order differs from canon");
    } else {
      add("C5", "MINOR", true, "Template stack check skipped (fragment input)", "");
    }

    // Score
    const penalty = findings.reduce((acc, f) => {
      if (f.status === "PASS") return acc;
      if (f.severity === "CRITICAL") return acc + 18;
      if (f.severity === "MAJOR") return acc + 10;
      if (f.severity === "MINOR") return acc + 4;
      return acc;
    }, 0);

    const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

    return {
      tool: "Validizer",
      at: nowISO(),
      score,
      summary: { inputType: isFullHtml ? "full-html" : "fragment" },
      findings
    };
  }

  function formatReport(obj) {
    const lines = [];
    lines.push("SHARPESYSTEM VALIDIZER REPORT");
    lines.push("Time: " + obj.at);
    lines.push("Score: " + obj.score + "/100");
    lines.push("Input: " + obj.summary.inputType);
    lines.push("");
    lines.push("Findings:");
    lines.push("Severity | Rule | Status | Description | Evidence");
    lines.push("--------------------------------------------------");
    for (const f of obj.findings) {
      lines.push(`${f.severity} | ${f.rule} | ${f.status} | ${f.desc} | ${f.evidence}`);
    }
    return lines.join("\n");
  }

  function setReport(text) {
    const el = $("report");
    if (!el) return;
    el.textContent = safeText(text);
  }

  function savePayload(payload) {
    try { sessionStorage.setItem(KEY_PAYLOAD, JSON.stringify(payload)); } catch (_) {}
  }

  function loadPayload() {
    try {
      const raw = sessionStorage.getItem(KEY_PAYLOAD);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function clearPayload() {
    try { sessionStorage.removeItem(KEY_PAYLOAD); } catch (_) {}
  }

  function init() {
    const inCode = $("inCode");
    const btnValidate = $("btnValidate");
    const btnToCanon = $("btnToCanon");
    const btnCopyReport = $("btnCopyReport");
    const btnDownloadReport = $("btnDownloadReport");
    const btnClear = $("btnClear");

    // Hard-stop if HTML and JS are mismatched again
    if (!inCode || !btnValidate || !btnToCanon || !btnCopyReport || !btnDownloadReport || !btnClear) {
      console.error("Validizer UI missing expected elements. Check validizer.html IDs.");
      setReport("Validizer failed to initialize: UI elements missing. Replace /tools/validizer.html and /tools/validizer.js as a matched pair.");
      return;
    }

    // Auto-load previous session (nice UX)
    const prior = loadPayload();
    if (prior && typeof prior.input === "string" && prior.input.trim()) {
      inCode.value = prior.input;
      if (prior.reportText) setReport(prior.reportText);
    }

    btnValidate.addEventListener("click", () => {
      const input = inCode.value || "";
      const obj = runChecks(input);
      const txt = formatReport(obj);
      setReport(txt);
      savePayload({ at: obj.at, report: obj, reportText: txt, input });
    });

    btnToCanon.addEventListener("click", () => {
      const input = inCode.value || "";
      const obj = runChecks(input);
      const txt = formatReport(obj);
      savePayload({ at: obj.at, report: obj, reportText: txt, input });

      // Prefer extensionless route if present, otherwise fall back.
      const tryA = "/tools/canonizer/";
      const tryB = "/tools/canonizer.html";
      // Navigate to A; if site doesn’t support, user can use B.
      window.location.href = tryA;
      // (No async check here; this stays deterministic and simple.)
    });

    btnCopyReport.addEventListener("click", async () => {
      const txt = $("report").textContent || "";
      await safeCopy(txt);
    });

    btnDownloadReport.addEventListener("click", () => {
      const txt = $("report").textContent || "";
      download("validizer-report.txt", txt, "text/plain");
    });

    btnClear.addEventListener("click", () => {
      inCode.value = "";
      setReport("");
      clearPayload();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
