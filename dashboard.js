/* FILE: /dashboard.js  (OVERWRITE)
   Canon:
   - Never call getAuth() here.
   - Use getAuthStateOnce + getUserProfile from /firebase-config.js for session/profile.
   - Use getAuthToken(true) for Bearer token.
   - Jobs list: GET /api/jobs/list?limit=50&cursor=...
   - Response: { ok:true, jobs:[...], nextCursor:<string|null>, count:<int> }
*/

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";
import { getAuthToken } from "/core/auth/token.js";

function $(id) { return document.getElementById(id); }

const statusEl = $("statusLine") || $("status");
const emptyEl = $("empty");
const errEl = $("error");
const tableEl = $("jobsTable");
const tbodyEl = tableEl ? tableEl.querySelector("tbody") : null;
const loadMoreBtn = $("loadMore");

const tierEl = $("tierValue") || $("tier");
const activeEl = $("activeValue") || $("active");

function setText(el, text) { if (el) el.textContent = text || ""; }
function show(el, on) { if (el) el.style.display = on ? "" : "none"; }

function loginRedirect() {
  const next = encodeURIComponent("/dashboard.html");
  window.location.href = "/login.html?next=" + next;
}

// You can change this to your canonical purchase path if different.
function purchaseLinkHref() {
  // Safe default. Update if your purchase page differs.
  return "/pay.html";
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function jobRowHtml(j) {
  const jobId = String(j?.jobId || "");
  const flow = String(j?.flow || "");
  const form = String(j?.form || "");
  const title = String(j?.title || "");
  const caseNumber = String(j?.caseNumber || "");
  const county = String(j?.county || "");
  const pages = (j?.pageCount ?? "") === null ? "" : String(j?.pageCount ?? "");
  const dateStr = fmtDate(j?.createdAt);

  const printUrl = "/print.html?job=" + encodeURIComponent(jobId);
  const pdfUrl = "/api/jobs/get?id=" + encodeURIComponent(jobId) + "&asset=pdf";

  return `
    <tr data-jobid="${escapeHtml(jobId)}">
      <td>${escapeHtml(flow)}/${escapeHtml(form)}</td>
      <td>${escapeHtml(title)}</td>
      <td>${escapeHtml(caseNumber)}</td>
      <td>${escapeHtml(county)}</td>
      <td>${escapeHtml(pages)}</td>
      <td>${escapeHtml(dateStr)}</td>
      <td>
        <a href="${printUrl}" target="_blank" rel="noopener">Print</a>
        &nbsp;|&nbsp;
        <a href="${pdfUrl}" target="_blank" rel="noopener">Download</a>
      </td>
    </tr>
  `.trim();
}

let nextCursor = null;
let loading = false;
let seenJobIds = new Set();

function resetUIForLoad() {
  show(errEl, false);
  setText(errEl, "");
  show(emptyEl, false);
  show(tableEl, false);
  show(loadMoreBtn, false);

  if (tbodyEl) tbodyEl.innerHTML = "";
  nextCursor = null;
  seenJobIds = new Set();
}

function setError(msg) {
  show(errEl, true);
  setText(errEl, msg);
}

function setEntitlementError() {
  const href = purchaseLinkHref();
  show(errEl, true);
  errEl.innerHTML =
    `Export entitlement required. ` +
    `<a href="${href}">Purchase export</a>.`;
}

async function fetchJobsPage(cursor) {
  const token = await getAuthToken(true);

  const u = new URL("/api/jobs/list", window.location.origin);
  u.searchParams.set("limit", "50");
  if (cursor) u.searchParams.set("cursor", cursor);

  const res = await fetch(u.toString(), {
    headers: { Authorization: "Bearer " + token }
  });

  if (res.status === 401) {
    loginRedirect();
    return null;
  }
  if (res.status === 403) {
    setEntitlementError();
    return null;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    setError("Failed to parse server response.");
    return null;
  }

  if (!data || data.ok !== true) {
    setError("Failed to load documents.");
    console.error("jobs/list non-ok:", data);
    return null;
  }

  return data;
}

function appendJobs(jobs) {
  if (!tbodyEl) return 0;

  let added = 0;
  for (const j of jobs || []) {
    const id = String(j?.jobId || "");
    if (!id) continue;
    if (seenJobIds.has(id)) continue;
    seenJobIds.add(id);

    const tr = document.createElement("tr");
    tr.innerHTML = jobRowHtml(j);
    // jobRowHtml returns <tr>...</tr>; easier: insert as HTML directly
    // So instead, append via insertAdjacentHTML:
    tbodyEl.insertAdjacentHTML("beforeend", jobRowHtml(j));
    added++;
  }
  return added;
}

async function loadMore() {
  if (loading) return;
  loading = true;

  try {
    setText(statusEl, "Loading documents…");
    show(errEl, false);
    setText(errEl, "");

    const data = await fetchJobsPage(nextCursor);
    if (!data) {
      // fetchJobsPage already handled UI for 401/403/errors
      setText(statusEl, "Ready.");
      return;
    }

    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    // Within-page ordering is already newest-first from API, but be tolerant:
    jobs.sort((a, b) => String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")));

    const added = appendJobs(jobs);

    // Cursor contract
    nextCursor = data.nextCursor || null;

    if (tbodyEl && tbodyEl.children.length > 0) {
      show(tableEl, true);
      show(emptyEl, false);
    } else {
      show(tableEl, false);
      show(emptyEl, true);
      setText(emptyEl, "No documents yet.");
    }

    if (nextCursor) {
      show(loadMoreBtn, true);
      loadMoreBtn.disabled = false;
    } else {
      show(loadMoreBtn, false);
    }

    setText(statusEl, "Ready.");
    // If a page returns only duplicates (shouldn’t happen, but tolerate), still allow load more if cursor exists.
    if (added === 0 && jobs.length > 0) {
      console.warn("No new jobs added (duplicates or missing jobIds).");
    }
  } catch (e) {
    console.error("Dashboard load failed:", e);
    setError("Failed to load documents. See console.");
    setText(statusEl, "Ready.");
  } finally {
    loading = false;
  }
}

async function initSessionHeader() {
  try {
    setText(statusEl, "Checking session…");
    const { user } = await getAuthStateOnce();

    if (!user) {
      setText(statusEl, "Not logged in.");
      if (tierEl) setText(tierEl, "—");
      if (activeEl) setText(activeEl, "—");
      loginRedirect();
      return null;
    }

    const profile = await getUserProfile(user.uid);
    const tier = profile?.tier || "free";
    const active = (typeof profile?.active === "boolean") ? profile.active : false;

    if (tierEl) setText(tierEl, tier);
    if (activeEl) setText(activeEl, active ? "Yes" : "No");

    setText(statusEl, "Session active.");
    return user;
  } catch (e) {
    console.error(e);
    setText(statusEl, "Session check failed. See console.");
    return null;
  }
}

(async function init() {
  resetUIForLoad();

  const user = await initSessionHeader();
  if (!user) return;

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", () => loadMore());
  }

  await loadMore();
})();
