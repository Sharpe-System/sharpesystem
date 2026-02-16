/* /timeline.js
   Frontend thread: Timeline page logic.
   Fix: stop importing readUserDoc from gate.js (frozen, not exported).
   Use firebase-config.js helpers instead.
*/

import { getAuthStateOnce, getUserProfile, db } from "/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function $(id) { return document.getElementById(id); }

const textarea = $("timelineInput") || document.querySelector("textarea");
const btnSave = $("btnSaveTimeline") || document.querySelector("button");
const msgEl = $("msg") || $("status") || null;

function setMsg(t) { if (msgEl) msgEl.textContent = t || ""; }

function normalizeLines(raw) {
  const lines = String(raw || "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  // Accept: YYYY-MM-DD — Label  OR  YYYY/MM/DD - Label  OR free text
  const out = lines.map(line => {
    const m = line.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})\s*[—-]\s*(.+)$/);
    if (m) return `${m[1]}-${m[2]}-${m[3]} — ${m[4].trim()}`;
    return line;
  });

  return out.join("\n");
}

(async function init() {
  try {
    setMsg("Checking session…");
    const { user } = await getAuthStateOnce();

    if (!user) {
      setMsg("Not logged in. Go to Log In.");
      return;
    }

    // Optional: profile check (tier gating later if you want)
    await getUserProfile(user.uid);

    // Load existing timeline if present
    const ref = doc(db, "users", user.uid, "rfo", "timeline");
    const snap = await getDoc(ref);
    if (snap.exists() && textarea) {
      textarea.value = String(snap.data()?.text || "");
    }

    setMsg("Ready.");
  } catch (e) {
    console.error(e);
    setMsg("Timeline load failed. See console.");
  }
})();

if (btnSave) {
  btnSave.addEventListener("click", async () => {
    try {
      const { user } = await getAuthStateOnce();
      if (!user) { setMsg("Not logged in."); return; }

      const text = normalizeLines(textarea ? textarea.value : "");
      if (textarea) textarea.value = text;

      const ref = doc(db, "users", user.uid, "rfo", "timeline");
      await setDoc(ref, { text, updatedAt: new Date().toISOString() }, { merge: true });

      setMsg("Saved.");
    } catch (e) {
      console.error(e);
      setMsg("Save failed. See console.");
    }
  });
}
