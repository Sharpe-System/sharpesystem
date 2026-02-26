// FILE: /scripts/dashboard-ui.js  (OVERWRITE)
// UI-only dashboard implementation.
// - No backend assumptions
// - No auth/tier redirects (gate.js owns gating)
// - No entitlement logic
// - No global variables / no window.* state
//
// One-line swap hook: fetchJobs()

import { getJobsStub } from "/scripts/jobs-stub.js";

function $(id) { return document.getElementById(id); }

function setText(el, text) { if (el) el.textContent = text ?? ""; }
function show(el, on) { if (el) el.style.display = on ? "" : "none"; }

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function normalizeJob(j) {
  // Defensive: tolerate missing fields, keep rendering.
  const jobId = String(j?.jobId || "");
  return {
    jobId,
    flow: String(j?.flow || ""),
    form: String(j?.form || ""),
    title: (j?.title == null || j?.title === "") ? "" : String(j.title),
    caseNumber: (j?.caseNumber == null || j?.caseNumber === "") ? "" : String(j.caseNumber),
    county: (j?.county == null || j?.county === "") ? "" : String(j.county),
    pageCount: (typeof j?.pageCount === "number") ? j.pageCount : (j?.pageCount ?? null),
    createdAt: String(j?.createdAt || ""),
    downloadUrl: (j?.downloadUrl == null || j?.downloadUrl === "") ? "" : String(j.downloadUrl)
  };
}

