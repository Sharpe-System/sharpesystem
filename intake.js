// /intake.js
import { requireTier1, updateUserDoc, readUserDoc } from "/gate.js";

function $(id){ return document.getElementById(id); }

const form = $("intakeForm");
const msg = $("msg");
const saveBtn = $("saveBtn");

function setMsg(t){ if (msg) msg.textContent = t || ""; }
function nowIso(){ return new Date().toISOString(); }

(async function main(){
  const { user } = await requireTier1();

  // Prefill existing intake if present
  try {
    const d = await readUserDoc(user.uid);
    const intake = d?.intake || {};
    if ($("caseType")) $("caseType").value = intake.caseType || "";
    if ($("stage")) $("stage").value = intake.stage || "";
    if ($("nextDate")) $("nextDate").value = intake.nextDate || "";
    if ($("goal")) $("goal").value = intake.goal || "";
    if ($("risks")) $("risks").value = intake.risks || "";
    if ($("facts")) $("facts").value = intake.facts || "";
  } catch (e) {
    console.log(e);
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      if (saveBtn) saveBtn.disabled = true;
      setMsg("Saving…");

      const intake = {
        caseType: $("caseType")?.value || "",
        stage: $("stage")?.value || "",
        nextDate: $("nextDate")?.value || "",
        goal: ($("goal")?.value || "").trim(),
        risks: ($("risks")?.value || "").trim(),
        facts: ($("facts")?.value || "").trim(),
        updatedAt: nowIso(),
      };

      await updateUserDoc(user.uid, { intake });

      setMsg("Saved. Sending you to Snapshot…");
      setTimeout(() => window.location.replace("/snapshot.html"), 450);
    } catch (err) {
      console.log(err);
      setMsg("Save failed. Check console.");
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });
})();
