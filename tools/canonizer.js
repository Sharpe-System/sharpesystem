/* /tools/canonizer.js
   Canonizer — wraps imperfect HTML/JS into a canon page template.
   DOES NOT add Firebase imports. DOES NOT add gating logic. DOES NOT add redirects.
*/
(function () {
  "use strict";

  const KEY_PAYLOAD = "SHARPESYSTEM_VALIDIZER_PAYLOAD";

  function $(id) { return document.getElementById(id); }

  function safeCopy(text) {
    try { navigator.clipboard.writeText(text); return true; } catch { return false; }
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

  function loadFromValidizer() {
    try {
      const raw = sessionStorage.getItem(KEY_PAYLOAD);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function guessTitle(input) {
    const s = String(input || "");
    const m = s.match(/<h1[^>]*>([^<]{1,120})<\/h1>/i);
    if (m && m[1]) return m[1].trim();
    return "Page";
  }

  function stripOuterHTML(input) {
    const s = String(input || "").trim();

    // If it looks like full HTML, extract just the <main> content block if possible.
    if (/<html[\s>]/i.test(s)) {
      const main = s.match(/<main[\s\S]*?<\/main>/i);
      if (main && main[0]) return main[0];
      // fallback: return body inner
      const body = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (body && body[1]) return body[1].trim();
    }
    return s; // already fragment
  }

  function canonPageHTML({ title, inner }) {
    // Canon stack: header mount, ui.js, header-loader.js, partials/header.js, i18n.js, gate.js (module)
    // No Firebase, no redirects.
    const safeTitle = String(title || "Page").replace(/\s+/g, " ").trim();

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle} — SharpeSystem</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="" />
  <link rel="stylesheet" href="/styles.css" />
</head>

<body class="shell">
  <div id="site-header"></div>

  <main class="page">
    <div class="container content">
${inner}
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

  function makeDefaultInner(title) {
    const t = String(title || "Page").trim();
    return `      <section class="card" style="padding:var(--pad);">
        <h1>${t}</h1>
        <p class="muted">Describe this page.</p>
      </section>`;
  }

  function buildReport(input, output) {
    const lines = [];
    lines.push("SHARPESYSTEM CANONIZER REPORT");
    lines.push("");
    lines.push("Output guarantees:");
    lines.push("- Canon template stack present");
    lines.push("- No Firebase imports added");
    lines.push("- No gating logic added (gate.js remains sole gate)");
    lines.push("- No redirects added");
    lines.push("");
    lines.push("Notes:");
    lines.push("- If your input contained gating/redirects/Firebase imports, you must remove them BEFORE publishing.");
    lines.push("- Canonizer is a wrapper, not a mind reader: verify business logic and routes.manifest classification.");
    lines.push("");
    lines.push("Input chars: " + String(input || "").length);
    lines.push("Output chars: " + String(output || "").length);
    return lines.join("\n");
  }

  function canonize() {
    const inEl = $("inCode");
    const outEl = $("outCode");
    const repEl = $("report");

    const input = inEl ? inEl.value : "";
    const title = guessTitle(input);

    let inner = stripOuterHTML(input);
    if (!inner || !String(inner).trim()) inner = makeDefaultInner(title);

    // Indent inner consistently inside container
    const innerIndented = String(inner)
      .split("\n")
      .map((l) => (l.trim().length ? "      " + l : l))
      .join("\n");

    const output = canonPageHTML({ title, inner: innerIndented });

    if (outEl) outEl.value = output;
    if (repEl) repEl.textContent = buildReport(input, output);
  }

  function boot() {
    const payload = loadFromValidizer();
    const inEl = $("inCode");

    if (payload && inEl && typeof payload.input === "string" && payload.input.trim()) {
      inEl.value = payload.input;
    }

    const btnCanonize = $("btnCanonize");
    const btnCopy = $("btnCopyOutput");
    const btnDownload = $("btnDownloadOutput");

    if (btnCanonize) btnCanonize.addEventListener("click", canonize);

    if (btnCopy) {
      btnCopy.addEventListener("click", () => {
        const out = $("outCode") ? $("outCode").value : "";
        safeCopy(out || "");
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener("click", () => {
        const out = $("outCode") ? $("outCode").value : "";
        download("canonized.html", out || "", "text/html");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
