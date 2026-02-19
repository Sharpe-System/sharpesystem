/* /rfo/rfo-exparte-decl.js
   Ex Parte MC-030 Declaration (Public)
   Canon: localStorage only, no auth, no Firebase, single module
*/

(function () {
  "use strict";

  const KEY="ss_rfo_exparte_decl_v1";
  const INTAKE="ss_rfo_exparte_intake_v1";
  const FL300="ss_rfo_exparte_fl300_v1";
  const FL305="ss_rfo_exparte_fl305_v1";
  const NOTICE="ss_rfo_exparte_notice_v1";

  function $(id){return document.getElementById(id);}
  function s(v){return String(v??"").trim();}
  function iso(){try{return new Date().toISOString()}catch(_){return""}}

  function load(k){
    try{return JSON.parse(localStorage.getItem(k)||"null")}
    catch(_){return null}
  }

  function save(v){
    localStorage.setItem(KEY,JSON.stringify(v));
  }

  function read(){
    return{
      facts:s($("facts").value),
      recent:s($("recent").value),
      necessity:s($("necessity").value),
      relief:s($("relief").value)
    }
  }

  function write(d){
    if(!d)return;
    $("facts").value=d.facts||"";
    $("recent").value=d.recent||"";
    $("necessity").value=d.necessity||"";
    $("relief").value=d.relief||"";
  }

  function preview(){
    const i=load(INTAKE)||{};
    const f300=load(FL300)||{};
    const f305=load(FL305)||{};
    const n=load(NOTICE)||{};

    $("urgencyPreview").textContent=
      (i.urgency?.type||"")+" — "+(i.urgency?.why||"");

    $("fl300Preview").textContent=
      (f300.ordersRequested||"")+" "+(f300.harmIfDelayed||"");

    $("fl305Preview").textContent=
      (f305.orders||"")+" "+(f305.necessity||"");

    $("noticePreview").textContent=
      (n.noticeGiven||"")+" "+(n.noticeMethod||"")+" "+(n.noticeWhen||"");
  }

  function persist(){
    const d=read();
    d.version=1;
    d.updatedAt=iso();
    save(d);
  }

  function init(){
    write(load(KEY));
    preview();
    persist();

    ["facts","recent","necessity","relief"]
      .forEach(id=>{
        const el=$(id);
        el.addEventListener("input",persist);
        el.addEventListener("change",persist);
      });

    $("btnSave").addEventListener("click",persist);
  }

  document.addEventListener("DOMContentLoaded",init);

})();
