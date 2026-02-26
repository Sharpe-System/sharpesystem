cat > intake.js <<'EOF'
// FILE: intake.js  (OVERWRITE)
// Universal Case Intake (paid module).
// Canonical funnel entry with flow state capture.

import { getAuthStateOnce } from "/firebase-config.js";
import { ensureUserDoc, readUserDoc, writeIntake } from "/db.js";

function byId(id) { return document.getElementById(id); }

const form =
  byId("intakeForm") ||
  document.querySelector("form");

const msg =
  byId("msg") ||
  byId("status") ||
  document.querySelector("[data-status]");

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

// Canonical: capture module funnel state from URL
function flowFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const f = p.get("flow");
  return f ? String(f).toLowerCase() : "";
}

function buildIntakePayload() {
  return {
    flow: flowFromUrl(),   // canonical module state
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
  if (isDvroCaseType(intake.caseType)) return "/dvro/dvro-start.html";
  return "/snapshot.html";
}

async function handleSubmit(e) {
  e?.preventDefault?.();

  try {
    if (saveBtn) saveBtn.disabled = true;
    setMsg("Saving…");

    const { user } = await getAuthStateOnce();
    if (!user?.uid) throw new Error("Not signed in");

    await ensureUserDoc(user.uid);

    const intake = buildIntakePayload();

    await writeIntake(user.uid, intake);

    setMsg("Saved.");

    window.location.href = nextPathFor(intake);
  } catch (err) {
    console.error(err);
    setMsg("Save failed.");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

if (form) {
  form.addEventListener("submit", handleSubmit);
}
EOF
