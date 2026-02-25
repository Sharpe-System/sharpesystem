(function () {
  "use strict";

  const KEY = "ss:draft:rfo:v1";
  const API_RENDER = "/api/render/fl300";
  const API_JOB_GET = "/api/jobs/get?id=";

  function $(s){return document.querySelector(s)}

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function getParam(name){
    try{
      return new URL(window.location.href).searchParams.get(name);
    }catch{
      return null;
    }
  }

  function renderNoDraft(){
    const p = $("#perfect");
    p.innerHTML =
      '<div class="muted">No draft found.</div>' +
      '<div style="margin-top:10px">' +
      '<a class="btn primary" href="/rfo/public-intake.html">Go to Intake</a>' +
      '</div>';
  }

  function renderPerfect(r){
    const p = $("#perfect");
    p.className="perfect";
    p.innerHTML =
      "<strong>County:</strong> "+esc(r.county||"—")+"\n"+
      "<strong>Branch:</strong> "+esc(r.branch||"—")+"\n"+
      "<strong>Case:</strong> "+esc(r.caseNumber||"—")+"\n"+
      "<strong>Role:</strong> "+esc(r.role||"—")+"\n"+
      "<strong>Custody:</strong> "+(r.reqCustody?"Yes":"No")+"\n"+
      "<strong>Support:</strong> "+(r.reqSupport?"Yes":"No")+"\n"+
      "<strong>Other:</strong> "+(r.reqOther?"Yes":"No")+"\n\n"+
      "<strong>Details:</strong>\n"+esc(r.requestDetails||"");
  }

  function setDownload(url){
    const dl = $("#btnDownload");
    if(!dl) return;
    if(!url){
      dl.href="#";
      dl.classList.add("disabled");
      dl.setAttribute("aria-disabled","true");
      dl.removeAttribute("download");
      return;
    }
    dl.href=url;
    dl.classList.remove("disabled");
    dl.removeAttribute("aria-disabled");
    dl.download="FL-300.pdf";
  }

  function bytesFromBase64(b64){
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for(let i=0;i<len;i++) bytes[i]=bin.charCodeAt(i);
    return bytes;
  }

  function loadPdfFromBytes(bytes){
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    $("#pdfFrame").src = url;
    setDownload(url);
  }

  async function loadJob(jobId){
    try{
      $("#perfect").innerHTML = "<div class='muted'>Loading job…</div>";
      setDownload("");

      const res = await fetch(API_JOB_GET + encodeURIComponent(jobId), { method: "GET" });
      if(!res.ok){
        const txt = await res.text().catch(()=> "");
        $("#perfect").innerHTML = "<div class='mono'>Job load error:\n"+esc(txt.slice(0,4000))+"</div>";
        return;
      }

      const job = await res.json();

      const payload = job && job.renderPayload ? job.renderPayload : null;
      const r = payload && payload.rfo ? payload.rfo : null;
      if(!r){
        $("#perfect").innerHTML = "<div class='mono'>Job missing renderPayload.rfo</div>";
        return;
      }

      renderPerfect(r);

      const b64 = job?.pdf?.base64 || "";
      if(!b64){
        $("#perfect").innerHTML = "<div class='mono'>Job missing pdf bytes.</div>";
        return;
      }

      const bytes = bytesFromBase64(b64);
      loadPdfFromBytes(bytes);

    }catch(e){
      $("#perfect").innerHTML = "<div class='mono'>Job fetch failed:\n"+esc(String(e))+"</div>";
    }
  }

  function readDraft(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return null;
      const obj = JSON.parse(raw);
      return obj?.rfo ? obj.rfo : null;
    }catch{
      return null;
    }
  }

  async function loadPdfFromDraft(r){
    try{
      const res = await fetch(API_RENDER,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({rfo:r})
      });

      if(!res.ok){
        const txt = await res.text().catch(()=> "");
        $("#perfect").innerHTML =
          "<div class='mono'>Render error:\n"+esc(txt.slice(0,4000))+"</div>";
        return;
      }

      const buf = await res.arrayBuffer();
      loadPdfFromBytes(new Uint8Array(buf));

    }catch(e){
      $("#perfect").innerHTML =
        "<div class='mono'>Fetch failed:\n"+esc(String(e))+"</div>";
    }
  }

  function boot(){
    const jobId = getParam("job");
    if(jobId){
      // Canon: if job param present, do NOT read localStorage.
      loadJob(jobId);
    } else {
      const r = readDraft();
      if(!r){
        renderNoDraft();
        setDownload("");
        return;
      }
      renderPerfect(r);
      loadPdfFromDraft(r);
    }

    const btn = $("#btnPrint");
    if(btn) btn.addEventListener("click",()=>window.print());
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot);
  }else{
    boot();
  }
})();
