(function () {
  "use strict";

  const KEY = "ss:draft:rfo:v1";
  const API = "/api/render/fl300";

  function $(s){return document.querySelector(s)}

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
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

  async function loadPdf(r){
    try{
      const res = await fetch(API,{
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
      const blob = new Blob([buf],{type:"application/pdf"});
      const url = URL.createObjectURL(blob);

      $("#pdfFrame").src = url;

      const dl = $("#btnDownload");
      dl.href = url;
      dl.classList.remove("disabled");
      dl.removeAttribute("aria-disabled");
      dl.download = "FL-300.pdf";

    }catch(e){
      $("#perfect").innerHTML =
        "<div class='mono'>Fetch failed:\n"+esc(String(e))+"</div>";
    }
  }

  function boot(){
    const r = readDraft();
    if(!r){
      renderNoDraft();
      return;
    }

    renderPerfect(r);
    loadPdf(r);

    const btn = $("#btnPrint");
    if(btn) btn.addEventListener("click",()=>window.print());
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",boot);
  }else{
    boot();
  }
})();
