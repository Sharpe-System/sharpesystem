// /intake.js
import { auth, ensureUserDoc, writeIntake } from "/db.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const form = document.getElementById("intakeForm");
const msg = document.getElementById("msg");
const saveBtn = document.getElementById("saveBtn");

let authResolved = false;

function setMsg(t) {
  if (msg) msg.textContent = t || "";
}

function goLoginNext() {
  window.location.replace("/login.html?next=/intake.html");
}

function getValue(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

/* -------------------------
   Auth Gate
-------------------------- */
onAuthStateChanged(auth, async (user) => {
  authResolved = true;

  if (!user) {
    goLoginNext();
    return;
  }

  try {
    await ensureUserDoc(user.uid);
  } catch (e) {
    console.error("User doc init failed:", e);
    setMsg("Account initialization failed.");
  }
});

/* -------------------------
   Form Submit
-------------------------- */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!authResolved) {
    setMsg("Checking session…");
    return;
  }

  const user = auth.currentUser;
  if (!user) return goLoginNext();

  if (!form.checkValidity()) {
    setMsg("Please complete required fields.");
    return;
  }

  try {
    if (saveBtn) saveBtn.disabled = true;
    setMsg("Saving…");

    const intake = {
      caseType: getValue("caseType"),
      stage: getValue("stage"),
      nextDate: getValue("nextDate"),
      goal: getValue("goal"),
      risks: getValue("risks"),
      facts: getValue("facts"),
    };

    await writeIntake(user.uid, intake);

    setMsg("Saved. Preparing snapshot…");

    setTimeout(() => {
      window.location.replace("/snapshot.html");
    }, 600);

  } catch (err) {
    console.error(err);
    setMsg("Save failed. Please try again.");
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
});
