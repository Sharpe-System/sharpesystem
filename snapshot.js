// /snapshot.js
import { requireTier1, readUserDoc, updateUserDoc } from "/gate.js";

function $(id) { return document.getElementById(id); }

const snapEl = $("snap");
const msgEl = $("msg");
const copyBtn = $("copyBtn");

function setMsg(t) { if (msgEl) msgEl.textContent = t || ""; }
function setSnap(t) { if (snapEl) snapEl.textContent = t || ""; }
function nowIso() { return new Date().toISOString(); }

function fmtLine(label, value) {
  return `${label}: ${value || "[not provided]"}`;
}

function buildSnapshot(d) {
  const intake = d?.intake || {};
  const lines = [];

  lines.push("SHARPESYSTEM — SNAPSHOT");
  lines.push("");
  lines.push(fmtLine("Case type", intake.caseType));
  lines.push(fmtLine("Stage", intake.stage));
  lines.push(fmtLine("Next date", intake.nextDate));
  lines.push("");

  lines.push("PRIMARY GOAL");
  lines.push(intake.goal ? intake.goal : "[not provided]");
  lines.push("");

  lines.push("IMMEDIATE RISKS");
  lines.push(intake.risks ? intake.risks : "[not provided]");
  lines.push("");

  lines.push("FACTS (BULLETS; NO ADJECTIVES)");
  lines.push(intake.facts ? intake.facts : "[not provided]");

  return lines.join("\n");
}

(async function main() {
  const { user } = await requireTier1();

  try {
    const d = await readUserDoc(user.uid);
    const text = buildSnapshot(d);
    setSnap(text);

    // Non-critical mark
    updateUserDoc(user.uid, { snapshot: { generatedAt: nowIso() } }).catch(() => {});
  } catch (e) {
    console.log(e);
    setMsg("Error loading. Check console.");
  }

  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(snapEl?.textContent || "");
      setMsg("Copied.");
    } catch (e) {
      console.log(e);
      setMsg("Copy failed. (Browser permissions)");
    }
  });
})();
