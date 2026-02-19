/* /rfo/rfo-print.js
   Paid RFO print/export (canon compliant).

   Canon:
   - Gate owns auth/tier redirects (NO redirects here)
   - NO Firebase CDN imports here (only from /firebase-config.js)
   - Auto-import via URL hash (#import) (no redirects, no tier checks)
   - Save path is rules-dependent:
     * Attempt /users/{uid}/rfoDrafts/{draftId} first
     * If denied, fallback to /users/{uid}.rfoWorkingSet (interim)
*/

import {
  getAuthStateOnce,
  fsDoc,
  fsGetDoc,
  fsUpdateDoc,
  fsSetDoc
} from "/firebase-config.js";

const KEY_INTAKE = "ss_rfo_public_v1";
const KEY_DRAFT = "ss_rfo_public_draft_v1";
const KEY_EXHIBITS = "ss_rfo_public_exhibits_v1";

function $(id) { return document.getElementById(id); }
function safeStr(v) { return String(v ?? "").trim(); }
function nowISO() { try { return new Date().toISOString(); } catch (_) { return ""; } }

function setMsg(t) { const el = $("msg"); if (el) el.textContent = t || ""; }
function setStatus(id, ok, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = (ok ? "✅ " : "⚠️ ") + text;
}

function loadJSON(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function clearLocalPublicKeys() {
  localStorage.removeItem(KEY_INTAKE);
  localStorage.removeItem(KEY_DRAFT);
  localStorage.removeItem(KEY_EXHIBITS);
}

function wantsAutoImport() {
  return (window.location.hash || "") === "#import";
}

function clearAutoImportHash() {
  try {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  } catch (_) {}
}

function alphaLabel(idx) {
  let n = idx;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function buildExhibitIndex(exObj) {
  const items = Array.isArray(exObj?.items) ? exObj.items : [];
  let exhibitCount = 0;
  const lines = [];
  lines.push("EXHIBIT INDEX");
  lines.push("");

  if (items.length === 0) {
    lines.push("[No exhibits listed]");
    return lines.join("\n");
  }

  items.forEach((it) => {
    if (it?.kind === "divider") {
      const title = safeStr(it.title) || "Section";
      lines.push(title.toUpperCase());
      lines.push("-".repeat(Math.min(48, title.length)));
      return;
    }
    if (it?.kind === "exhibit") {
      const label = "Exhibit " + alphaLabel(exhibitCount);
      exhibitCount += 1;

      const title = safeStr(it.title) || "[Untitled]";
      const rel = safeStr(it.relevance);
      const date = safeStr(it.dateRange);
      const pages = safeStr(it.pages);

      const metaBits = [];
      if (it.type) metaBits.push(it.type);
      if (date) metaBits.push(date);
      if (pages) metaBits.push(pages + " pages");

      const meta = metaBits.length ? " (" + metaBits.join(" • ") + ")" : "";
      lines.push(label + ": " + title + meta);
      if (rel) lines.push("  - Relevance: " + rel);
      lines.push("");
    }
  });

  return lines.join("\n");
}

function buildPacket(intake, draft, exhibits) {
  const county = safeStr(intake?.court?.county) || "Orange";
  const caseNo = safeStr(intake?.court?.caseNumber);
  const petitioner = safeStr(intake?.parties?.petitionerName);
  const respondent = safeStr(intake?.parties?.respondentName);

  const packet = [];
  packet.push("SHARPESYSTEM — RFO PACKET (TEXT EXPORT)");
  packet.push(`Generated: ${nowISO()}`);
  packet.push("");
  packet.push(`County: ${county}`);
  if (caseNo) packet.push(`Case No.: ${caseNo}`);
  if (petitioner || respondent) packet.push(`Parties: ${petitioner || "[Petitioner]"} vs. ${respondent || "[Respondent]"}`);
  packet.push("");
  packet.push("------------------------------------------------------------");
  packet.push("SECTION 1 — DECLARATION / DRAFT");
  packet.push("------------------------------------------------------------");
  packet.push("");
  packet.push(safeStr(draft?.text) || "[No draft found]");
  packet.push("");
  packet.push("------------------------------------------------------------");
  packet.push("SECTION 2 — EXHIBIT INDEX");
  packet.push("------------------------------------------------------------");
  packet.push("");
  packet.push(buildExhibitIndex(exhibits));
  packet.push("");
  packet.push("------------------------------------------------------------");
  packet.push("SECTION 3 — FILING CHECKLIST (PLACEHOLDER)");
  packet.push("------------------------------------------------------------");
  packet.push("");
  packet.push("1) Review requested orders for clarity and enforceability.");
  packet.push("2) Print required copies (varies by method).");
  packet.push("3) File with the court; obtain hearing date.");
  packet.push("4) Serve the other party per rules; file proof of service.");
  packet.push("5) Prepare a hearing outline + binder.");
  packet.push("");
  packet.push("NOTE: This is not legal advice. Confirm rules for your case type and county.");
  packet.push("");
  return packet.join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch {}
    try { a.remove(); } catch {}
  }, 0);
}

function openPrintWindow(text) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    alert("Pop-up blocked. Allow pop-ups to open the print view.");
    return;
  }
  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  w.document.open();
  w.document.write(`<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>RFO Packet — Print</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-size: 13px; line-height: 1.35; }
  .note { color: #444; margin-bottom: 12px; }
  @media print { .note { display:none; } body { padding: 0; } }
</style>
</head><body>
<div class="note">Print packet view (text). Use browser Print.</div>
<pre>${esc(text)}</pre>
<script>window.focus();</script>
</body></html>`);
  w.document.close();
}

