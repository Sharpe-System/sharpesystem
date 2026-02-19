/* /rfo/rfo-exparte-fl305.js
   Ex Parte FL-305 Mapping (Public)
   Canon: localStorage only, no auth, no Firebase, single module
*/

(function () {
  "use strict";

  const KEY = "ss_rfo_exparte_fl305_v1";
  const INTAKE = "ss_rfo_exparte_intake_v1";
  const FL300 = "ss_rfo_exparte_fl300_v1";

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
      orders:s($("orders").value),
      againstWho:s($("againstWho").value),
      scope:s($("scope").value),
      necessity:s($("necessity").value),
      duration:s($("duration").value)
    }
  }

  function write(d){
    if(!d)return;
    $("orders").value=d.orders||"";
    $("againstWho").value=d.againstWho||"";
    $("scope").value=d.scope||"";
    $("necessity").value=d.necessity||"";
    $("duration").value=d.duration||"";
  }

  function preview(){
    const i=load(INTAKE)||{};
    const f=load(FL300)||{};

    $("urgencyPreview").textContent=
      (i.urgency?.type||"")+" — "+(i.urgency?.why||"");

    $("fl300Preview").textContent=
      (f.ordersRequested||"")+" "+(f.riskStatement||"");
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

    ["orders","againstWho","scope","necessity","duration"]
      .forEach(id=>{
        const el=$(id);
        el.addEventListener("input",persist);
        el.addEventListener("change",persist);
      });

    $("btnSave").addEventListener("click",persist);
  }

  document.addEventListener("DOMContentLoaded",init);

})();
