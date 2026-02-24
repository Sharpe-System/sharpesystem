/* /print.js
   Immutable print surface: /print.html?job=
   Loads job from /api/jobs/:jobId
   If renderUrl + pdfUrl exist, show side-by-side.
*/

(async function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const jobId = (params.get("job") || "").trim();

  const container = document.getElementById("print-body");
  if (!container) return;

  if (!jobId) {
    container.innerHTML = "<p>No job ID provided.</p>";
    return;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  try {
    const res = await fetch("/api/jobs/" + encodeURIComponent(jobId), {
      headers: { "accept": "application/json" }
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json) {
      container.innerHTML = "<pre>" + esc(JSON.stringify(json || { ok: false }, null, 2)) + "</pre>";
      return;
    }

    const renderUrl = (json.renderUrl || "").trim();
    const pdfUrl = (json.pdfUrl || "").trim();

    // Nothing usable
    if (!renderUrl && !pdfUrl) {
      container.innerHTML = "<pre>" + esc(JSON.stringify(json, null, 2)) + "</pre>";
      return;
    }

    // Toolbar + layout
    container.innerHTML = `
      <div class="print-toolbar">
        <button class="print-btn" type="button" onclick="window.print()">Print</button>
        <span class="print-meta">Job: <code>${esc(jobId)}</code></span>
      </div>

      <div class="print-grid">
        ${renderUrl ? `
          <section class="print-pane">
            <div class="print-pane-title">Print-perfect render (Path B)</div>
            <iframe class="print-frame" src="${esc(renderUrl)}"></iframe>
          </section>
        ` : ""}

        ${pdfUrl ? `
          <section class="print-pane">
            <div class="print-pane-title">Official FL-300 PDF (Path A)</div>
            <iframe class="print-frame" src="${esc(pdfUrl)}"></iframe>
          </section>
        ` : ""}
      </div>

      <details class="print-debug">
        <summary>Debug job JSON</summary>
        <pre>${esc(JSON.stringify(json, null, 2))}</pre>
      </details>
    `;
  } catch (err) {
    container.innerHTML = "<pre>" + esc(String(err?.message || err)) + "</pre>";
  }
})();
