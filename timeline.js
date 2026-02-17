/* /timeline.js
   Timeline page logic (v1 text blob)
   AUTH-COMPLIANT: no gate exports, no firebase re-init.
*/

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";
import { readUserDoc, writeTimeline } from "/db.js";

function $(id) { return document.getElementById(id); }

const textarea = $("raw");
const btnSave = $("saveBtn");
const msgEl = $("msg");

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
      setMsg("Not logged in. Please log in.");
      return;
    }

    // Touch profile so tier enforcement remains centralized in gate.js
    await getUserProfile(user.uid).catch(() => ({}));

    // Load existing timeline text if present
    const doc = await readUserDoc(user.uid);
    const existing = doc?.timeline?.text || "";
    if (textarea) textarea.value = String(existing);

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

      // Store inside /users/{uid}.timeline (consistent with /db.js pattern)
      await writeTimeline(user.uid, { text });

      setMsg("Saved.");
    } catch (e) {
      console.error(e);
      setMsg("Save failed. See console.");
    }
  });
}
