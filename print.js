/* /print.js
   Immutable print surface: /print.html?job=
   v1: reads job JSON from /api/jobs/:jobId
*/
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const jobId = (params.get("job") || "").trim();

  const host = document.querySelector("#print-body");

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  if (!jobId) {
    host.innerHTML = `<p class="muted">Missing job id. Use <code>/print.html?job=...</code></p>`;
    return;
  }

  host.innerHTML = `<p class="muted">Fetching job <code>${esc(jobId)}</code>…</p>`;

  fetch(`/api/jobs/${encodeURIComponent(jobId)}`)
    .then(async (r) => {
      const txt = await r.text();
      let json = null;
      try { json = JSON.parse(txt); } catch (_) {}
      if (!r.ok) throw new Error(json?.error || txt || `HTTP ${r.status}`);
      return json ?? { raw: txt };
    })
    .then((job) => {
      host.innerHTML = `
        <p class="muted">Job loaded.</p>
        <pre style="white-space:pre-wrap; overflow:auto; max-height:520px; padding:12px; border:1px solid rgba(127,127,127,.25); border-radius:12px;">${esc(JSON.stringify(job, null, 2))}</pre>
      `;
    })
    .catch((err) => {
      host.innerHTML = `<p class="muted">Failed to load job: <code>${esc(err?.message || err)}</code></p>`;
    });
})();
