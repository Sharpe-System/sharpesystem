/* /rfo/rfo-exparte-fl300.js
   Ex Parte FL-300 Mapping (Public)
   Canon compliant: localStorage only, no auth, no Firebase, single module
*/

(function () {
  "use strict";

  const KEY = "ss_rfo_exparte_fl300_v1";
  const INTAKE = "ss_rfo_exparte_intake_v1";
  const NOTICE = "ss_rfo_exparte_notice_v1";

  function $(id){return document.getElementById(id);}
  function s(v){return String(v??"").trim();}
  function iso(){try{return new Date().toISOString()}catch(_){return""}}

  function load(k){
    try{return JSON.parse(localStorage.getItem(k)||"null")}
    catch(_){return null}
  }

  function save(k,v){
    localStorage.setItem(k,JSON.stringify(v));
  }

  function read(){
    return {
      ordersRequested:s($("ordersRequested").value),
      riskStatement:s($("riskStatement").value),
      harmIfDelayed:s($("harmIfDelayed").value),
      duration:s($("duration").value)
    }
  }

  function write(d){
    if(!d)return;
    $("ordersRequested").value=d.ordersRequested||"";
    $("riskStatement").value=d.riskStatement||"";
    $("harmIfDelayed").value=d.harmIfDelayed||"";
    $("duration").value=d.duration||"";
  }

  function preview(){
    const i=load(INTAKE)||{};
    const n=load(NOTICE)||{};

    $("urgencyPreview").textContent=
      (i.urgency?.type||"")+" — "+(i.urgency?.why||"");

    $("noticePreview").textContent=
      (n.noticeGiven||"")+" "+(n.noticeMethod||"")+" "+(n.noticeWhen||"");
  }

  function persist(){
    const d=read();
    d.version=1;
    d.updatedAt=iso();
    save(KEY,d);
  }

  function init(){
    write(load(KEY));
    preview();
    persist();

    ["ordersRequested","riskStatement","harmIfDelayed","duration"]
      .forEach(id=>{
        const el=$(id);
        el.addEventListener("input",persist);
        el.addEventListener("change",persist);
      });

    $("btnSave").addEventListener("click",persist);
  }

  document.addEventListener("DOMContentLoaded",init);

})();