function getImportedFromLocal() {
  const intake = loadJSON(KEY_INTAKE);
  const draft = loadJSON(KEY_DRAFT);
  const exhibits = loadJSON(KEY_EXHIBITS);

  const hasIntake = !!intake;
  const hasDraft = !!(draft && safeStr(draft.text));
  const hasExhibits = Array.isArray(exhibits?.items) && exhibits.items.length > 0;

  return { intake, draft, exhibits, hasIntake, hasDraft, hasExhibits };
}

async function ensureUserDocExists(uid) {
  const ref = fsDoc("users", uid);
  const snap = await fsGetDoc(ref);
  return { ref, exists: snap.exists() };
}

function makeDraftId() {
  // stable enough for now; can be replaced with crypto later
  return "rfo_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
}

async function saveToAccount(user, imported) {
  const { ref: userRef, exists } = await ensureUserDocExists(user.uid);
  if (!exists) {
    throw new Error("User doc missing. Signup flow must create /users/{uid}.");
  }

  // Try preferred structure first: /users/{uid}/rfoDrafts/{draftId}
  // If rules deny subcollection writes, fallback to /users/{uid}.rfoWorkingSet (interim).
  const draftId = makeDraftId();
  const subRef = fsDoc("users", user.uid, "rfoDrafts", draftId);

  try {
    await fsSetDoc(subRef, {
      version: 1,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      workingSet: imported
    });
    return { mode: "subcollection", draftId };
  } catch (e) {
    // Fallback: store on user doc without touching entitlement fields (tier/active/role).
    await fsUpdateDoc(userRef, {
      rfoLastImportAt: nowISO(),
      rfoWorkingSet: imported
    });
    return { mode: "userdoc", draftId: null, error: String(e?.message || e) };
  }
}

(async function init() {
  setMsg("Loading…");

  const { user } = await getAuthStateOnce();
  if (!user) {
    // gate.js owns redirects; just stop.
    setMsg("Not signed in.");
    return;
  }

  setMsg("Ready. Import your public draft from this device, then save/export.");

  let imported = null;

  function refreshStatus(savedLabel) {
    const { hasIntake, hasDraft, hasExhibits } = getImportedFromLocal();
    setStatus("statusIntake", hasIntake, hasIntake ? "Found local intake" : "Missing local intake");
    setStatus("statusDraft", hasDraft, hasDraft ? "Found local draft text" : "Missing local draft text");
    setStatus("statusExhibits", hasExhibits, hasExhibits ? "Found local exhibit list" : "No exhibits listed (optional)");
    setStatus("statusAccount", !!savedLabel, savedLabel || "Not saved yet");
  }

  function doImport() {
    const pack = getImportedFromLocal();
    if (!pack.hasIntake || !pack.hasDraft) {
      setMsg("Missing local intake/draft on this device. Go complete the public funnel first.");
      refreshStatus("");
      return false;
    }

    imported = {
      version: 1,
      importedAt: nowISO(),
      source: "public_localStorage",
      intake: pack.intake,
      draft: pack.draft,
      exhibits: pack.exhibits
    };

    const packetText = buildPacket(imported.intake, imported.draft, imported.exhibits);
    $("packetText").value = packetText;

    setMsg("Imported. You can now Save to Account and Export/Print.");
    refreshStatus("Imported locally (not saved to account yet)");
    return true;
  }

  refreshStatus("");

  $("btnImport")?.addEventListener("click", () => {
    doImport();
  });

  // AUTO-IMPORT ON #import (canon-safe)
  if (wantsAutoImport()) {
    const ok = doImport();
    if (ok) {
      const tools = document.getElementById("tools");
      if (tools) tools.scrollIntoView({ behavior: "smooth", block: "start" });
      clearAutoImportHash();
    }
  }

  $("btnSaveAccount")?.addEventListener("click", async () => {
    try {
      if (!imported) {
        setMsg("Import first.");
        return;
      }
      setMsg("Saving to your account…");
      const res = await saveToAccount(user, imported);

      if (res.mode === "subcollection") {
        setMsg("Saved to account (draft record created). Export/print is ready.");
        refreshStatus("Saved to account: /users/{uid}/rfoDrafts/" + res.draftId);
      } else {
        setMsg("Saved to account (interim working set). Export/print is ready.");
        refreshStatus("Saved to account: /users/{uid}.rfoWorkingSet");
      }
    } catch (e) {
      console.error(e);
      setMsg("Save failed. Check console.");
      refreshStatus("Save failed");
    }
  });

  $("btnClearLocal")?.addEventListener("click", () => {
    const ok = confirm("Clear local PUBLIC draft data on this device?\n\nThis does not affect your saved account data.");
    if (!ok) return;
    clearLocalPublicKeys();
    setMsg("Cleared local public draft keys.");
    refreshStatus("");
  });

  $("btnPrint")?.addEventListener("click", () => {
    const text = safeStr($("packetText")?.value);
    if (!text) { setMsg("No packet text to print. Import first."); return; }
    openPrintWindow(text);
  });

  $("btnDownloadPacket")?.addEventListener("click", () => {
    const text = safeStr($("packetText")?.value);
    if (!text) { setMsg("No packet text to download. Import first."); return; }
    downloadText("SharpeSystem-RFO-Packet.txt", text);
  });

  $("btnDownloadDraft")?.addEventListener("click", () => {
    const localDraft = loadJSON(KEY_DRAFT);
    const text = safeStr(localDraft?.text) || safeStr($("packetText")?.value);
    if (!text) { setMsg("No draft text found."); return; }
    downloadText("SharpeSystem-RFO-Draft.txt", text);
  });

  $("btnDownloadExhibits")?.addEventListener("click", () => {
    const ex = loadJSON(KEY_EXHIBITS);
    const idxText = buildExhibitIndex(ex);
    downloadText("SharpeSystem-RFO-Exhibit-Index.txt", idxText);
  });
})();
