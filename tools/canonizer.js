/* /tools/canonizer.js
   Canonizer (HTML + JSON mode) — route-first support.

   JSON truth:
   - Prefer "route": "/immigration/"
   - Derive "file": "immigration/index.html"
   - Title/description used for <title> and meta description
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
    if ((t.match(/<!doctype\s+html/gi) || []).length !== 1) throw new Error("Output must contain exactly one <!doctype html>.");
    if ((t.match(/<body\b[^>]*class=["'][^"']*\bshell\b[^"']*["']/gi) || []).length !== 1) throw new Error("Output must contain exactly one <body class=\"shell\">.");
    if ((t.match(/<div\b[^>]*id=["']site-header["'][^>]*>/gi) || []).length !== 1) throw new Error("Output must contain exactly one <div id=\"site-header\"></div>.");
    if ((t.match(/<main\b[^>]*class=["'][^"']*\bpage\b[^"']*["']/gi) || []).length !== 1) throw new Error("Output must contain exactly one <main class=\"page\">.");
    if ((t.match(/<div\b[^>]*class=["'][^"']*\bcontainer\b[^"']*\bcontent\b[^"']*["']/gi) || []).length !== 1) throw new Error("Output must contain exactly one <div class=\"container content\">.");
  }

  function canonize(inputText) {
    const raw = safeText(inputText || "").trim();
    if (!raw) {
      return { out: "", report: "Canonizer: no input provided.", mode: "none", filename: "index.html" };
    }

    // JSON mode (route-first)
    const parsed = tryParseJson(raw);
    if (parsed && isJsonPageSpec(parsed)) {
      let fragment = "";
      let norm = null;

      try {
        norm = renderer().normalizeSpec(parsed); // enforces route/file consistency
        fragment = renderer().renderFragmentFromJson(parsed);
      } catch (e) {
        return {
          out: "",
          mode: "json-rejected",
          filename: "index.html",
          report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: json
Result: REJECTED
Error: ${e && e.message ? e.message : String(e)}`
        };
      }

      const title = (norm.title ? norm.title : deriveTitleFromInner(fragment)) || "Page — SharpeSystem";
      const desc = norm.oneSentence || "";
      const out = canonicalShell(title, desc, fragment);

      try { enforceOutputInvariants(out); }
      catch (e) {
        return {
          out: "",
          mode: "json-failed",
          filename: norm.file || "index.html",
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
        filename: norm.file || "index.html",
        report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: json
Mode: json->fragment->wrap
Route: ${norm.route || "(none)"}
File: ${norm.file || "(none)"}
Action: rendered fragment deterministically, then wrapped into canonical page shell

Notes:
- Tools are gate-exempt; OUTPUT pages include gate.js per canon invariants.
- No Firebase imports added.
- No redirects/auth checks performed by tools.
- Output invariants enforced.`
      };
    }

    // HTML mode
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
        filename: "index.html",
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
      filename: "index.html",
      report:
`SHARPESYSTEM CANONIZER REPORT
Time: ${nowISO()}
Input: ${fullLike ? "full-page-like" : "fragment"}
Mode: ${mode}
Action: ${fullLike ? "Sanitized into single canonical shell" : "Wrapped fragment into canonical shell"}

Notes:
- Tools are gate-exempt; OUTPUT pages include gate.js per canon invariants.
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
      outCode.dataset.filename = res.filename || "index.html";
    });

    btnCopyOut.addEventListener("click", async () => {
      await safeCopy(outCode.value || "");
    });

    btnDownloadOut.addEventListener("click", () => {
      const fn = outCode.dataset.filename || "index.html";
      download(fn, outCode.value || "", "text/html");
    });

    btnClear.addEventListener("click", () => {
      inCode.value = "";
      outCode.value = "";
      report.textContent = "";
      outCode.dataset.filename = "index.html";
      try { sessionStorage.removeItem(KEY_PAYLOAD); } catch (_) {}
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
