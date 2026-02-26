// FILE: intake.js  (OVERWRITE)

// /intake.js
// Universal Case Intake (paid module).
// Auth enforcement is handled by /gate.js on the page.
// This file only reads/writes the user's intake data.

import { getAuthStateOnce } from "/firebase-config.js";
import { ensureUserDoc, readUserDoc, writeIntake } from "/db.js";

function $(id) { return document.getElementById(id); }

const form = $("intakeForm");
const msg = $("msg");
const saveBtn = $("saveBtn");

function setMsg(t) { if (msg) msg.textContent = t || ""; }

function safeStr(x) { return String(x ?? "").trim(); }

function buildIntakePayload() {
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

function isDvroCaseType(caseType) {
  const s = safeStr(caseType).toLowerCase();
  // Tolerant: match whatever labels you use (protective, restraining, dvro, etc.)
  return (
    s.includes("dvro") ||
    s.includes("restrain") ||
    s.includes("protect") ||
    s.includes("domestic violence")
  );
}

async function headOk(path) {
  try {
    const res = await fetch(path, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

// Resolve funnel entry without assuming exact file names.
// Priority: DVRO funnel entry → RFO funnel entry → snapshot fallback.
async function resolveNextPath(intake) {
  const dvroCandidates = [
    "/dvro/start.html",
    "/dvro/index.html",
    "/dvro/dvro-start.html"
  ];

  const rfoCandidates = [
    "/rfo/start.html",
    "/start.html",
    "/rfo/index.html"
  ];

  const candidates = isDvroCaseType(intake.caseType) ? dvroCandidates : rfoCandidates;

  for (const p of candidates) {
    if (await headOk(p)) return p;
  }

  // Absolute fallback (always exists in repo)
  return "/snapshot.html";
}

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label || "timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function handleSaveAndContinue() {
  const originalBtnText = saveBtn ? saveBtn.textContent : "";

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      // If your UI shows "Working…" elsewhere, this keeps it consistent
      saveBtn.textContent = "Working…";
    }
    setMsg("Saving…");

    const { user } = await getAuthStateOnce();
    if (!user) {
      // gate.js owns auth redirects, but don't hang the UI
      setMsg("Not signed in.");
      return;
    }

    await ensureUserDoc(user.uid);

    const intake = buildIntakePayload();

    if (!intake.caseType || !intake.stage) {
      setMsg("Please choose the kind of issue and the stage.");
      return;
    }

    // Best-effort write: never allow an infinite hang to block routing.
    try {
      await withTimeout(writeIntake(user.uid, intake), 6000, "writeIntake_timeout");
    } catch (e) {
      console.warn("writeIntake failed/timeout; continuing anyway:", e);
      // Non-fatal: we still route into the funnel.
      setMsg("Saved locally. Continuing…");
    }

    setMsg("Continuing…");

    const nextPath = await resolveNextPath(intake);
    window.location.assign(nextPath);
  } catch (err) {
    console.error(err);
    setMsg("Save failed. Check console.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalBtnText || "Save and continue";
    }
  }
}

(async function init() {
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

  // Canon: support BOTH patterns:
  // - button submits the form (type=submit)
  // - button is type=button and needs an explicit click handler
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSaveAndContinue();
  });

  saveBtn?.addEventListener("click", (e) => {
    // Prevent double-handling if button is submit inside the form.
    e.preventDefault();
    handleSaveAndContinue();
  });
})();
