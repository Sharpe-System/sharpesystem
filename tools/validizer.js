/* /tools/validizer.js
   Validizer — deterministic canon checks for pasted HTML/JS (no Firebase, no gating).
   Output is a plain-text report + a payload passed to Canonizer via sessionStorage.
*/
(function () {
  "use strict";

  const KEY_PAYLOAD = "SHARPESYSTEM_VALIDIZER_PAYLOAD";

  function $(id) { return document.getElementById(id); }

  function nowISO() {
    try { return new Date().toISOString(); } catch { return ""; }
  }

  function safeCopy(text) {
    try {
      navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  function download(filename, text, mime) {
    try {
      const blob = new Blob([text], { type: mime || "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  }

  function isFullHTML(text) {
    const t = String(text || "");
    return /<!doctype\s+html/i.test(t) || /<html[\s>]/i.test(t);
  }

  function addFinding(findings, rule, severity, ok, desc, evidence) {
    findings.push({
      rule,
      severity,
      status: ok ? "PASS" : "FAIL",
      desc,
      evidence: evidence || ""
    });
  }

  function checkTemplateStack(html) {
    // Only meaningful for full HTML docs.
    const want = [
      /<div[^>]+id\s*=\s*["']site-header["'][^>]*>\s*<\/div>/i,
      /<script[^>]+src\s*=\s*["']\/ui\.js["'][^>]*>\s*<\/script>/i,
      /<script[^>]+src\s*=\s*["']\/header-loader\.js["'][^>]*>\s*<\/script>/i,
      /<script[^>]+src\s*=\s*["']\/partials\/header\.js["'][^>]*>\s*<\/script>/i,
      /<script[^>]+src\s*=\s*["']\/i18n\.js["'][^>]*>\s*<\/script>/i,
      /<script[^>]+type\s*=\s*["']module["'][^>]+src\s*=\s*["']\/gate\.js["'][^>]*>\s*<\/script>/i,
    ];

    const foundIdx = [];
    for (const re of want) {
      const m = re.exec(html);
      foundIdx.push(m ? m.index : -1);
    }
    const missing = foundIdx.map((v, i) => (v === -1 ? i : -1)).filter((x) => x !== -1);
    const okAll = missing.length === 0;

    let okOrder = false;
    if (okAll) {
      okOrder = foundIdx.every((v, i) => (i === 0 ? true : v >= foundIdx[i - 1]));
    }

    return {
      okAll,
      okOrder,
      missing: missing.map((i) => i),
      indices: foundIdx
    };
  }

  function runChecks(input) {
    const text = String(input || "");
    const full = isFullHTML(text);
    const findings = [];

    // Basic stability (for full HTML)
    if (full) {
      addFinding(findings, "STABLE-DOCTYPE", "MAJOR", /<!doctype\s+html/i.test(text), "doctype present", "");
      addFinding(findings, "STABLE-LANG", "MAJOR", /<html[^>]+lang\s*=\s*["'][^"']+["']/i.test(text), "html lang present", "");
      addFinding(findings, "STABLE-CHARSET", "MAJOR", /<meta[^>]+charset\s*=\s*["']utf-8["']/i.test(text), "meta charset utf-8 present", "");
      addFinding(findings, "STABLE-VIEWPORT", "MAJOR", /<meta[^>]+name\s*=\s*["']viewport["']/i.test(text), "meta viewport present", "");
      addFinding(findings, "STABLE-STYLES", "MAJOR", /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]+href\s*=\s*["']\/styles\.css["']/i.test(text), "/styles.css linked", "");
    } else {
      addFinding(findings, "STABLE-SKIP", "MINOR", true, "basic HTML stability checks skipped (fragment input)", "");
    }

    // C1 Firebase CDN imports
    const firebaseCDN = /https:\/\/www\.gstatic\.com\/firebasejs\//i.test(text);
    addFinding(
      findings,
      "C1",
      "CRITICAL",
      !firebaseCDN,
      "No Firebase CDN imports (must be only in /firebase-config.js)",
      firebaseCDN ? "Found gstatic firebasejs reference" : ""
    );

    // C2 onAuthStateChanged usage
    const onAuth = /\bonAuthStateChanged\b/i.test(text);
    addFinding(
      findings,
      "C2",
      "CRITICAL",
      !onAuth,
      "No onAuthStateChanged usage here (must be only in firebase-config.js)",
      onAuth ? "Found onAuthStateChanged reference" : ""
    );

    // C7 window.firebase legacy
    const winFirebase = /\bwindow\.firebase\b/i.test(text);
    addFinding(
      findings,
      "C7",
      "CRITICAL",
      !winFirebase,
      "No legacy window.firebase usage",
      winFirebase ? "Found window.firebase reference" : ""
    );

    // Heuristic: redirects/gating outside gate
    const redirectish = /\b(location\.href|location\.replace|window\.location)\b/i.test(text);
    addFinding(
      findings,
      "C3-HEUR",
      "MAJOR",
      !redirectish,
      "No redirect-like calls in this pasted code (gate.js owns gating/redirects)",
      redirectish ? "Found location.href / location.replace / window.location reference" : ""
    );

    // Heuristic: header-auth duplication (data-auth hooks or navAccount/navLogout)
    const headerDup = /\bdata-auth-|\bnavAccount\b|\bnavLogout\b|\binitHeaderAuth\b/i.test(text);
    addFinding(
      findings,
      "C6-HEUR",
      "MAJOR",
      !headerDup,
      "Avoid duplicating header-auth logic in pages/modules",
      headerDup ? "Found header-auth hook patterns" : ""
    );

    // C5 Template stack/order
    if (full) {
      const stack = checkTemplateStack(text);
      addFinding(findings, "C5", "MAJOR", stack.okAll, "Canonical script stack present", stack.okAll ? "" : "Missing one or more canonical stack elements");
      addFinding(findings, "C5-ORDER", "MAJOR", stack.okOrder, "Canonical script stack order correct", stack.okOrder ? "" : "Scripts present but order differs from canon");
    } else {
      addFinding(findings, "C5", "MINOR", true, "Template stack check skipped (fragment input)", "");
    }

    // Score
    const failed = findings.filter((f) => f.status === "FAIL");
    const penalty = failed.reduce((acc, f) => {
      if (f.severity === "CRITICAL") return acc + 18;
      if (f.severity === "MAJOR") return acc + 10;
      return acc + 4;
    }, 0);

    const score = Math.max(0, Math.min(100, 100 - penalty));

    return {
      tool: "Validizer",
      at: nowISO(),
      score,
      summary: {
        inputType: full ? "full-html" : "fragment",
        pass: findings.filter((f) => f.status === "PASS").length,
        fail: failed.length,
      },
      findings
    };
  }

  function formatReport(obj) {
    const lines = [];
    lines.push("SHARPESYSTEM VALIDIZER REPORT");
    lines.push("Time: " + (obj.at || ""));
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
    if (el) el.textContent = text || "";
  }

  function persistPayload(input, reportObj) {
    try {
      sessionStorage.setItem(KEY_PAYLOAD, JSON.stringify({
        at: nowISO(),
        input: String(input || ""),
        report: reportObj
      }));
    } catch {}
  }

  function loadPayload() {
    try {
      const raw = sessionStorage.getItem(KEY_PAYLOAD);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function clearPayload() {
    try { sessionStorage.removeItem(KEY_PAYLOAD); } catch {}
  }

  function boot() {
    const btnValidate = $("btnValidate");
    const btnToCanon = $("btnToCanon");
    const btnClear = $("btnClear");
    const btnDownload = $("btnDownloadReport");
    const inCode = $("inCode");

    // Auto-load last payload
    const prev = loadPayload();
    if (prev && inCode && typeof prev.input === "string" && prev.input.trim()) {
      inCode.value = prev.input;
      if (prev.report) setReport(formatReport(prev.report));
    }

    if (btnValidate) {
      btnValidate.addEventListener("click", () => {
        const input = inCode ? inCode.value : "";
        const obj = runChecks(input);
        const txt = formatReport(obj);
        setReport(txt);
        persistPayload(input, obj);
      });
    }

    if (btnToCanon) {
      btnToCanon.addEventListener("click", () => {
        const input = inCode ? inCode.value : "";
        const obj = runChecks(input);
        const txt = formatReport(obj);
        setReport(txt);
        persistPayload(input, obj);
        // Use folder route (stable)
        window.location.href = "/tools/canonizer/";
      });
    }

    if (btnClear) {
      btnClear.addEventListener("click", () => {
        if (inCode) inCode.value = "";
        setReport("");
        clearPayload();
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener("click", () => {
        const txt = ($("report") && $("report").textContent) ? $("report").textContent : "";
        download("validizer-report.txt", txt || "", "text/plain");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
