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

function pickFlowFrom(kind, urlFlow) {
  const u = String(urlFlow || "").trim().toLowerCase();
  if (u) return u;

  const k = String(kind || "").trim().toLowerCase();
  if (k === "criminal") return "criminal";
  if (k === "protective_order") return "dvro";
  if (k === "family") return "rfo";
  return "";
}

function buildIntakePayload() {
  const qs = new URLSearchParams(location.search);
  const urlFlow = qs.get("flow") || "";

  const kind = val("kind");
  const flow = pickFlowFrom(kind, urlFlow);

  return {
    flow,
    caseType: kind,
    stage: val("stage"),
    nextDate: val("deadline"),
    goal: val("goal"),
    risks: {
      noContact: checked("flagNoContact"),
      safety: checked("flagSafety"),
      money: checked("flagMoney"),
      language: checked("flagLanguage"),
      selfRep: checked("flagSelfRep"),
      where: val("where")
    },
    facts: val("facts"),
    updatedAt: new Date().toISOString()
  };
}

function nextPathFor() {
  return "/snapshot.html";
}

async function handleSubmit(e) {
  e?.preventDefault?.();

  try {
    if (saveBtn) saveBtn.disabled = true;
    setMsg("Saving…");

    const { user } = await getAuthStateOnce();
    if (!user?.uid) throw new Error("auth_missing");

    await ensureUserDoc(user.uid);

    const intake = buildIntakePayload();
    if (!intake.caseType || !intake.stage) {
      setMsg("Please select the required fields.");
      if (saveBtn) saveBtn.disabled = false;
      return;
    }

    await writeIntake(user.uid, intake);

    sessionStorage.setItem("ss.flow", intake.flow || "");
    sessionStorage.setItem("ss.stage", intake.stage || "");
    sessionStorage.setItem("ss.caseType", intake.caseType || "");

    const d = await readUserDoc(user.uid);
    if (d && typeof d === "object") {
      if (d.tier != null) sessionStorage.setItem("ss.tier", String(d.tier));
      if (d.active != null) sessionStorage.setItem("ss.active", String(d.active));
      if (d.role != null) sessionStorage.setItem("ss.role", String(d.role));
    }

    location.href = nextPathFor(intake);
  } catch (err) {
    console.error(err);
    setMsg("Save failed. Check console.");
    if (saveBtn) saveBtn.disabled = false;
  }
}

if (form) {
  form.addEventListener("submit", handleSubmit);
} else if (saveBtn) {
  saveBtn.addEventListener("click", handleSubmit);
}

(async function hydrate() {
  try {
    const { user } = await getAuthStateOnce();
    if (!user?.uid) return;

    const d = await readUserDoc(user.uid);
    const intake = d?.intake;
    if (!intake) return;

    const setIf = (id, v) => {
      const el = byId(id);
      if (!el) return;
      if ("value" in el && v != null) el.value = String(v);
    };

    setIf("kind", intake.caseType || "");
    setIf("stage", intake.stage || "");
    setIf("where", intake?.risks?.where || "");
    setIf("deadline", intake.nextDate || "");
    setIf("goal", intake.goal || "");
    setIf("facts", intake.facts || "");

    const setCheck = (id, v) => {
      const el = byId(id);
      if (!el) return;
      if ("checked" in el) el.checked = !!v;
    };

    setCheck("flagNoContact", !!intake?.risks?.noContact);
    setCheck("flagSafety", !!intake?.risks?.safety);
    setCheck("flagMoney", !!intake?.risks?.money);
    setCheck("flagLanguage", !!intake?.risks?.language);
    setCheck("flagSelfRep", !!intake?.risks?.selfRep);
  } catch (_) {}
})();
