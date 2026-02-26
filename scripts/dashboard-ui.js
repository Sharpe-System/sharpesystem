async function fetchJobs(){
  // REAL FETCH (canon)
  // NOTE: requires auth token; gate.js owns redirects, but we handle 401 gracefully.
  const { getAuthToken } = await import("/core/auth/token.js");
  const token = await getAuthToken(true);

  const res = await fetch("/api/jobs/list?limit=50", {
    method: "GET",
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (res.status === 401) throw new Error("Unauthorized (401). Please sign in.");
  if (res.status === 403) throw new Error("Export entitlement required (403).");
  if (!res.ok) throw new Error(`jobs/list failed (${res.status})`);

  const data = await res.json().catch(() => ({}));
  if (!data || data.ok !== true) throw new Error(String(data?.error || "jobs/list non-ok"));

  return Array.isArray(data.jobs) ? data.jobs : [];
}import { getJobsStub } from "/scripts/jobs-stub.js";

const elStatus = document.getElementById("status");
const elError  = document.getElementById("error");
const elEmpty  = document.getElementById("empty");
const elTable  = document.getElementById("tableWrap");
const elBody   = document.getElementById("tbody");
const btn      = document.getElementById("refreshBtn");
const search   = document.getElementById("searchBox");

function showError(msg){ elError.style.display="block"; elError.textContent=msg||"Unknown"; }
function clearError(){ elError.style.display="none"; elError.textContent=""; }
function showEmpty(){ elEmpty.style.display="block"; elTable.style.display="none"; }
function showTable(){ elEmpty.style.display="none"; elTable.style.display="block"; }

function fmtDate(iso){
  if(!iso) return "";
  const d=new Date(iso);
  return Number.isNaN(d.getTime())?iso:d.toLocaleString();
}

function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g,c=>(
    {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]
  ));
}

export function renderJobsTable(jobs){
  elBody.innerHTML="";
  for(const j of jobs){
    const title=j.title||j.form||j.flow||j.jobId;
    const printHref=`/print.html?job=${encodeURIComponent(j.jobId)}`;
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td>${escapeHtml(j.flow||"")}/${escapeHtml(j.form||"")}</td>
      <td>${escapeHtml(title)}</td>
      <td>${escapeHtml(j.caseNumber||"")}</td>
      <td>${escapeHtml(j.county||"")}</td>
      <td>${escapeHtml(j.pageCount??"")}</td>
      <td>${escapeHtml(fmtDate(j.createdAt))}</td>
      <td class="right">
        <a class="btn" href="${printHref}" target="_blank">Print</a>
        ${j.downloadUrl?` | <a class="btn" href="${j.downloadUrl}" target="_blank">Download</a>`:""}
      </td>`;
    elBody.appendChild(tr);
  }
}

async function fetchJobs(){
  return getJobsStub();
  // FUTURE:
  // const res=await fetch("/api/jobs/list");
  // const data=await res.json();
  // return data.jobs||[];
}

function applyFilter(jobs,q){
  if(!q) return jobs;
  q=q.toLowerCase();
  return jobs.filter(j=>
    (j.title||"").toLowerCase().includes(q)||
    (j.caseNumber||"").toLowerCase().includes(q)||
    (j.county||"").toLowerCase().includes(q)
  );
}

function sortJobs(jobs){
  return [...jobs].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}

async function loadJobs(){
  btn.disabled=true;
  clearError();
  elStatus.textContent="Loading…";
  try{
    let jobs=await fetchJobs();
    jobs=sortJobs(jobs);
    if(!jobs||jobs.length===0){
      elStatus.textContent="No documents.";
      showEmpty();
      return;
    }
    renderJobsTable(jobs);
    elStatus.textContent=`${jobs.length} document${jobs.length===1?"":"s"}.`;
    showTable();
  }catch(e){
    elStatus.textContent="Error.";
    showError(String(e?.message||e));
    showEmpty();
  }finally{
    btn.disabled=false;
  }
}

btn?.addEventListener("click",loadJobs);
search?.addEventListener("input",async e=>{
  const all=await fetchJobs();
  const filtered=applyFilter(sortJobs(all),e.target.value);
  renderJobsTable(filtered);
});

loadJobs();
