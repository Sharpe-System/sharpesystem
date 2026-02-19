/* /tools/canonizer.js
   Canonizer v3 (canon-locked + Validizer handoff loader)

   HARD:
   - Wrap ONLY fragments.
   - If input contains <html OR <body OR <main class="page"> treat as full page and SANITIZE, not wrap.
   - Output invariants are NON-NEGOTIABLE: exactly one doctype, body.shell, header mount, main.page/container,
     and required script stack including gate.js (in OUTPUT), with no duplicates/omissions.

   TOOL HARD:
   - No Firebase
   - No redirects
   - No network calls
   - No auth checks
   - Uses shared canon rules from /tools/canon-rules.js

   HANDOFF:
   - Reads sessionStorage key SHS_CANON_PAYLOAD written by Validizer
   - Loads payload.input into #inCode
*/

(function () {
  "use strict";

  const PAYLOAD_KEY = "SHS_CANON_PAYLOAD";

  function $(id) { return document.getElementById(id); }
  function nowISO() { return new Date().toISOString(); }
  function safeText(s) { return String(s ?? ""); }

  function getCanon() {
    const c = window.SHARPE_CANON_RULES;
    if (!c) throw new Error("Missing SHARPE_CANON_RULES. Ensure /tools/canon-rules.js is loaded before canonizer.js.");
    return c;
  }

  function setOut(el, text) {
    if (!el) return;
    const t = safeText(text);
    if ("value" in el) el.value = t;
    else el.textContent = t;
  }
  function getOut(el) {
    if (!el) return "";
    if ("value" in el) return el.value || "";
    return el.textContent || "";
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

  // HARD rule detection
  function isFullPageLike(input) {
    const t = safeText(input);
    if (/<\s*html\b/i.test(t)) return true;
    if (/<\s*body\b/i.test(t)) return true;
    if (/<\s*main\b[^>]*class\s*=\s*["'][^"']*\bpage\b/i.test(t)) return true;
    return false;
  }

  function stripScriptsAndShellMarkers(s) {
    let t = safeText(s);

    // Remove ALL scripts from pasted input (Canonizer injects required stack itself)
    t = t.replace(/<\s*script\b[\s\S]*?<\/script\s*>/gi, "");

    // Remove canonical mount if present
    t = t.replace(/<div[^>]+id=["']site-header["'][^>]*>\s*<\/div>/gi, "");

    // Remove doctype/html/head/body wrappers if present
    t = t.replace(/<!doctype[\s\S]*?>/gi, "");
    t = t.replace(/<\s*html\b[\s\S]*?>/gi, "");
    t = t.replace(/<\/\s*html\s*>/gi, "");
    t = t.replace(/<\s*head\b[\s\S]*?>/gi, "");
    t = t.replace(/<\/\s*head\s*>/gi, "");
    t = t.replace(/<\s*body\b[\s\S]*?>/gi, "");
    t = t.replace(/<\/\s*body\s*>/gi, "");

    return t.trim();
  }

  function extractInnerFromFullPage(fullInput) {
    const html = safeText(fullInput);

    // Prefer content inside container content if it exists
    const container = /<div\b[^>]*class\s*=\s*["'][^"']*\bcontainer\b[^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
    if (container && container[1]) return container[1].trim();

    // Else prefer main.page
    const main = /<main\b[^>]*class\s*=\s*["'][^"']*\bpage\b[^"']*["'][^>]*>([\s\S]*?)<\/main>/i.exec(html);
    if (main && main[1]) return main[1].trim();

    // Else body inner
    const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (body && body[1]) return body[1].trim();

    // Fallback: entire input
    return html.trim();
  }

  function normalizeForFragmentOnly(inner) {
    let t = safeText(inner);

    // Remove nested <main> wrappers if present
    t = t.replace(/<\s*main\b[^>]*>/gi, "");
    t = t.replace(/<\/\s*main\s*>/gi, "");

    // Remove nested container/content wrapper opens (conservative)
    t = t.replace(/<div\b[^>]*class\s*=\s*["'][^"']*\bcontainer\b[^"']*\bcontent\b[^"']*["'][^>]*>/gi, "");

    return t.trim();
  }

  function canonicalShell(canon, title, description, inner) {
    const t = safeText(title || "Page — SharpeSystem");
    const d = safeText(description || "").replace(/"/g, "&quot;");
    const out = canon.output;

    const scripts = out.scriptStack.map((s) => {
      if (s.type === "module") return `<script type="module" src="${s.src}"></script>`;
      return `<script src="${s.src}"></script>`;
    }).join("\n");

    return `<!doctype html>
<html lang="${out.lang}">
<head>
  <meta charset="utf-8" />
  <title>${t}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${d}" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="${out.bodyClass}">
<div id="${out.headerMountId}"></div>
<main class="${out.mainClass}">
  <div class="${out.containerClass}">
${safeText(inner || "").trim() ? "\n    " + safeText(inner).trim().replace(/\n/g, "\n    ") + "\n" : "\n"}
  </div>
</main>
${scripts}
</body>
</html>`;
  }

  function deriveTitleFromInner(inner) {
    const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(safeText(inner));
    if (!m) return "Page — SharpeSystem";
    const raw = m[1].replace(/<[^>]+>/g, "").trim();
    return raw ? `${raw} — SharpeSystem` : "Page — SharpeSystem";
  }

  function enforceNoDuplicateInvariants(output) {
    const t = safeText(output);

    const doctypeCount = (t.match(/<!doctype\s+html/gi) || []).length;
    if (doctypeCount !== 1) throw new Error("Invariant violation: output must contain exactly one <!doctype html>.");

    const bodyCount = (t.match(/<body\b[^>]*class=["'][^"']*\bshell\b[^"']*["']/gi) || []).length;
    if (bodyCount !== 1) throw new Error("Invariant violation: output must contain exactly one <body class=\"shell\">.");

    const headMountCount = (t.match(/<div\b[^>]*id=["']site-header["'][^>]*>/gi) || []).length;
    if (headMountCount !== 1) throw new Error("Invariant violation: output must contain exactly one <div id=\"site-header\"></div>.");

    const mainCount = (t.match(/<main\b[^>]*class=["'][^"']*\bpage\b[^"']*["']/gi) || []).length;
    if (mainCount !== 1) throw new Error("Invariant violation: output must contain exactly one <main class=\"page\">.");

    const containerCount = (t.match(/<div\b[^>]*class=["'][^"']*\bcontainer\b[^"']*\bcontent\b[^"']*["']/gi) || []).length;
    if (containerCount !== 1) throw new Error("Invariant violation: output must contain exactly one <div class=\"container content\">.");
  }

  function canonize(input) {
    const canon = getCanon();
    const raw = safeText(input).trim();
    if (!raw) {
      return { out: "", report: "Canonizer: no input provided.", mode: "none" };
    }

    const fullLike = isFullPageLike(raw);
    let inner;
    let mode;

    if (fullLike) {
      mode = "sanitize-full-page";
      inner = extractInnerFromFullPage(raw);
      inner = stripScriptsAndShellMarkers(inner);
      inner = normalizeForFragmentOnly(inner);
    } else {
      mode = "wrap-fragment";

      // Enforce fragment contract strictly
      const forbids = canon.fragment.forbidPatterns || [];
      for (const fp of forbids) {
        if (fp.re.test(raw)) {
          return {
            out: "",
            mode,
            report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: fragment
Result: REJECTED (fragment contract violation)
Violation: ${fp.id}
Message: ${fp.msg}`
          };
        }
      }

      const matches = [...raw.matchAll(/<section\b[^>]*class\s*=\s*["'][^"']*\bcard\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi)];
      if (matches.length !== 1) {
        return {
          out: "",
          mode,
          report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: fragment
Result: REJECTED (fragment contract violation)
Violation: FRAG_ONE_CARD_SECTION
Message: Fragment must contain exactly one <section class="card">...</section> root.`
        };
      }
      const outside = raw.replace(matches[0][0], "").replace(/\s+/g, "").trim();
      if (outside !== "") {
        return {
          out: "",
          mode,
          report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: fragment
Result: REJECTED (fragment contract violation)
Violation: FRAG_NO_OUTSIDE_CONTENT
Message: Fragment must not contain content outside the single <section class="card"> root.`
        };
      }

      inner = raw.trim();
    }

    const title = deriveTitleFromInner(inner);
    const out = canonicalShell(canon, title, "", inner);

    try {
      enforceNoDuplicateInvariants(out);
    } catch (e) {
      return {
        out: "",
        mode,
        report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: ${fullLike ? "full-page-like" : "fragment"}
Result: FAILED (output invariant violation)
Error: ${e && e.message ? e.message : String(e)}`
      };
    }

    const report =
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: ${fullLike ? "full-page-like" : "fragment"}
Mode: ${mode}
Action: ${fullLike ? "Sanitized into single canonical shell" : "Wrapped fragment into canonical shell"}

Notes:
- Tools pages are gate-exempt; Canonizer OUTPUT still injects gate.js (required invariant).
- No Firebase imports added.
- No redirects/auth checks performed by tools.
- Output invariants enforced: single doctype/body.shell/header mount/main.page/container content + full script stack.`;

    return { out, report, mode };
  }

  function loadFromValidizerHandoff(inCode, reportEl) {
    try {
      const raw = sessionStorage.getItem(PAYLOAD_KEY);
      if (!raw) return false;

      const payload = JSON.parse(raw);
      const input = safeText(payload && payload.input ? payload.input : "");
      if (!input) return false;

      inCode.value = input;

      if (reportEl) {
        reportEl.textContent =
`Loaded input from Validizer handoff.
Time: ${safeText(payload.at || "")}

(Click Canonize to generate output.)`;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function init() {
    const inCode = $("inCode");
    const outCode = $("outCode");
    const report = $("report");
    const btnCanonize = $("btnCanonize");
    const btnCopyOut = $("btnCopyOut");
    const btnDownloadOut = $("btnDownloadOut");
    const btnClear = $("btnClear");

    if (!inCode || !outCode || !report || !btnCanonize || !btnCopyOut || !btnDownloadOut || !btnClear) {
      console.error("Canonizer UI missing expected elements. Replace /tools/canonizer*.html and /tools/canonizer.js as a matched pair.");
      if (report) report.textContent = "Canonizer failed to initialize: UI elements missing.";
      return;
    }

    // NEW: prefill from Validizer handoff if present
    loadFromValidizerHandoff(inCode, report);

    btnCanonize.addEventListener("click", () => {
      const res = canonize(inCode.value || "");
      setOut(outCode, res.out);
      report.textContent = res.report;
    });

    btnCopyOut.addEventListener("click", async () => {
      await safeCopy(getOut(outCode));
    });

    btnDownloadOut.addEventListener("click", () => {
      download("canon-output.html", getOut(outCode), "text/html");
    });

    btnClear.addEventListener("click", () => {
      inCode.value = "";
      setOut(outCode, "");
      report.textContent = "";
      try { sessionStorage.removeItem(PAYLOAD_KEY); } catch (_) {}
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
