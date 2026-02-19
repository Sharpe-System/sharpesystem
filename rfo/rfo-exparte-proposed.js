/* /rfo/rfo-exparte-proposed.js
   Ex Parte Proposed Orders (Public)
   Canon: localStorage only, no auth, no Firebase, single module
*/

(function () {
  "use strict";

  const KEY="ss_rfo_exparte_proposed_v1";
  const FL305="ss_rfo_exparte_fl305_v1";
  const DECL="ss_rfo_exparte_decl_v1";

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
      orders:s($("orders").value),
      party:s($("party").value),
      duration:s($("duration").value),
      scope:s($("scope").value)
    }
  }

  function write(d){
    if(!d)return;
    $("orders").value=d.orders||"";
    $("party").value=d.party||"";
    $("duration").value=d.duration||"";
    $("scope").value=d.scope||"";
  }

  function preview(){
    const f305=load(FL305)||{};
    const decl=load(DECL)||{};

    $("fl305Preview").textContent=
      (f305.orders||"")+" "+(f305.necessity||"");

    $("declPreview").textContent=
      (decl.relief||"")+" "+(decl.necessity||"");
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

    ["orders","party","duration","scope"]
      .forEach(id=>{
        const el=$(id);
        el.addEventListener("input",persist);
        el.addEventListener("change",persist);
      });

    $("btnSave").addEventListener("click",persist);
  }

  document.addEventListener("DOMContentLoaded",init);

})();
