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

function buildIntakePayload(){
  return {
    caseType: ($("kind")?.value || "").trim(),
    stage: ($("stage")?.value || "").trim(),
    nextDate: ($("deadline")?.value || "").trim(),
    goal: ($("goal")?.value || "").trim(),
    risks: JSON.stringify({
      noContact: !!$("flagNoContact")?.checked,
      safety: !!$("flagSafety")?.checked,
      money: !!$("flagMoney")?.checked,
      language: !!$("flagLanguage")?.checked,
      selfRep: !!$("flagSelfRep")?.checked,
      where: ($("where")?.value || "").trim()
    }),
    facts: ($("facts")?.value || "").trim()
  };
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

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      if (saveBtn) saveBtn.disabled = true;
      setMsg("Saving…");

      const { user } = await getAuthStateOnce();
      if (!user) return; // gate.js owns auth redirect

      const intake = buildIntakePayload();

      if (!intake.caseType || !intake.stage) {
        setMsg("Please choose the kind of issue and the stage.");
        return;
      }

      await writeIntake(user.uid, intake);

      setMsg("Saved. Routing…");
      window.location.replace("/snapshot.html");
    } catch (err) {
      console.error(err);
      setMsg("Save failed. Check console.");
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });
})();
