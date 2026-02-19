/* /tools/validizer.js
   Validizer (HTML + JSON mode)

   - If input parses as JSON object with {h1, blocks[]} => validate schema and render to fragment (deterministic),
     then run the usual fragment checks on the rendered fragment.
   - If input is HTML fragment or full HTML, validate as before.

   HARD TOOL POLICY:
   - No Firebase
   - No redirects (no location.* calls)
   - No network calls
   - No auth checks

   Handoff:
   - Stores payload for Canonizer in sessionStorage key "shs_validizer_payload_v1"
*/

(function () {
  "use strict";

  const KEY_PAYLOAD = "shs_validizer_payload_v1";

  function $(id) { return document.getElementById(id); }
  function nowISO() { return new Date().toISOString(); }
  function safeText(s) { return String(s ?? ""); }

  function canon() {
    const c = window.SHS_CANON;
    if (!c) throw new Error("Missing SHS_CANON. Load /tools/canon-rules.js before validizer.js.");
    return c;
  }

  function renderer() {
    const r = window.SHS_RENDERER;
    if (!r) throw new Error("Missing SHS_RENDERER. Load /tools/renderer.js before validizer.js.");
    return r;
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
    return /<!doctype\s+html/i.test(t) || /<html[\s>]/i.test(t) || /<head[\s>]/i.test(t) || /<body[\s>]/i.test(t);
  }

  function tryParseJson(text) {
    const t = safeText(text).trim();
    if (!(t.startsWith("{") || t.startsWith("["))) return null;
    try {
      const obj = JSON.parse(t);
      return obj;
    } catch (_) {
      return null;
    }
  }

  function isJsonPageSpec(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    if (!("h1" in obj)) return false;
    if (!Array.isArray(obj.blocks)) return false;
    return true;
  }

  function checkFragmentContract(fragmentText) {
    const c = canon();
    const t = safeText(fragmentText);

    // Forbid patterns
    for (const fp of c.fragment.forbidPatterns) {
      if (fp.re.test(t)) {
        return { ok: false, rule: fp.id, msg: fp.msg };
      }
    }

    if (c.fragment.requireSingleRootSectionCard) {
      const matches = [...t.matchAll(/<section\b[^>]*class\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi)];
      if (matches.length !== 1) {
        return { ok: false, rule: "FRAG_ONE_CARD_SECTION", msg: "Fragment must contain exactly one <section class=\"card\">...</section> root." };
      }
      const outside = t.replace(matches[0][0], "").replace(/\s+/g, "").trim();
      if (outside !== "") {
        return { ok: false, rule: "FRAG_NO_OUTSIDE_CONTENT", msg: "Fragment must not contain content outside the single <section class=\"card\"> root." };
      }
    }

    return { ok: true };
  }

  function checkTemplateStack(html) {
    const c = canon();
    const want = c.output.scriptStack.map((s) => {
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
    for (let i = 0; i < found.length; i++) if (!found[i].ok) missing.push(c.output.scriptStack[i].src + (c.output.scriptStack[i].type === "module" ? " (module)" : ""));
    return { okAll, okOrder, missing };
  }

  function runRules(text, findings) {
    const c = canon();
    for (const r of c.rules) {
      const pass = !!r.test(text);
      findings.push({
        rule: r.id,
        severity: r.severity,
        status: pass ? "PASS" : "FAIL",
        desc: r.desc,
        evidence: pass ? "" : r.evidence
      });
    }
  }

  function computeScore(findings) {
    const penalty = findings.reduce((acc, f) => {
      if (f.status === "PASS") return acc;
      if (f.severity === "CRITICAL") return acc + 20;
      if (f.severity === "MAJOR") return acc + 10;
      if (f.severity === "MINOR") return acc + 4;
      return acc;
    }, 0);
    return Math.max(0, Math.min(100, Math.round(100 - penalty)));
  }

  function formatReport(obj) {
    const lines = [];
    lines.push("SHARPESYSTEM VALIDIZER REPORT");
    lines.push("Time: " + obj.at);
    lines.push("Score: " + obj.score + "/100");
    lines.push("Input: " + obj.inputType);
    if (obj.note) lines.push("Note: " + obj.note);
    lines.push("");
    lines.push("Findings:");
    lines.push("Severity | Rule | Status | Description | Evidence");
    lines.push("--------------------------------------------------");
    for (const f of obj.findings) {
      lines.push(`${f.severity} | ${f.rule} | ${f.status} | ${f.desc} | ${f.evidence}`);
    }
    if (obj.renderedFragment) {
      lines.push("");
      lines.push("Rendered Fragment Preview (first 240 chars):");
      lines.push(safeText(obj.renderedFragment).slice(0, 240));
    }
    return lines.join("\n");
  }

  function savePayload(inputText, reportText) {
    const payload = { at: nowISO(), input: safeText(inputText), reportText: safeText(reportText) };
    try { sessionStorage.setItem(KEY_PAYLOAD, JSON.stringify(payload)); } catch (_) {}
  }

  function validate(inputText) {
    const raw = safeText(inputText || "");
    const findings = [];

    // JSON mode
    const parsed = tryParseJson(raw);
    if (parsed && isJsonPageSpec(parsed)) {
      let fragment = "";
      try {
        fragment = renderer().renderFragmentFromJson(parsed);
      } catch (e) {
        findings.push({
          rule: "JSON-SCHEMA",
          severity: "CRITICAL",
          status: "FAIL",
          desc: "JSON spec invalid (must include h1 + blocks with supported types)",
          evidence: e && e.message ? e.message : String(e)
        });
        // still run global rules on raw input
        runRules(raw, findings);
        const score = computeScore(findings);
        return { at: nowISO(), score, inputType: "json", findings, note: "JSON rejected; no fragment rendered." };
      }

      // Fragment contract on rendered output
      const frag = checkFragmentContract(fragment);
      findings.push({
        rule: "FRAG-CONTRACT",
        severity: "CRITICAL",
        status: frag.ok ? "PASS" : "FAIL",
        desc: frag.ok ? "Rendered fragment satisfies fragment contract" : frag.msg,
        evidence: frag.ok ? "" : frag.rule
      });

      // Run global rules on rendered fragment (what will actually ship)
      runRules(fragment, findings);

      const score = computeScore(findings);
      return { at: nowISO(), score, inputType: "json", findings, renderedFragment: fragment };
    }

    // HTML mode
    const isFull = detectIsFullHtml(raw);

    if (!isFull) {
      const frag = checkFragmentContract(raw);
      findings.push({
        rule: "FRAG-CONTRACT",
        severity: "CRITICAL",
        status: frag.ok ? "PASS" : "FAIL",
        desc: frag.ok ? "Fragment contract satisfied" : frag.msg,
        evidence: frag.ok ? "" : frag.rule
      });
    } else {
      findings.push({
        rule: "FRAG-CONTRACT",
        severity: "MINOR",
        status: "PASS",
        desc: "Fragment contract skipped (full HTML input)",
        evidence: ""
      });
    }

    runRules(raw, findings);

    if (isFull) {
      const stack = checkTemplateStack(raw);
      findings.push({
        rule: "C5",
        severity: "MAJOR",
        status: stack.okAll ? "PASS" : "FAIL",
        desc: "Canonical script stack present",
        evidence: stack.okAll ? "" : ("Missing: " + stack.missing.join(", "))
      });
      findings.push({
        rule: "C5-ORDER",
        severity: "MAJOR",
        status: stack.okOrder ? "PASS" : "FAIL",
        desc: "Canonical script stack order correct",
        evidence: stack.okOrder ? "" : "Scripts present but order differs from canon"
      });
    } else {
      findings.push({
        rule: "C5",
        severity: "MINOR",
        status: "PASS",
        desc: "Template stack check skipped (fragment input)",
        evidence: ""
      });
    }

    const score = computeScore(findings);
    return { at: nowISO(), score, inputType: isFull ? "full-html" : "fragment", findings };
  }

  function init() {
    const inCode = $("inCode");
    const report = $("report");
    const btnValidate = $("btnValidate");
    const btnClear = $("btnClear");
    const btnCopyReport = $("btnCopyReport");
    const btnDownloadReport = $("btnDownloadReport");
    const btnToCanon = $("btnToCanon");

    if (!inCode || !report || !btnValidate || !btnClear || !btnCopyReport || !btnDownloadReport || !btnToCanon) {
      console.error("Validizer UI missing expected elements.");
      if (report) report.textContent = "Validizer failed to initialize: UI elements missing.";
      return;
    }

    btnValidate.addEventListener("click", () => {
      const obj = validate(inCode.value || "");
      report.textContent = formatReport(obj);
      savePayload(inCode.value || "", report.textContent || "");
    });

    // Store on handoff click; navigation is handled by <a href=...>
    btnToCanon.addEventListener("click", () => {
      if (!report.textContent) {
        const obj = validate(inCode.value || "");
        report.textContent = formatReport(obj);
      }
      savePayload(inCode.value || "", report.textContent || "");
    });

    btnClear.addEventListener("click", () => {
      inCode.value = "";
      report.textContent = "";
      try { sessionStorage.removeItem(KEY_PAYLOAD); } catch (_) {}
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
