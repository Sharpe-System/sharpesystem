/* /tools/canonizer.js
   Canonizer (HTML + JSON mode)

   HARD:
   - Wrap only fragments.
   - If input contains <html OR <body OR <main class="page"> treat as full page-like and sanitize, not wrap.
   - Output invariants (for generated pages) enforced: single doctype, body.shell, header mount, main.page/container,
     and required script stack.

   TOOL HARD:
   - No Firebase
   - No redirects
   - No network calls
   - No auth checks

   Handoff:
   - Reads sessionStorage "shs_validizer_payload_v1"
*/

(function () {
  "use strict";

  const KEY_PAYLOAD = "shs_validizer_payload_v1";

  function $(id) { return document.getElementById(id); }
  function nowISO() { return new Date().toISOString(); }
  function safeText(s) { return String(s ?? ""); }

  function canon() {
    const c = window.SHS_CANON;
    if (!c) throw new Error("Missing SHS_CANON. Load /tools/canon-rules.js before canonizer.js.");
    return c;
  }

  function renderer() {
    const r = window.SHS_RENDERER;
    if (!r) throw new Error("Missing SHS_RENDERER. Load /tools/renderer.js before canonizer.js.");
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

  function tryParseJson(text) {
    const t = safeText(text).trim();
    if (!(t.startsWith("{") || t.startsWith("["))) return null;
    try { return JSON.parse(t); } catch (_) { return null; }
  }

  function isJsonPageSpec(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    if (!("h1" in obj)) return false;
    if (!Array.isArray(obj.blocks)) return false;
    return true;
  }

  function isFullPageLike(input) {
    const t = safeText(input);
    if (/<\s*html\b/i.test(t)) return true;
    if (/<\s*body\b/i.test(t)) return true;
    if (/<\s*main\b[^>]*class\s*=\s*["'][^"']*\bpage\b/i.test(t)) return true;
    if (/<!doctype\s+html/i.test(t)) return true;
    return false;
  }

  function stripScriptsAndShellMarkers(s) {
    let t = safeText(s);

    t = t.replace(/<\s*script\b[\s\S]*?<\/script\s*>/gi, "");
    t = t.replace(/<div[^>]+id=["']site-header["'][^>]*>\s*<\/div>/gi, "");

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

    const container = /<div\b[^>]*class\s*=\s*["'][^"']*\bcontainer\b[^"']*\bcontent\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
    if (container && container[1]) return container[1].trim();

    const main = /<main\b[^>]*class\s*=\s*["'][^"']*\bpage\b[^"']*["'][^>]*>([\s\S]*?)<\/main>/i.exec(html);
    if (main && main[1]) return main[1].trim();

    const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (body && body[1]) return body[1].trim();

    return html.trim();
  }

  function normalizeForFragmentOnly(inner) {
    let t = safeText(inner);
    t = t.replace(/<\s*main\b[^>]*>/gi, "");
    t = t.replace(/<\/\s*main\s*>/gi, "");
    t = t.replace(/<div\b[^>]*class\s*=\s*["'][^"']*\bcontainer\b[^"']*\bcontent\b[^"']*["'][^>]*>/gi, "");
    return t.trim();
  }

  function deriveTitleFromInner(inner) {
    const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(safeText(inner));
    if (!m) return "Page — SharpeSystem";
    const raw = m[1].replace(/<[^>]+>/g, "").trim();
    return raw ? `${raw} — SharpeSystem` : "Page — SharpeSystem";
  }

  function canonicalShell(title, description, inner) {
    const c = canon();
    const out = c.output;

    const t = safeText(title || "Page — SharpeSystem");
    const d = safeText(description || "").replace(/"/g, "&quot;");

    const scripts = out.scriptStack.map((s) => {
      if (s.type === "module") return `<script type="module" src="${s.src}"></script>`;
      return `<script src="${s.src}"></script>`;
    }).join("\n");

    const innerTrim = safeText(inner || "").trim();
    const indented = innerTrim ? "\n    " + innerTrim.replace(/\n/g, "\n    ") + "\n" : "\n";

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
  <div class="${out.containerClass}">${indented}  </div>
</main>
${scripts}
</body>
</html>`;
  }

  function enforceOutputInvariants(output) {
    const t = safeText(output);

    const doctypeCount = (t.match(/<!doctype\s+html/gi) || []).length;
    if (doctypeCount !== 1) throw new Error("Output must contain exactly one <!doctype html>.");

    const bodyCount = (t.match(/<body\b[^>]*class=["'][^"']*\bshell\b[^"']*["']/gi) || []).length;
    if (bodyCount !== 1) throw new Error("Output must contain exactly one <body class=\"shell\">.");

    const headerCount = (t.match(/<div\b[^>]*id=["']site-header["'][^>]*>/gi) || []).length;
    if (headerCount !== 1) throw new Error("Output must contain exactly one <div id=\"site-header\"></div>.");

    const mainCount = (t.match(/<main\b[^>]*class=["'][^"']*\bpage\b[^"']*["']/gi) || []).length;
    if (mainCount !== 1) throw new Error("Output must contain exactly one <main class=\"page\">.");

    const containerCount = (t.match(/<div\b[^>]*class=["'][^"']*\bcontainer\b[^"']*\bcontent\b[^"']*["']/gi) || []).length;
    if (containerCount !== 1) throw new Error("Output must contain exactly one <div class=\"container content\">.");
  }

  function canonize(inputText) {
    const raw = safeText(inputText || "").trim();
    if (!raw) {
      return { out: "", report: "Canonizer: no input provided.", mode: "none", filename: "canon-output.html" };
    }

    // JSON mode -> render fragment deterministically
    const parsed = tryParseJson(raw);
    if (parsed && isJsonPageSpec(parsed)) {
      let fragment = "";
      try {
        fragment = renderer().renderFragmentFromJson(parsed);
      } catch (e) {
        return {
          out: "",
          mode: "json-rejected",
          filename: "canon-output.html",
          report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: json
Result: REJECTED (invalid JSON spec)
Error: ${e && e.message ? e.message : String(e)}`
        };
      }

      const title = (parsed.title ? String(parsed.title) : deriveTitleFromInner(fragment)) || "Page — SharpeSystem";
      const filename = (parsed.file ? String(parsed.file) : "canon-output.html") || "canon-output.html";
      const out = canonicalShell(title, String(parsed.oneSentence ?? ""), fragment);

      try { enforceOutputInvariants(out); }
      catch (e) {
        return {
          out: "",
          mode: "json-failed",
          filename,
          report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: json
Result: FAILED (output invariant violation)
Error: ${e && e.message ? e.message : String(e)}`
        };
      }

      return {
        out,
        mode: "json->fragment->wrap",
        filename,
        report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: json
Mode: json->fragment->wrap
Action: rendered fragment deterministically, then wrapped into canonical page shell

Notes:
- Tool page is gate-exempt; OUTPUT page includes gate.js per canon invariants.
- No Firebase imports added.
- No redirects/auth checks performed by tools.
- Output invariants enforced.`
      };
    }

    // HTML mode (fragment or full-page-like)
    const fullLike = isFullPageLike(raw);
    let inner = "";
    let mode = "";

    if (fullLike) {
      mode = "sanitize-full-page";
      inner = extractInnerFromFullPage(raw);
      inner = stripScriptsAndShellMarkers(inner);
      inner = normalizeForFragmentOnly(inner);
    } else {
      mode = "wrap-fragment";
      inner = raw;
    }

    const title = deriveTitleFromInner(inner);
    const out = canonicalShell(title, "", inner);

    try { enforceOutputInvariants(out); }
    catch (e) {
      return {
        out: "",
        mode,
        filename: "canon-output.html",
        report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: ${fullLike ? "full-page-like" : "fragment"}
Result: FAILED (output invariant violation)
Error: ${e && e.message ? e.message : String(e)}`
      };
    }

    return {
      out,
      mode,
      filename: "canon-output.html",
      report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: ${fullLike ? "full-page-like" : "fragment"}
Mode: ${mode}
Action: ${fullLike ? "Sanitized into single canonical shell" : "Wrapped fragment into canonical shell"}

Notes:
- Tool page is gate-exempt; OUTPUT page includes gate.js per canon invariants.
- No Firebase imports added.
- No redirects/auth checks performed by tools.
- Output invariants enforced.`
    };
  }

  function loadHandoff(inCode, reportEl) {
    try {
      const raw = sessionStorage.getItem(KEY_PAYLOAD);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      const input = safeText(payload && payload.input ? payload.input : "");
      if (!input) return false;
      inCode.value = input;
      if (reportEl) {
        reportEl.textContent =
`Loaded input from Validizer.
Time: ${safeText(payload.at || "")}

Click Canonize to generate output.`;
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
      console.error("Canonizer UI missing expected elements.");
      if (report) report.textContent = "Canonizer failed to initialize: UI elements missing.";
      return;
    }

    loadHandoff(inCode, report);

    btnCanonize.addEventListener("click", () => {
      const res = canonize(inCode.value || "");
      outCode.value = safeText(res.out);
      report.textContent = res.report;
      outCode.dataset.filename = res.filename || "canon-output.html";
    });

    btnCopyOut.addEventListener("click", async () => {
      await safeCopy(outCode.value || "");
    });

    btnDownloadOut.addEventListener("click", () => {
      const fn = outCode.dataset.filename || "canon-output.html";
      download(fn, outCode.value || "", "text/html");
    });

    btnClear.addEventListener("click", () => {
      inCode.value = "";
      outCode.value = "";
      report.textContent = "";
      outCode.dataset.filename = "canon-output.html";
      try { sessionStorage.removeItem(KEY_PAYLOAD); } catch (_) {}
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
