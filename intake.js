// FILE: intake.js  (OVERWRITE)

// /intake.js
// Universal Case Intake (paid module).
// Auth enforcement is handled by /gate.js on the page.
// This file only reads/writes the user's intake data.

import { getAuthStateOnce } from "/firebase-config.js";
import { ensureUserDoc, readUserDoc, writeIntake } from "/db.js";

function $(id){ return document.getElementById(id); }

const form = $("intakeForm");
const msg = $("msg");
const saveBtn = $("saveBtn");

function setMsg(t){ if (msg) msg.textContent = t || ""; }

function safeStr(x){ return String(x ?? "").trim(); }

function buildIntakePayload(){
  return {
    caseType: safeStr($("kind")?.value),
    stage: safeStr($("stage")?.value),
    nextDate: safeStr($("deadline")?.value),
    goal: safeStr($("goal")?.value),
    risks: JSON.stringify({
      noContact: !!$("flagNoContact")?.checked,
      safety: !!$("flagSafety")?.checked,
      money: !!$("flagMoney")?.checked,
      language: !!$("flagLanguage")?.checked,
      selfRep: !!$("flagSelfRep")?.checked,
      where: safeStr($("where")?.value)
    }),
    facts: safeStr($("facts")?.value)
  };
}

function isDvroCaseType(caseType){
  const s = safeStr(caseType).toLowerCase();
  return (
    s.includes("dvro") ||
    s.includes("restrain") ||
    s.includes("protect") ||
    s.includes("domestic violence")
  );
}

// Canon: deterministic funnel entry. No probing.
function nextPathFor(intake){
  if (isDvroCaseType(intake.caseType)) return "/dvro/dvro-start.html";
  // RFO funnel currently lives under /start.html in this repo.
  return "/start.html";
}

function withTimeout(promise, ms){
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function handleSaveAndContinue(){
  const originalText = saveBtn ? saveBtn.textContent : "";

  try {
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Working…"; }
    setMsg("Saving…");

    const { user } = await getAuthStateOnce();
    if (!user) {
      setMsg("Not signed in.");
      return; // gate.js owns auth redirects
    }

    await ensureUserDoc(user.uid);

    const intake = buildIntakePayload();

    if (!intake.caseType || !intake.stage) {
      setMsg("Please choose the kind of issue and the stage.");
      return;
    }

    // Best-effort save. Never block routing.
    try {
      await withTimeout(writeIntake(user.uid, intake), 6000);
    } catch (e) {
      console.warn("writeIntake failed (non-fatal):", e);
      setMsg("Saved locally. Continuing…");
    }

    const nextPath = nextPathFor(intake);
    setMsg("Continuing…");
    window.location.assign(nextPath);
  } catch (err) {
    console.error(err);
    setMsg("Save failed. Check console.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText || "Save and continue";
    }
  }
}

(async function init(){
  try {
    setMsg("Loading…");

    const { user } = await getAuthStateOnce();
    if (!user) return; // gate.js already handles auth redirects

    await ensureUserDoc(user.uid);

    // Prefill from existing intake
    const d = await readUserDoc(user.uid);
    const intake = d?.intake || {};

    if ($("kind")) $("kind").value = intake.caseType || "";
    if ($("stage")) $("stage").value = intake.stage || "";
    if ($("deadline")) $("deadline").value = intake.nextDate || "";
    if ($("goal")) $("goal").value = intake.goal || "";
    if ($("facts")) $("facts").value = intake.facts || "";

    try {
      const r = intake.risks ? JSON.parse(intake.risks) : null;
      if (r) {
        if ($("where")) $("where").value = r.where || "";
        if ($("flagNoContact")) $("flagNoContact").checked = !!r.noContact;
        if ($("flagSafety")) $("flagSafety").checked = !!r.safety;
        if ($("flagMoney")) $("flagMoney").checked = !!r.money;
        if ($("flagLanguage")) $("flagLanguage").checked = !!r.language;
        if ($("flagSelfRep")) $("flagSelfRep").checked = !!r.selfRep;
      }
    } catch (_) {}

    setMsg("Ready.");
  } catch (e) {
    console.error(e);
    setMsg("Load failed. Check console.");
  }

  // Support submit and explicit click, in case markup changes later.
  form?.addEventListener("submit", (e) => { e.preventDefault(); handleSaveAndContinue(); });
  saveBtn?.addEventListener("click", (e) => { e.preventDefault(); handleSaveAndContinue(); });
})();
