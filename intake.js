// FILE: intake.js  (OVERWRITE)
// Universal Case Intake (paid module).
// Auth enforcement is handled by /gate.js on the page.
// This file only reads/writes the user's intake data.

import { getAuthStateOnce } from "/firebase-config.js";
import { ensureUserDoc, readUserDoc, writeIntake } from "/db.js";

function byId(id) { return document.getElementById(id); }

const form =
  byId("intakeForm") ||
  document.querySelector("form"); // fallback (prevents dead submit wiring)

const msg =
  byId("msg") ||
  byId("status") ||
  document.querySelector("[data-status]"); // safe fallback

const saveBtn =
  byId("saveBtn") ||
  (form ? form.querySelector('button[type="submit"], input[type="submit"]') : null);

function setMsg(t) {
  if (!msg) return;
  msg.textContent = t || "";
}

function val(id) {
  const el = byId(id);
  return (el && "value" in el) ? String(el.value || "").trim() : "";
}

function checked(id) {
  const el = byId(id);
  return !!(el && "checked" in el && el.checked);
}

function buildIntakePayload() {
  return {
    caseType: val("kind"),
    stage: val("stage"),
    nextDate: val("deadline"),
    goal: val("goal"),
    risks: JSON.stringify({
      noContact: checked("flagNoContact"),
      safety: checked("flagSafety"),
      money: checked("flagMoney"),
      language: checked("flagLanguage"),
      selfRep: checked("flagSelfRep"),
      where: val("where")
    }),
    facts: val("facts")
  };
}

// Canon: deterministic funnel entry. No probing.
function isDvroCaseType(caseType) {
  const s = String(caseType || "").toLowerCase();
  return (
    s.includes("dvro") ||
    s.includes("restrain") ||
    s.includes("protect") ||
    s.includes("domestic violence")
  );
}

function nextPathFor(intake) {
  // If DVRO-like intake, route into DVRO flow start.
  if (isDvroCaseType(intake.caseType)) return "/dvro/dvro-start.html";
  // Otherwise route into generic snapshot/checklist.
  return "/snapshot.html";
}

async function handleSubmit(e) {
  e?.preventDefault?.();

  try {
    if (saveBtn) saveBtn.disabled = true;
    setMsg("Saving…");

    const { user } = await getAuthStateOnce();
    if (!user) return; // gate.js handles auth

    await ensureUserDoc(user.uid);

    const intake = buildIntakePayload();

    if (!intake.caseType || !intake.stage) {
      setMsg("Please choose the kind of issue and the stage.");
      return;
    }

    await writeIntake(user.uid, intake);

    const next = nextPathFor(intake);
    setMsg("Saved. Routing…");
    window.location.assign(next);
  } catch (err) {
    console.error(err);
    setMsg("Save failed. Check console.");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

(async function init() {
  try {
    setMsg("Loading…");

    const { user } = await getAuthStateOnce();
    if (!user) return; // gate.js handles auth

    await ensureUserDoc(user.uid);

    const d = await readUserDoc(user.uid);
    const intake = d?.intake || {};

    const setIf = (id, v) => {
      const el = byId(id);
      if (el && "value" in el) el.value = v || "";
    };

    setIf("kind", intake.caseType || "");
    setIf("stage", intake.stage || "");
    setIf("deadline", intake.nextDate || "");
    setIf("goal", intake.goal || "");
    setIf("facts", intake.facts || "");

    try {
      const r = intake.risks ? JSON.parse(intake.risks) : null;
      if (r) {
        setIf("where", r.where || "");
        const setChk = (id, v) => {
          const el = byId(id);
          if (el && "checked" in el) el.checked = !!v;
        };
        setChk("flagNoContact", r.noContact);
        setChk("flagSafety", r.safety);
        setChk("flagMoney", r.money);
        setChk("flagLanguage", r.language);
        setChk("flagSelfRep", r.selfRep);
      }
    } catch (_) {}

    setMsg("Ready.");
  } catch (e) {
    console.error(e);
    setMsg("Load failed. Check console.");
  }

  // Wire submit (primary)
  if (form) form.addEventListener("submit", handleSubmit);

  // Wire click (backup) — prevents dead UI if form wiring breaks
  if (saveBtn) saveBtn.addEventListener("click", (e) => handleSubmit(e));
})();
