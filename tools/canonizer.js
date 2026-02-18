
/* /tools/canonizer.js
   Canonizer — offline wrapper/refiner (NO Firebase imports)
   - Reads prior payload from sessionStorage (optional)
   - Produces canon-stable HTML page shell if input is a fragment
   - Never redirects, never gates, never imports Firebase
*/

(function () {
  "use strict";

  const KEY = "SHARPESYSTEM_VALIDIZER_PAYLOAD_v1";

  function $(id) { return document.getElementById(id); }

  function nowISO() { return new Date().toISOString(); }

  function safeCopy(text) {
    const t = String(text ?? "");
    if (!t) return;
    navigator.clipboard?.writeText(t).catch(() => {});
  }

  function download(name, text, mime = "text/plain") {
    const blob = new Blob([String(text ?? "")], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  function isFullHtml(doc) {
    const t = String(doc || "");
    return /<!doctype html>/i.test(t) && /<html[\s>]/i.test(t);
  }

  function wrapAsCanonPage(title, bodyInner) {
    // Canon page shell + canonical script stack
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="" />
  <link rel="stylesheet" href="/styles.css" />
</head>

<body class="shell">
  <div id="site-header"></div>

  <main class="page">
    <div class="container content">
      <section class="template-box">
${bodyInner}
      </section>
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

  function canonize(input) {
    const raw = String(input ?? "").trim();

    const report = [];
    report.push("SHARPESYSTEM CANONIZER REPORT");
    report.push(`Time: ${nowISO()}`);
    report.push("");

    if (!raw) {
      report.push("FAIL: empty input");
      return { out: "", report: report.join("\n") };
    }

    // If it already looks like full HTML, do not rewrite structure.
    if (isFullHtml(raw)) {
      report.push("PASS: input is full HTML (no wrapping applied).");
      report.push("NOTE: Canonizer does not reorder or rewrite full documents.");
      return { out: raw, report: report.join("\n") };
    }

    // Otherwise treat as “body fragment” and wrap into canon shell.
    report.push("PASS: input is a fragment → wrapped into canon page shell.");
    report.push("NOTE: Update <title> + <h1> + description after paste if needed.");

    // If fragment does not include <h1>, add a safe default.
    const hasH1 = /<h1[\s>]/i.test(raw);
    const bodyInner = hasH1
      ? raw
      : `        <h1>Page</h1>
        <p class="muted"></p>

        <div class="card" style="padding:var(--pad); margin-top:12px;">
${raw.split("\n").map(l => "          " + l).join("\n")}
        </div>`;

    const out = wrapAsCanonPage("Page — SharpeSystem", bodyInner);
    return { out, report: report.join("\n") };
  }

  function loadPayloadIntoInput() {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      // If Validizer stored original input, prefer that.
      if (payload && typeof payload.input === "string" && payload.input.trim()) {
        $("inCode").value = payload.input;
        $("report").textContent =
          "Loaded prior Validizer payload from sessionStorage.\n" +
          "Click Canonize to generate canon output.\n";
      }
    } catch {
      // ignore
    }
  }

  function boot() {
    const inEl = $("inCode");
    const outEl = $("outCode");
    const repEl = $("report");

    $("btnCanonize").addEventListener("click", () => {
      const { out, report } = canonize(inEl.value);
      outEl.textContent = out;
      repEl.textContent = report;
      // Store last output (optional)
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ at: nowISO(), input: inEl.value, output: out }));
      } catch {}
    });

    $("btnCopyOut").addEventListener("click", () => safeCopy(outEl.textContent));

    $("btnDownloadOut").addEventListener("click", () => {
      const out = outEl.textContent || "";
      const name = isFullHtml(out) ? "canon.html" : "canon.txt";
      download(name, out, isFullHtml(out) ? "text/html" : "text/plain");
    });

    $("btnClear").addEventListener("click", () => {
      inEl.value = "";
      outEl.textContent = "";
      repEl.textContent = "";
      try { sessionStorage.removeItem(KEY); } catch {}
    });

    loadPayloadIntoInput();
  }

  boot();
})();
