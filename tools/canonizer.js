/* /tools/canonizer.js
   Canon wrapper/refiner.
   Guarantees:
   - No Firebase imports
   - No redirects
   - No gating logic
   Output is a canonical SharpeSystem page shell + pasted content inserted once.
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
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) { return false; }
  }

  function loadValidizerPayload() {
    try {
      const raw = sessionStorage.getItem(KEY_PAYLOAD);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function looksLikeFullHtml(text) {
    const t = safeText(text).trim();
    return /<!doctype\s+html/i.test(t) || /^<html[\s>]/i.test(t) || /<head[\s>]/i.test(t);
  }

  function extractBodyContent(fullHtml) {
    const html = safeText(fullHtml);
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (!bodyMatch) return html;
    return bodyMatch[1];
  }

  function stripCanonicalWrappers(fragmentOrBody) {
    // Remove duplicated canonical wrappers if someone pasted a full page or partial shell
    let s = safeText(fragmentOrBody);

    // Remove nested <main class="page">...</main> wrappers (keep inner content)
    s = s.replace(/<main[^>]*class=["'][^"']*\bpage\b[^"']*["'][^>]*>/gi, "");
    s = s.replace(/<\/main>/gi, "");

    // Remove duplicated container/content wrappers
    s = s.replace(/<div[^>]*class=["'][^"']*\bcontainer\b[^"']*["'][^>]*>/gi, "");
    s = s.replace(/<div[^>]*class=["'][^"']*\bcontent\b[^"']*["'][^>]*>/gi, "");
    s = s.replace(/<\/div>\s*<\/div>/gi, "</div>"); // soft collapse
    // NOTE: intentionally conservative; goal is “don’t double wrap”.

    return s.trim();
  }

  function canonicalShell({ title, description, inner }) {
    const t = safeText(title || "Page — SharpeSystem");
    const d = safeText(description || "");
    const content = safeText(inner || "");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${t}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${d.replace(/"/g, "&quot;")}" />
  <link rel="stylesheet" href="/styles.css" />
</head>

<body class="shell">
  <div id="site-header"></div>

  <main class="page">
    <div class="container content">

      ${content}

    </div>
  </main>

  <script src="/ui.js"></script>
  <script src="/header-loader.js"></script>
  <script src="/partials/header.js"></script>
  <script src="/i18n.js"></script>
  <script type="module" src="/gate.js"></script>
</body>
</html>`;
  }

  function deriveTitle(text) {
    // If a fragment contains <h1>, use that.
    const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(text);
    if (!m) return "Page — SharpeSystem";
    const raw = m[1].replace(/<[^>]+>/g, "").trim();
    if (!raw) return "Page — SharpeSystem";
    return `${raw} — SharpeSystem`;
  }

  function canonize(input) {
    const raw = safeText(input || "").trim();
    if (!raw) {
      return { out: "", report: "Canonizer: no input provided." };
    }

    const isFull = looksLikeFullHtml(raw);

    let bodyOrFrag = raw;
    if (isFull) bodyOrFrag = extractBodyContent(raw);

    // Strip duplicate wrappers so output never becomes double-nested
    const cleaned = stripCanonicalWrappers(bodyOrFrag);

    // If what remains still contains site-header mount or scripts, treat as “body paste” and strip again.
    const safer = cleaned
      .replace(/<div[^>]+id=["']site-header["'][^>]*>\s*<\/div>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .trim();

    const title = deriveTitle(safer);
    const out = canonicalShell({ title, description: "", inner: safer });

    const reportLines = [];
    reportLines.push("SHARPESYSTEM CANONIZER REPORT");
    reportLines.push("Time: " + nowISO());
    reportLines.push("Input: " + (isFull ? "full-html" : "fragment"));
    reportLines.push("Action: wrapped content into canonical page shell (no double main/container).");
    reportLines.push("");
    reportLines.push("Notes:");
    reportLines.push("- Firebase imports: none added.");
    reportLines.push("- Redirects/gating: none added.");
    reportLines.push("- Canonical stack injected: ui.js, header-loader.js, partials/header.js, i18n.js, gate.js (module).");

    return { out, report: reportLines.join("\n") };
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
      console.error("Canonizer UI missing expected elements. Check canonizer.html IDs.");
      if (report) report.textContent = "Canonizer failed to initialize: UI elements missing. Replace /tools/canonizer.html and /tools/canonizer.js as a matched pair.";
      return;
    }

    // Auto-load payload from Validizer handoff (if present)
    const payload = loadValidizerPayload();
    if (payload && typeof payload.input === "string" && payload.input.trim()) {
      inCode.value = payload.input;
      report.textContent = payload.reportText || "";
    }

    btnCanonize.addEventListener("click", () => {
      const res = canonize(inCode.value);
      outCode.textContent = res.out;
      report.textContent = res.report;
    });

    btnCopyOut.addEventListener("click", async () => {
      const txt = outCode.textContent || "";
      await safeCopy(txt);
    });

    btnDownloadOut.addEventListener("click", () => {
      const txt = outCode.textContent || "";
      download("canon-output.html", txt, "text/html");
    });

    btnClear.addEventListener("click", () => {
      inCode.value = "";
      outCode.textContent = "";
      report.textContent = "";
      try { sessionStorage.removeItem(KEY_PAYLOAD); } catch (_) {}
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
