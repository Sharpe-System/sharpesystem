/* /rfo/rfo-exparte-print.js
   Paid Ex Parte Export / Import
   Canon:
   - No redirects/tier checks (gate.js owns gating)
   - No Firebase CDN imports here
   - Auth state via getAuthStateOnce()
   - Local import from localStorage (public keys)
   - Export JSON includes mc030Text + overflow + pleading attachment when triggered
*/

import { getAuthStateOnce } from "/firebase-config.js";

const KEYS = {
  intake: "ss_rfo_exparte_intake_v1",
  fl300: "ss_rfo_exparte_fl300_v1",
  fl305: "ss_rfo_exparte_fl305_v1",
  notice: "ss_rfo_exparte_notice_v1",
  decl: "ss_rfo_exparte_decl_v1",
  proposed: "ss_rfo_exparte_proposed_v1",
  pleading: "ss_pleading_paper_v1"
};

function $(id) { return document.getElementById(id); }

function loadJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); }
  catch (_) { return null; }
}

function ok(v) {
  return v && typeof v === "object" && Object.keys(v).length > 0;
}

function noticeComplete(n) {
  if (!n) return false;
  if (n.noticeGiven === "yes" || n.noticeGiven === "attempted") return !!(n.noticeMethod || n.noticeWhen);
  if (n.noticeGiven === "no") return !!n.noticeWhyNot;
  return false;
}

function nowIso() {
  try { return new Date().toISOString(); } catch (_) { return ""; }
}

function buildPacket(userUid) {
  const intake = loadJson(KEYS.intake) || {};
  const fl300 = loadJson(KEYS.fl300) || {};
  const fl305 = loadJson(KEYS.fl305) || {};
  const notice = loadJson(KEYS.notice) || {};
  const decl = loadJson(KEYS.decl) || {};
  const proposed = loadJson(KEYS.proposed) || {};
  const pleading = loadJson(KEYS.pleading) || null;

  // Ensure declaration contains mc030Text + overflow metadata (even if older save)
  const mc030Text = decl.mc030Text || "";
  const overflow = decl.overflow || { triggered: false, pleadingKey: null };

  const overflowTriggered = !!overflow.triggered;
  const pleadingIncluded = overflowTriggered ? (ok(pleading) ? true : false) : true;

  const readiness = {
    intake: ok(intake),
    fl300: ok(fl300),
    fl305: ok(fl305),
    notice: noticeComplete(notice),
    decl: ok(decl) && !!mc030Text,
    proposed: ok(proposed),
    pleadingAttachment: pleadingIncluded
  };

  const ready = Object.values(readiness).every(Boolean);

  const packet = {
    schema: "ss_rfo_exparte_packet_v1",
    createdAt: nowIso(),
    jurisdiction: {
      state: intake?.jurisdiction?.state || "ca",
      county: intake?.jurisdiction?.county || "orange",
      court: intake?.jurisdiction?.court || "Superior Court of California"
    },
    user: {
      uid: userUid || null
    },
    slices: {
      intake,
      fl300,
      fl305,
      notice,
      decl: {
        ...decl,
        mc030Text,
        overflow
      },
      proposed
    },
    attachments: {
      // Only include pleading paper if overflow triggered
      pleadingPaper: overflowTriggered ? (pleading || null) : null
    },
    readiness: {
      ...readiness,
      ready
    }
  };

  return { packet, ready, overflowTriggered, pleadingIncluded };
}

function buildTextPreview(packet) {
  const lines = [];
  lines.push("EX PARTE PACKET (PAID PREVIEW)");
  lines.push("");

  const fl300 = packet?.slices?.fl300 || {};
  const fl305 = packet?.slices?.fl305 || {};
  const decl = packet?.slices?.decl || {};
  const notice = packet?.slices?.notice || {};
  const prop = packet?.slices?.proposed || {};
  const plead = packet?.attachments?.pleadingPaper || null;

  if (fl300.ordersRequested) {
    lines.push("FL-300 — Orders Requested:");
    lines.push(fl300.ordersRequested);
    lines.push("");
  }

  if (fl305.orders) {
    lines.push("FL-305 — Temporary Emergency Orders:");
    lines.push(fl305.orders);
    lines.push("");
  }

  if (decl.mc030Text) {
    lines.push("MC-030 TEXT (mapped):");
    lines.push(decl.mc030Text);
    lines.push("");
  }

  if (notice.noticeGiven) {
    lines.push("NOTICE:");
    lines.push(
      `Given: ${notice.noticeGiven || ""} | Method: ${notice.noticeMethod || ""} | When: ${notice.noticeWhen || ""}`
    );
    if (notice.noticeWhyNot) lines.push(`Why not: ${notice.noticeWhyNot}`);
    lines.push("");
  }

  if (prop.orders) {
    lines.push("PROPOSED ORDER:");
    lines.push(prop.orders);
    lines.push("");
  }

  if (decl.overflow?.triggered) {
    lines.push("ATTACHMENT:");
    lines.push("Pleading paper declaration is REQUIRED (overflow triggered).");
    if (plead?.body) {
      lines.push("");
      lines.push("PLEADING PAPER (body):");
      lines.push(plead.body);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function downloadJson(obj, filename) {
  const json = JSON.stringify(obj, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function init() {
  const user = await getAuthStateOnce();
  if (!user) {
    $("status").textContent = "Login required.";
    $("importStatus").textContent = "Not logged in.";
    $("readyStatus").textContent = "Not logged in.";
    return;
  }

  const wantsImport = (location.hash || "").toLowerCase() === "#import";
  $("importStatus").textContent = wantsImport
    ? "Import mode active (#import). Reading public localStorage keys."
    : "Normal mode. Reading localStorage keys if present.";

  const { packet, ready, overflowTriggered, pleadingIncluded } = buildPacket(user.uid);

  // Readiness messaging
  if (ready) {
    $("readyStatus").textContent = "READY — packet complete.";
    $("readyStatus").style.color = "#0a0";
  } else if (overflowTriggered && !pleadingIncluded) {
    $("readyStatus").textContent = "INCOMPLETE — overflow triggered but pleading attachment missing.";
    $("readyStatus").style.color = "#a60";
  } else {
    $("readyStatus").textContent = "INCOMPLETE — missing one or more packet slices.";
    $("readyStatus").style.color = "#a00";
  }

  const jsonText = JSON.stringify(packet, null, 2);
  $("packetJson").value = jsonText;
  $("packetText").value = buildTextPreview(packet);

  $("btnDownloadJson").onclick = () => {
    const ts = nowIso().replaceAll(":", "-");
    downloadJson(packet, `ss-exparte-packet-${ts}.json`);
    $("status").textContent = "Downloaded packet JSON.";
  };

  $("btnCopyJson").onclick = async () => {
    await navigator.clipboard.writeText(jsonText);
    $("status").textContent = "Copied packet JSON.";
  };

  $("btnPrint").onclick = () => {
    window.print();
  };

  $("status").textContent = "Loaded.";
}

init();
