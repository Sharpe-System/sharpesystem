(async function () {
  "use strict";

  function $(sel) { return document.querySelector(sel); }

  const params = new URLSearchParams(location.search);
  const jobId = params.get("job");

  const container = document.getElementById("print-body");

  if (!jobId) {
    container.innerHTML = "<p>No job ID provided.</p>";
    return;
  }

  try {
    const res = await fetch("/api/jobs/" + encodeURIComponent(jobId));
    const json = await res.json();

    const src = (json && (json.renderUrl || json.pdfUrl)) || "";
    if (!res.ok || !src) {
      container.innerHTML = "<pre>" + JSON.stringify(json, null, 2) + "</pre>";
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom:12px;">
        <button onclick="window.print()" style="padding:8px 14px; font-size:14px;">Print</button>
        <span style="margin-left:10px; font: 12px system-ui; opacity:.7;">${json.renderUrl ? "Print-perfect render" : "PDF fallback"}</span>
      </div>
      <iframe src="${src}" style="width:100%; height:90vh; border:none;"></iframe>
    `;
  } catch (err) {
    container.innerHTML = "<pre>" + String(err) + "</pre>";
  }
})();
