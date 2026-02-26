// /checklist.js
import { requireTier1, readUserDoc, updateUserDoc } from "/gate.js";

function nowIso(){ return new Date().toISOString(); }
function $(id){ return document.getElementById(id); }
function setMsg(t){ const el = $("msg"); if (el) el.textContent = t || ""; }

function ensureUI(){
  // If you already have a real checklist.html UI, keep it.
  // Otherwise, we inject a minimal UI safely.
  if (document.getElementById("list")) return;

  const mount = document.querySelector(".content") || document.body;
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h1>Checklist</h1>
    <p class="sub">Add items. Check them off. Saved to your account.</p>

    <div class="template-box">
      <label class="label" for="newItem">New item</label>
      <input class="input" id="newItem" type="text" placeholder="Example: Pull last 3 orders + minute orders" />
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
  const key = t.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return { key: key || ("item_" + Math.random().toString(16).slice(2)), label: t, done: false };
}

function render(items){
  const host = $("list");
  if (!host) return;

  host.innerHTML = "";
  if (!items.length) {
    host.innerHTML = `<div class="muted">No items yet.</div>`;
    return;
  }

  items.forEach((it, idx) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "10px";
    row.style.alignItems = "flex-start";
    row.style.margin = "10px 0";

    row.innerHTML = `
      <input type="checkbox" data-idx="${idx}" ${it.done ? "checked" : ""} />
      <div style="flex:1;">
        <div style="font-weight:800; color: var(--text);">${it.label}</div>
        <div class="muted" style="font-size:12px;">${it.key}</div>
      </div>
      <button class="button" type="button" data-del="${idx}">Remove</button>
    `;
    host.appendChild(row);
  });
}

(async function main(){
  ensureUI();

  // Backbone: funnel export handoff (state-driven)
  const params = new URLSearchParams(location.search);
  const flow = params.get("flow");
  const EXPORT_SURFACES = {
    rfo: "/rfo/public-print.html",
    dvro: "/dvro/dvro-packet.html"
  };
  if (flow && EXPORT_SURFACES[flow]) {
    const mount = document.querySelector(".content") || document.body;
    const box = document.createElement("div");
    box.className = "cta-row";
    box.style.margin = "16px 0";
    box.innerHTML = "<a class=\"button primary\" href=\"" + EXPORT_SURFACES[flow] + "\">Export " + flow.toUpperCase() + " Packet</a>";
    mount.appendChild(box);
  }

  const { user } = await requireTier1();
  let items = [];

  try {
    const d = await readUserDoc(user.uid);
    items = Array.isArray(d?.checklist?.items) ? d.checklist.items : [];
  } catch (e) {
    console.log(e);
  }

  render(items);

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!t || t.tagName !== "INPUT" || t.type !== "checkbox") return;
    const idx = Number(t.getAttribute("data-idx"));
    if (!Number.isFinite(idx) || !items[idx]) return;
    items[idx].done = !!t.checked;
  });

  document.addEventListener("click", (e) => {
    const b = e.target;
    if (!b) return;
    const del = b.getAttribute?.("data-del");
    if (del == null) return;
    const idx = Number(del);
    if (!Number.isFinite(idx)) return;
    items.splice(idx, 1);
    render(items);
  });

  $("addBtn")?.addEventListener("click", () => {
    const v = $("newItem")?.value || "";
    const it = normalizeItem(v);
    if (!it) return;
    items.push(it);
    if ($("newItem")) $("newItem").value = "";
    render(items);
  });

  $("saveBtn")?.addEventListener("click", async () => {
    try {
      setMsg("Saving…");
      await updateUserDoc(user.uid, {
        checklist: { items, updatedAt: nowIso() }
      });
      setMsg("Saved.");
    } catch (e) {
      console.log(e);
      setMsg("Save failed. Check console.");
    }
  });
})();
