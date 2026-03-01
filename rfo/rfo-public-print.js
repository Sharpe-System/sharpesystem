/* /rfo/rfo-public-print.js
   Public print gate logic
*/

(function(){
  "use strict";

  const KEY_INTAKE = "ss_rfo_public_v1";
  const KEY_DRAFT = "ss_rfo_public_draft_v1";
  const KEY_EXHIBITS = "ss_rfo_public_exhibits_v1";
  const KEY_FL300 = "ss_rfo_public_fl300_v1";

  function $(id){return document.getElementById(id);}
  function load(k){try{return JSON.parse(localStorage.getItem(k)||"null");}catch{return null;}}

  function save(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

  function migrateFromNewKeys() {
    const pubFl = load(KEY_FL300);
    const pubDraft = load(KEY_DRAFT);
    if (pubFl && pubDraft) return;

    const newFl = load("ss_rfo_fl300_v1");
    const newDecl = load("ss_rfo_decl_v1");
    if (!newFl && !newDecl) return;

    if (!pubFl && newFl) save(KEY_FL300, newFl);

    if (!pubDraft) {
      const parts = [];
      if (newFl) {
        if (newFl.ordersRequested) parts.push("ORDERS REQUESTED\n" + String(newFl.ordersRequested||""));
        if (newFl.whyNeeded) parts.push("WHY NEEDED\n" + String(newFl.whyNeeded||""));
      }
      if (newDecl) {
        if (newDecl.facts) parts.push("FACTS\n" + String(newDecl.facts||""));
        if (newDecl.recent) parts.push("RECENT\n" + String(newDecl.recent||""));
        if (newDecl.necessity) parts.push("NECESSITY\n" + String(newDecl.necessity||""));
        if (newDecl.relief) parts.push("RELIEF\n" + String(newDecl.relief||""));
      }
      const text = parts.join("\n\n").trim();
      save(KEY_DRAFT, { text, version: 1, updatedAt: (new Date()).toISOString() });
    }
  }


  function setStatus(el, ok, label){
    if(!el) return;
    el.textContent = ok ? "✓ " + label : "✗ " + label;
  }

  function buildPacketStatus(){
    const intake = load(KEY_INTAKE);
    const draft = load(KEY_DRAFT);
    const exhibits = load(KEY_EXHIBITS);
    const fl300 = load(KEY_FL300);

    setStatus($("statusIntake"), !!intake, "Intake present");
    setStatus($("statusDraft"), !!draft, "Draft present");
    setStatus($("statusExhibits"), !!exhibits, exhibits ? "Exhibit list present" : "No exhibits");
    setStatus($("statusPacket"), !!fl300, fl300 ? "FL-300 mapped" : "FL-300 not mapped");

    if(draft && draft.text){
      $("previewDraft").value = draft.text;
    }
  }

  async function copy(text){
    try{await navigator.clipboard.writeText(text);}catch{}
  }

  function init(){
    migrateFromNewKeys();
    buildPacketStatus();

    $("btnCopyDraft")?.addEventListener("click",()=>{
      const draft = load(KEY_DRAFT);
      if(draft?.text) copy(draft.text);
    });

    $("btnCopyExhibits")?.addEventListener("click",()=>{
      const ex = load(KEY_EXHIBITS);
      if(ex?.indexText) copy(ex.indexText);
    });
  }

  document.addEventListener("DOMContentLoaded",init);
})();
