// intake.js
import { auth, ensureUserDoc, writeIntake } from "/db.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById("intakeForm");
const msg = document.getElementById("msg");
const saveBtn = document.getElementById("saveBtn");

function setMsg(t){ if (msg) msg.textContent = t || ""; }

function goLoginNext() {
  window.location.replace("/login.html?next=/intake.html");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return goLoginNext();
  await ensureUserDoc(user.uid);
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return goLoginNext();

  try {
    saveBtn.disabled = true;
    setMsg("Saving…");

    const intake = {
      caseType: document.getElementById("caseType")?.value || "",
      stage: document.getElementById("stage")?.value || "",
      nextDate: document.getElementById("nextDate")?.value || "",
      goal: (document.getElementById("goal")?.value || "").trim(),
      risks: (document.getElementById("risks")?.value || "").trim(),
      facts: (document.getElementById("facts")?.value || "").trim(),
    };

    await writeIntake(user.uid, intake);

    setMsg("Saved. Sending you to Snapshot…");
    setTimeout(() => window.location.replace("/snapshot.html"), 500);
  } catch (err) {
    console.log(err);
    setMsg("Save failed. Check console.");
  } finally {
    saveBtn.disabled = false;
  }
});
