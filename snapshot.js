// snapshot.js — load users/{uid}/cases/{caseId} and render print-ready snapshot

import app from "/firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

function $(id){ return document.getElementById(id); }
function setMsg(t){ const el = $("msg"); if (el) el.textContent = t || ""; }

function goLogin(nextPath) {
  window.location.replace(`/login.html?next=${encodeURIComponent(nextPath)}`);
}

function getCaseId(){
  const params = new URLSearchParams(window.location.search);
  return params.get("case") || "";
}

function formatDateMaybe(yyyy_mm_dd){
  if (!yyyy_mm_dd) return "—";
  return yyyy_mm_dd;
}

function renderKV(el, rows){
  if (!el) return;
  el.innerHTML = rows.map(([k,v]) =>
    `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v || "—")}</div>`
  ).join("");
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

onAuthStateChanged(auth, async (user) => {
  const caseId = getCaseId();

  if (!user) {
    goLogin(`/snapshot.html?case=${encodeURIComponent(caseId)}`);
    return;
  }

  if (!caseId) {
    setMsg("Missing case id. Go back and create a new intake.");
    $("meta").textContent = "No case id.";
    return;
  }

  try {
    setMsg("Loading snapshot…");

    const ref = doc(db, "users", user.uid, "cases", caseId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      setMsg("Snapshot not found. Create a new intake.");
      $("meta").textContent = "Not found.";
      return;
    }

    const d = snap.data() || {};
    const created = d.createdAt?.toDate ? d.createdAt.toDate() : null;

    $("meta").textContent =
      `User: ${user.email || user.uid} • Case ID: ${caseId}` +
      (created ? ` • Created: ${created.toLocaleString()}` : "");

    renderKV($("coreKv"), [
      ["Case type", d.caseType],
      ["State", d.state],
      ["Next court date", formatDateMaybe(d.nextDate)],
      ["Primary objective", d.objective],
      ["Risk level", d.risk],
      ["Existing orders", d.orders],
      ["Urgency", d.urgency],
    ]);

    const docs = Array.isArray(d.docs) ? d.docs : [];
    $("docsList").textContent = docs.length ? docs.map(x => `• ${x}`).join("\n") : "—";

    $("facts").textContent = (d.facts && String(d.facts).trim()) ? d.facts : "—";

    setMsg("");

  } catch (err) {
    console.log(err);
    setMsg("Load failed. Open console for details.");
  }
});