// Deliverable #2: pure function renderer
export function renderJobsTable(jobs) {
  const frag = document.createDocumentFragment();

  for (const raw of jobs) {
    const j = normalizeJob(raw);
    const title = j.title || `${j.flow}/${j.form}` || j.jobId || "-";
    const type = `${j.flow || "-"} / ${j.form || "-"}`;
    const pages = (j.pageCount === null || j.pageCount === undefined) ? "-" : String(j.pageCount);
    const created = fmtDate(j.createdAt);

    const printUrl = j.jobId ? `/print.html?job=${encodeURIComponent(j.jobId)}` : "#";
    const downloadUrl = j.downloadUrl || "";

    const tr = document.createElement("tr");
    tr.setAttribute("data-jobid", j.jobId);

    // Optional: row-click opens Print (but don’t break text selection / button clicks)
    tr.addEventListener("click", (e) => {
      const t = e.target;
      if (t && (t.tagName === "A" || t.tagName === "BUTTON")) return;
      if (!j.jobId) return;
      window.open(printUrl, "_blank", "noopener");
    });

    tr.innerHTML = `
      <td data-label="Type">${escapeHtml(type)}</td>
      <td data-label="Title">${escapeHtml(title)}</td>
      <td data-label="Case #">${escapeHtml(j.caseNumber || "-")}</td>
      <td data-label="County">${escapeHtml(j.county || "-")}</td>
      <td data-label="Pages">${escapeHtml(pages)}</td>
      <td data-label="Created">${escapeHtml(created)}</td>
      <td data-label="Actions" class="ss-right ss-actions">
        <a class="ss-link" href="${printUrl}" target="_blank" rel="noopener">Print</a>
        ${downloadUrl ? `&nbsp;|&nbsp;<a class="ss-link" href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener">Download</a>` : ``}
        ${j.jobId ? `&nbsp;|&nbsp;<button type="button" class="ss-btn" data-copy="${escapeHtml(j.jobId)}">Copy ID</button>` : ``}
      </td>
    `.trim();

    frag.appendChild(tr);
  }

  return frag;
}

function attachCopyHandlers(container) {
  // delegated
  container.addEventListener("click", async (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("button[data-copy]") : null;
    if (!btn) return;
    const jobId = btn.getAttribute("data-copy") || "";
    if (!jobId) return;

    try {
      await navigator.clipboard.writeText(jobId);
      const old = btn.textContent;
      btn.textContent = "Copied";
      btn.disabled = true;
      setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 850);
    } catch {
      // non-fatal
      btn.textContent = "Copy failed";
      setTimeout(() => { btn.textContent = "Copy ID"; }, 900);
    }
  });
}

function sortJobsDefault(jobs) {
  // createdAt desc
  return [...jobs].sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));
}

function filterJobs(jobs, q) {
  const query = String(q || "").trim().toLowerCase();
  if (!query) return jobs;

  return jobs.filter((j) => {
    const title = String(j?.title || "").toLowerCase();
    const caseNo = String(j?.caseNumber || "").toLowerCase();
    const county = String(j?.county || "").toLowerCase();
    return title.includes(query) || caseNo.includes(query) || county.includes(query);
  });
}

// Deliverable #4: fetch layer with single swap line
async function fetchJobs() {
  // STUB (today)
  return getJobsStub();

  // SWAP LINE (later, API guy owns):
  // return await fetch("/api/jobs/list").then(r => r.json());
}

async function run() {
  const statusEl = $("statusText");
  const countEl = $("countText");
  const refreshBtn = $("refreshBtn");
  const searchBox = $("searchBox");

  const errorBox = $("errorBox");
  const emptyBox = $("emptyBox");
  const tableWrap = $("tableWrap");
  const loadingBox = $("loadingBox");
  const tbody = $("jobsTbody");

  const setState = ({ loading, error, empty, table }) => {
    show(loadingBox, !!loading);
    show(errorBox, !!error);
    show(emptyBox, !!empty);
    show(tableWrap, !!table);
  };

  const setError = (msg) => {
    errorBox.textContent = msg || "Unknown error.";
  };

  let allJobs = [];

  const render = () => {
    const filtered = filterJobs(allJobs, searchBox?.value || "");
    setText(countEl, filtered.length ? `${filtered.length} shown` : "");

    if (!filtered.length) {
      if (allJobs.length === 0) {
        setState({ loading: false, error: false, empty: true, table: false });
      } else {
        // no results due to filter
        setState({ loading: false, error: false, empty: true, table: false });
        emptyBox.querySelector("strong").textContent = "No matches";
        emptyBox.querySelector(".ss-muted").textContent = "Try a different search term.";
      }
      if (tbody) tbody.innerHTML = "";
      return;
    }

    // restore default empty copy if it was changed
    emptyBox.querySelector("strong").textContent = "No documents yet";
    emptyBox.querySelector(".ss-muted").textContent = "Create a document, then return to this page.";

    setState({ loading: false, error: false, empty: false, table: true });

    tbody.innerHTML = "";
    tbody.appendChild(renderJobsTable(filtered));
  };

  attachCopyHandlers(document.body);

  const load = async () => {
    refreshBtn.disabled = true;
    setText(statusEl, "Loading…");
    setText(countEl, "");
    setState({ loading: true, error: false, empty: false, table: false });

    try {
      const data = await fetchJobs();

      // Contract: later API returns array of job objects (per prompt).
      // Be tolerant if API returns {jobs:[...]} later — keep rendering instead of breaking.
      const jobs = Array.isArray(data) ? data : (Array.isArray(data?.jobs) ? data.jobs : []);

      allJobs = sortJobsDefault(jobs);

      if (allJobs.length === 0) {
        setText(statusEl, "No documents yet.");
        setState({ loading: false, error: false, empty: true, table: false });
        tbody.innerHTML = "";
      } else {
        setText(statusEl, "Ready.");
        render();
      }
    } catch (e) {
      console.error(e);
      setText(statusEl, "Error.");
      setError(String(e?.message || e));
      setState({ loading: false, error: true, empty: true, table: false });
      tbody.innerHTML = "";
    } finally {
      refreshBtn.disabled = false;
    }
  };

  refreshBtn.addEventListener("click", load);
  searchBox.addEventListener("input", render);

  await load();
}

run();
