// FILE: snapshot.js (OVERWRITE)
// Canonical Snapshot funnel surface
// Prefers intake.flow over caseType inference

import { getAuthStateOnce } from "/firebase-config.js";
import { readUserDoc } from "/db.js";

function byId(id){ return document.getElementById(id); }

function setText(id, t){
  const el = byId(id);
  if (el) el.textContent = t || "";
}

function nextRouteFromIntake(intake){
  const flow = String(intake?.flow || "").toLowerCase();
  if (flow === "rfo") return "/rfo/index.html";
  if (flow === "dvro") return "/dvro/index.html";

  // fallback (legacy)
  const ct = String(intake?.caseType || "").toLowerCase();
  if (ct.includes("dvro") || ct.includes("restrain")) return "/dvro/index.html";
  if (ct.includes("family") || ct.includes("custody")) return "/rfo/index.html";

  return "/dashboard.html";
}

async function main(){
  try {
    const { user } = await getAuthStateOnce();
    if (!user?.uid) return;

    const doc = await readUserDoc(user.uid);
    const intake = doc?.intake || {};

    const next = nextRouteFromIntake(intake);

    sessionStorage.setItem("ss.flow", intake.flow || "");
    sessionStorage.setItem("ss.nextRoute", next);

    setText("ss-next-route", next);

    const btn =
      document.querySelector("#continue") ||
      document.querySelector("[data-continue]") ||
      document.querySelector("a[href*='checklist']");

    if (btn){
      if (btn.tagName === "A") btn.href = "/checklist.html";
      else btn.onclick = () => (window.location.href = "/checklist.html");
    }

  } catch (e){
    console.error(e);
  }
}

if (document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", main);
}else{
  main();
}
