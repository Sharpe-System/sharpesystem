// FILE: checklist.js (OVERWRITE)
// Canonical checklist surface with flow-driven export

import { requireTier1, readUserDoc, updateUserDoc } from "/gate.js";

function nowIso(){ return new Date().toISOString(); }
function $(id){ return document.getElementById(id); }

function ensureUI(){
  if (document.getElementById("list")) return;

  const mount = document.querySelector(".content") || document.body;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h1>Checklist</h1>
    <p class="sub">Add items. Check them off. Saved to your account.</p>

    <div id="exportBox" class="cta-row" style="margin:16px 0;"></div>

    <div class="template-box">
      <label class="label" for="newItem">New item</label>
      <input class="input" id="newItem" type="text" />
      <div class="cta-row">
        <button class="button primary" id="addBtn" type="button">Add</button>
        <button class="button" id="saveBtn" type="button">Save</button>
      </div>
      <div id="msg" class="muted" style="margin-top:10px;"></div>
    </div>

    <div class="template-box" style="margin-top:12px;">
      <div id="list"></div>
    </div>
  `;
  mount.prepend(wrap);
}

function normalizeItem(label){
  const t = String(label || "").trim();
  if (!t) return null;
  const key = t.toLowerCase().replace(/[^a-z0-9]+/g,"_");
  return { key, label:t, done:false };
}

function render(items){
  const host = $("list");
  if (!host) return;

  host.innerHTML = "";

  if (!items.length){
    host.innerHTML = `<div class="muted">No items yet.</div>`;
    return;
  }

  items.forEach((it,idx)=>{
    const row = document.createElement("div");
    row.style.display="flex";
    row.style.gap="10px";
    row.style.margin="10px 0";

    row.innerHTML = `
      <input type="checkbox" data-idx="${idx}" ${it.done?"checked":""}/>
      <div style="flex:1;">${it.label}</div>
      <button class="button" data-del="${idx}">Remove</button>
    `;
    host.appendChild(row);
  });
}

function exportSurfaceFor(flow){
  if (flow==="rfo") return "/rfo/public-print.html";
  if (flow==="dvro") return "/dvro/dvro-packet.html";
  return "";
}

function renderExportCTA(){
  const box = $("exportBox");
  if (!box) return;

  const flow = sessionStorage.getItem("ss.flow") || "";
  const url = exportSurfaceFor(flow);

  if (!url) return;

  box.innerHTML =
    `<a class="button primary" href="${url}">
      Export ${flow.toUpperCase()} Packet
    </a>`;
}

(async function main(){
  ensureUI();
  renderExportCTA();

  const { user } = await requireTier1();
  let items=[];

  try{
    const d = await readUserDoc(user.uid);
    items = Array.isArray(d?.checklist?.items)?d.checklist.items:[];
  }catch(e){}

  render(items);

  document.addEventListener("change",(e)=>{
    const t=e.target;
    if(t.tagName!=="INPUT") return;
    const idx=Number(t.dataset.idx);
    if(!items[idx]) return;
    items[idx].done=t.checked;
  });

  document.addEventListener("click",(e)=>{
    const b=e.target;
    if(!b.dataset.del) return;
    const idx=Number(b.dataset.del);
    items.splice(idx,1);
    render(items);
  });

  $("addBtn")?.addEventListener("click",()=>{
    const v=$("newItem")?.value||"";
    const it=normalizeItem(v);
    if(!it) return;
    items.push(it);
    $("newItem").value="";
    render(items);
  });

  $("saveBtn")?.addEventListener("click",async()=>{
    await updateUserDoc(user.uid,{
      checklist:{items,updatedAt:nowIso()}
    });
    $("msg").textContent="Saved.";
  });

})();
