// /tools/canonizer.js
// Canonizer — wraps fragment into SharpeSystem canon page + report
// NO Firebase. Pure client transform.

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const inCode = $("inCode");
  const outCode = $("outCode");
  const report = $("report");

  const btnCanonize = $("btnCanonize");
  const btnCopy = $("btnCopyOut");
  const btnDownload = $("btnDownloadOut");
  const btnClear = $("btnClear");

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function wrapCanon(fragment) {
    const cleaned = String(fragment || "").trim();

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SharpeSystem Page</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/styles.css" />
</head>

<body class="shell">
  <div id="site-header"></div>

  <main class="page">
    <div class="container content">
${cleaned}
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

  function runCanon() {
    const input = inCode.value || "";
    const output = wrapCanon(input);

    outCode.textContent = output;

    report.textContent =
`SHARPESYSTEM CANONIZER REPORT
Time: ${new Date().toISOString()}
Input length: ${input.length} chars
Output length: ${output.length} chars
Status: OK
`;
  }

  btnCanonize.addEventListener("click", runCanon);

  btnCopy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(outCode.textContent || "");
  });

  btnDownload.addEventListener("click", () => {
    const blob = new Blob([outCode.textContent || ""], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "canonized.html";
    a.click();
  });

  btnClear.addEventListener("click", () => {
    inCode.value = "";
    outCode.textContent = "";
    report.textContent = "";
  });

})();
