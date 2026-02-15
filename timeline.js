// /timeline.js
import { requireTier1, readUserDoc, updateUserDoc } from "/gate.js";

function $(id) { return document.getElementById(id); }
function setMsg(t) { const el = $("msg"); if (el) el.textContent = t || ""; }
function nowIso() { return new Date().toISOString(); }

function parseLines(raw) {
  const out = [];
  const lines = String(raw || "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  for (const line0 of lines) {
    const line = line0.replace(/^[•\-*\u2022]\s*/, ""); // bullet cleanup
    // Expected: YYYY-MM-DD — Label   (also accept "-" ":" "|")
    const m = line.match(/^(\d{4}-\d{2}-\d{2})\s*(?:—|--|-|:|\|)\s*(.+)$/);
    if (!m) {
      // If no date, store as undated note (keeps user moving)
      out.push({ date: "", label: line, note: "" });
      continue;
    }
    out.push({ date: m[1], label: (m[2] || "").trim(), note: "" });
  }

  // Sort dated events ascending; undated at bottom.
  out.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  return out;
}

(async function main() {
  const { user } = await requireTier1();

  // Prefill if existing
  try {
    const d = await readUserDoc(user.uid);
    const events = d?.timeline?.events || [];
    const raw = events
      .map(ev => ev.date ? `${ev.date} — ${ev.label || ""}` : `${ev.label || ""}`)
      .join("\n");
    const ta = $("raw");
    if (ta && raw) ta.value = raw;
  } catch (e) {
    console.log(e);
  }

  $("saveBtn")?.addEventListener("click", async () => {
    try {
      setMsg("Saving…");
      const raw = $("raw")?.value || "";
      const events = parseLines(raw);

      await updateUserDoc(user.uid, {
        timeline: { events, updatedAt: nowIso() }
      });

      setMsg("Saved.");
    } catch (e) {
      console.log(e);
      setMsg("Save failed. Check console.");
    }
  });
})();
