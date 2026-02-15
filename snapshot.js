// snapshot.js
import { auth, ensureUserDoc, readUserDoc, markSnapshotGenerated } from "/db.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const snapEl = document.getElementById("snap");
const msgEl = document.getElementById("msg");
const copyBtn = document.getElementById("copyBtn");

function setMsg(t){ if (msgEl) msgEl.textContent = t || ""; }
function setSnap(t){ if (snapEl) snapEl.textContent = t || ""; }

function goLoginNext() {
  window.location.replace("/login.html?next=/snapshot.html");
}

function goTier() {
  window.location.replace("/tier1.html");
}

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

onAuthStateChanged(auth, async (user) => {
  if (!user) return goLoginNext();

  try {
    const d0 = await ensureUserDoc(user.uid);

    // Gate: must be active + tier1
    const active = d0?.active === true;
    const tier = d0?.tier || "";

    if (!active || tier !== "tier1") return goTier();

    const d = await readUserDoc(user.uid);
    const text = buildSnapshot(d);
    setSnap(text);

    // mark generated (non-critical)
    markSnapshotGenerated(user.uid).catch(() => {});
  } catch (e) {
    console.log(e);
    setMsg("Error loading. Check console.");
  }
});

copyBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(snapEl?.textContent || "");
    setMsg("Copied.");
  } catch (e) {
    console.log(e);
    setMsg("Copy failed. (Browser permissions)");
  }
});
