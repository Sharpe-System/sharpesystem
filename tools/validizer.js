/* /tools/validizer.js
   Validizer v2 (canon-locked)
   - Deterministic
   - No Firebase
   - No redirects
   - No network calls
   - No auth checks
   - Uses shared canon rules from /tools/canon-rules.js
*/

(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function nowISO() { return new Date().toISOString(); }
  function safeText(s) { return String(s ?? ""); }

  function getCanon() {
    const c = window.SHARPE_CANON_RULES;
    if (!c) throw new Error("Missing SHARPE_CANON_RULES. Ensure /tools/canon-rules.js is loaded before validizer.js.");
    return c;
  }

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
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) { return false; }
  }

  function detectIsFullHtml(text) {
    const t = safeText(text);
    return /<!doctype\s+html/i.test(t) || /<html[\s>]/i.test(t) || /<head[\s>]/i.test(t);
  }

  function extractBody(text) {
    const t = safeText(text);
    const m = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(t);
    return m ? m[1] : t;
  }

  function normalizeSpace(s) {
    return safeText(s).replace(/\s+/g, " ").trim();
  }

  function validateFragmentContract(fragment, canon) {
    const t = safeText(fragment);

    // Forbidden patterns
    const forbids = canon.fragment.forbidPatterns || [];
    for (const fp of forbids) {
      if (fp.re.test(t)) {
        return { ok: false, rule: fp.id, msg: fp.msg };
      }
    }

    // Require exactly one root <section class="card"> ... </section>
    if (canon.fragment.requireSingleRootSectionCard) {
      const matches = [...t.matchAll(/<section\b[^>]*class\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi)];
      if (matches.length !== 1) {
        return { ok: false, rule: "FRAG_ONE_CARD_SECTION", msg: "Fragment must contain exactly one <section class=\"card\">...</section> root." };
      }

      // Ensure nothing non-whitespace exists outside that one section
      const only = normalizeSpace(t.replace(matches[0][0], ""));
      if (only !== "") {
        return { ok: false, rule: "FRAG_NO_OUTSIDE_CONTENT", msg: "Fragment must not contain content outside the single <section class=\"card\"> root." };
      }
    }

    return { ok: true };
  }

  function checkTemplateStack(fullHtml, canon) {
    const html = safeText(fullHtml);

    const want = canon.output.scriptStack.map((s) => {
      if (s.type === "module") {
        return new RegExp(`<script[^>]+type=["']module["'][^>]+src=["']${s.src.replace(/\./g, "\\.")}["'][^>]*>\\s*<\\/script>`, "i");
      }
      return new RegExp(`<script[^>]+src=["']${s.src.replace(/\./g, "\\.")}["'][^>]*>\\s*<\\/script>`, "i");
    });

    const found = want.map((re) => {
      const m = re.exec(html);
      return m ? { ok: true, index: m.index } : { ok: false, index: -1 };
    });

    const okAll = found.every(x => x.ok);
    let okOrder = false;
    if (okAll) okOrder = found.every((x, i) => i === 0 || x.index > found[i - 1].index);

    const missing = [];
    for (let i = 0; i < found.length; i++) {
      if (!found[i].ok) missing.push(canon.output.scriptStack[i].src + (canon.output.scriptStack[i].type === "module" ? " (module)" : ""));
    }

    return { okAll, okOrder, missing };
  }

  function runChecks(input) {
    const canon = getCanon();
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

    // Fragment contract enforcement (HARD)
    if (!isFullHtml) {
      const frag = validateFragmentContract(text, canon);
      add("FRAG-CONTRACT", "CRITICAL", frag.ok, frag.ok ? "Fragment contract satisfied" : frag.msg, frag.ok ? "" : frag.rule);
    } else {
      add("FRAG-CONTRACT", "MINOR", true, "Fragment contract skipped (full HTML input)", "");
    }

    // Shared structural/security rules
    for (const r of canon.rules) {
      const pass = !!r.test(text);
      add(r.id, r.severity, pass, r.desc, pass ? "" : r.evidence);
    }

    // Full HTML stability + stack/order (HARD-ish)
    if (isFullHtml) {
      const hasDoctype = /<!doctype\s+html/i.test(text);
      const hasLang = /<html[^>]+lang=["']en["']/i.test(text);
      const hasBodyShell = /<body[^>]+class=["'][^"']*\bshell\b[^"']*["']/i.test(text);
      const hasHeaderMount = /<div\s+id=["']site-header["']\s*>\s*<\/div>/i.test(text);
      const hasMainPage = /<main[^>]+class=["'][^"']*\bpage\b[^"']*["']/i.test(text);
      const hasContainer = /<div[^>]+class=["'][^"']*\bcontainer\b[^"']*\bcontent\b[^"']*["']/i.test(text);

      add("SHELL-DOCTYPE", "MAJOR", hasDoctype, "DOCTYPE present", hasDoctype ? "" : "Missing <!doctype html>");
      add("SHELL-LANG", "MAJOR", hasLang, "html lang=\"en\" present", hasLang ? "" : "Missing <html lang=\"en\">");
      add("SHELL-BODY", "MAJOR", hasBodyShell, "body.shell present", hasBodyShell ? "" : "Missing body class=\"shell\"");
      add("SHELL-HEADER", "MAJOR", hasHeaderMount, "#site-header mount present", hasHeaderMount ? "" : "Missing <div id=\"site-header\"></div>");
      add("SHELL-MAIN", "MAJOR", hasMainPage, "main.page present", hasMainPage ? "" : "Missing <main class=\"page\">");
      add("SHELL-CONTAINER", "MAJOR", hasContainer, "container content present", hasContainer ? "" : "Missing <div class=\"container content\">");

      const stack = checkTemplateStack(text, canon);
      add("C5", "MAJOR", stack.okAll, "Canonical script stack present", stack.okAll ? "" : ("Missing: " + stack.missing.join(", ")));
      add("C5-ORDER", "MAJOR", stack.okOrder, "Canonical script stack order correct", stack.okOrder ? "" : "Scripts present but order differs from canon");
    } else {
      add("C5", "MINOR", true, "Template stack check skipped (fragment input)", "");
    }

    // Score
    const penalty = findings.reduce((acc, f) => {
      if (f.status === "PASS") return acc;
      if (f.severity === "CRITICAL") return acc + 20;
      if (f.severity === "MAJOR") return acc + 10;
      if (f.severity === "MINOR") return acc + 4;
      return acc;
    }, 0);

    const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

    return { tool: "Validizer", at: nowISO(), score, summary: { inputType: isFullHtml ? "full-html" : "fragment" }, findings };
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

  function init() {
    const inCode = $("inCode");
    const report = $("report");
    const btnValidate = $("btnValidate");
    const btnClear = $("btnClear");
    const btnCopyReport = $("btnCopyReport");
    const btnDownloadReport = $("btnDownloadReport");

    if (!inCode || !report || !btnValidate || !btnClear || !btnCopyReport || !btnDownloadReport) {
      console.error("Validizer UI missing expected elements. Replace /tools/validizer.html or /tools/validizer/index.html with the canon-matched version.");
      if (report) report.textContent = "Validizer failed to initialize: UI elements missing. Replace /tools/validizer*.html and /tools/validizer.js as a matched pair.";
      return;
    }

    btnValidate.addEventListener("click", () => {
      const obj = runChecks(inCode.value || "");
      report.textContent = formatReport(obj);
    });

    btnClear.addEventListener("click", () => {
      inCode.value = "";
      report.textContent = "";
    });

    btnCopyReport.addEventListener("click", async () => {
      await safeCopy(report.textContent || "");
    });

    btnDownloadReport.addEventListener("click", () => {
      download("validizer-report.txt", report.textContent || "", "text/plain");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
