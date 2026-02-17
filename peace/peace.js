// /peace/peace.js
// Peace Path v1 — additive-only Firestore module.
// Collections used:
//   threads (top-level)
//   threads/{threadId}/messages (subcollection)
//
// Auth Core compliance:
// - gate.js is the sole enforcement layer.
// - this file does NOT enforce tier/active or redirect.
// - this file does NOT re-initialize Firebase.
// - uses frozen firebase-config exports only (app + getAuthStateOnce).

import { app, getAuthStateOnce } from "/firebase-config.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const db = getFirestore(app);

// ------------------ policy defaults (v1) ------------------
const DEFAULTS = {
  cooldownMinutes: 120,
  deliveryWindow: { startHour: 8, endHour: 18, days: [1, 2, 3, 4, 5] }, // Mon–Fri
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
};

// ------------------ utilities ------------------
function $(id) { return document.getElementById(id); }

function pageIs(pathname) {
  return (window.location.pathname || "").toLowerCase() === pathname.toLowerCase();
}

function hasEl(id) {
  return !!document.getElementById(id);
}

function qs() {
  const p = new URLSearchParams(window.location.search || "");
  return Object.fromEntries(p.entries());
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nowMs() { return Date.now(); }

function addMinutes(tsMs, mins) {
  return tsMs + (mins * 60 * 1000);
}

function nextBusinessTime(fromDate, windowCfg) {
  const d = new Date(fromDate.getTime());
  const days = Array.isArray(windowCfg.days) ? windowCfg.days : [1, 2, 3, 4, 5];
  const startHour = Number(windowCfg.startHour ?? 8);
  const endHour = Number(windowCfg.endHour ?? 18);

  for (let i = 0; i < 14; i++) {
    const day = d.getDay();
    const okDay = days.includes(day);

    if (!okDay) {
      d.setDate(d.getDate() + 1);
      d.setHours(startHour, 0, 0, 0);
      continue;
    }

    const hour = d.getHours();

    if (hour < startHour) {
      d.setHours(startHour, 0, 0, 0);
      return d;
    }

    if (hour >= startHour && hour < endHour) {
      return d;
    }

    d.setDate(d.getDate() + 1);
    d.setHours(startHour, 0, 0, 0);
  }

  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

// Simple risk heuristic (v1 deterministic)
function assessRisk(text) {
  const t = String(text || "");
  const lower = t.toLowerCase();
  const tags = [];
  const hit = (re) => re.test(lower);

  if (hit(/\b(threat|kill|hurt|ruin|destroy|you will pay|take you to court)\b/)) tags.push("threats");
  if (hit(/\b(liar|crazy|psycho|idiot|stupid|worthless|deadbeat|narcissist)\b/)) tags.push("insults");
  if (hit(/\b(always|never)\b/)) tags.push("absolutes");
  if ((t.match(/!/g) || []).length >= 3) tags.push("excess_punct");
  if (t.length >= 40 && t === t.toUpperCase()) tags.push("all_caps");

  let level = "none";
  if (tags.length >= 4) level = "high";
  else if (tags.length >= 2) level = "medium";
  else if (tags.length === 1) level = "low";

  return { level, tags };
}

function suggestRewrite(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  return [
    "Goal: keep this clear, specific, and calm.",
    "",
    "1) What I’m asking for (one sentence):",
    "—",
    "",
    "2) The relevant facts (2–4 bullets, neutral):",
    "•",
    "•",
    "",
    "3) Two options that work for me:",
    "A) ",
    "B) ",
    "",
    "4) Requested response by (date/time):",
    "—",
    "",
    "Original draft (for your reference):",
    t
  ].join("\n");
}

function summaryForRecipient(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const first = t.split(". ")[0] || t;
  return (first.length > 180) ? first.slice(0, 180) + "…" : first;
}

function fmtWhen(ms) {
  const n = Number(ms || 0);
  if (!n) return "—";
  return new Date(n).toLocaleString();
}

// ------------------ auth helper (identity only) ------------------
async function requireUser() {
  const { user } = await getAuthStateOnce();
  if (!user) throw new Error("not_logged_in"); // gate should prevent this on paid pages
  return user;
}

// ------------------ threads ------------------
async function createThreadFor(uid, title, inviteEmail) {
  const docRef = await addDoc(collection(db, "threads"), {
    ownerUids: [uid],
    status: "active",
    title: String(title || "").trim() || "Peace Path Thread",
    inviteEmail: String(inviteEmail || "").trim().toLowerCase() || "",
    timezone: DEFAULTS.timezone,
    deliveryWindow: DEFAULTS.deliveryWindow,
    cooldownMinutes: DEFAULTS.cooldownMinutes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

async function listThreadsFor(uid) {
  const qy = query(
    collection(db, "threads"),
    where("ownerUids", "array-contains", uid),
    orderBy("updatedAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getThread(threadId) {
  const snap = await getDoc(doc(db, "threads", threadId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ------------------ messages ------------------
async function listMessages(threadId) {
  const qy = query(
    collection(db, "threads", threadId, "messages"),
    orderBy("createdAt", "desc"),
    limit(80)
  );
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function addCooldownMessage(thread, threadId, senderUid, text) {
  const risk = assessRisk(text);
  const cooldownMinutes = Number(thread.cooldownMinutes || DEFAULTS.cooldownMinutes);
  const cooldownExpiresAtMs = addMinutes(nowMs(), cooldownMinutes);

  const needsShield = (risk.level === "medium" || risk.level === "high");
  const summary = needsShield ? summaryForRecipient(text) : "";
  const rewrite = needsShield ? suggestRewrite(text) : "";

  const msgRef = await addDoc(collection(db, "threads", threadId, "messages"), {
    senderUid,
    createdAt: serverTimestamp(),

    originalText: String(text || "").trim(),
    suggestedRewrite: rewrite || "",
    summaryForRecipient: summary || "",

    riskLevel: risk.level,
    riskTags: risk.tags,

    state: "cooldown",
    cooldownExpiresAtMs,
    scheduledSendAtMs: null,
    deliveredAtMs: null,

    recipientShielded: needsShield,
    recipientViewedOriginalAtMs: null,

    unsent: false,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "threads", threadId), { updatedAt: serverTimestamp() });

  return msgRef.id;
}

async function unsendMessage(threadId, messageId, uid) {
  const ref = doc(db, "threads", threadId, "messages", messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const m = snap.data() || {};
  if (m.senderUid !== uid) return;
  if (m.state !== "cooldown") return;

  await updateDoc(ref, {
    state: "unsent",
    unsent: true,
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "threads", threadId), { updatedAt: serverTimestamp() });
}

async function finalizeScheduling(thread, threadId, uid) {
  // v1 deterministic client finalization:
  // cooldown expired -> scheduled
  // scheduled due -> delivered
  const msgs = await listMessages(threadId);
  const windowCfg = thread.deliveryWindow || DEFAULTS.deliveryWindow;

  for (const m of msgs) {
    if (m.senderUid !== uid) continue;

    // cooldown expired -> scheduled
    if (m.state === "cooldown" && Number(m.cooldownExpiresAtMs || 0) > 0) {
      if (nowMs() >= Number(m.cooldownExpiresAtMs)) {
        const target = nextBusinessTime(new Date(), windowCfg);
        await updateDoc(doc(db, "threads", threadId, "messages", m.id), {
          state: "scheduled",
          scheduledSendAtMs: target.getTime(),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "threads", threadId), { updatedAt: serverTimestamp() });
      }
    }

    // scheduled due -> delivered
    if (m.state === "scheduled" && Number(m.scheduledSendAtMs || 0) > 0) {
      if (nowMs() >= Number(m.scheduledSendAtMs)) {
        await updateDoc(doc(db, "threads", threadId, "messages", m.id), {
          state: "delivered",
          deliveredAtMs: nowMs(),
          updatedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, "threads", threadId), { updatedAt: serverTimestamp() });
      }
    }
  }
}

// ------------------ render helpers ------------------
function renderThreadCard(t) {
  const title = escapeHtml(t.title || "Peace Path Thread");
  const status = escapeHtml(t.status || "active");
  const invite = escapeHtml(t.inviteEmail || "");

  return `
    <div class="card" style="padding:14px;">
      <div class="row" style="justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:700; letter-spacing:.2px;">${title}</div>
          <div class="small soft">Status: ${status}${invite ? ` · Invite: ${invite}` : ""}</div>
        </div>
        <div class="row">
          <a class="btn primary" href="/peace/thread.html?id=${encodeURIComponent(t.id)}">Open</a>
        </div>
      </div>
    </div>
  `;
}

function badgeForState(state) {
  const s = String(state || "");
  if (s === "cooldown") return `<span class="badge"><span style="width:8px;height:8px;border-radius:50%;background:rgba(251,191,36,.9);display:inline-block;"></span>Cooldown</span>`;
  if (s === "scheduled") return `<span class="badge"><span style="width:8px;height:8px;border-radius:50%;background:rgba(110,231,255,.85);display:inline-block;"></span>Scheduled</span>`;
  if (s === "delivered") return `<span class="badge"><span style="width:8px;height:8px;border-radius:50%;background:rgba(52,211,153,.9);display:inline-block;"></span>Delivered</span>`;
  if (s === "unsent") return `<span class="badge"><span style="width:8px;height:8px;border-radius:50%;background:rgba(251,113,133,.9);display:inline-block;"></span>Unsent</span>`;
  return `<span class="badge">Draft</span>`;
}

function renderMessage(m, currentUid, threadId) {
  const text = escapeHtml(m.originalText || "");
  const state = String(m.state || "draft");
  const risk = String(m.riskLevel || "none");
  const riskTags = Array.isArray(m.riskTags) ? m.riskTags.join(", ") : "";
  const createdAt = (m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : "");

  const cooldownUntil = fmtWhen(m.cooldownExpiresAtMs);
  const scheduledFor = fmtWhen(m.scheduledSendAtMs);
  const deliveredAt = fmtWhen(m.deliveredAtMs);

  const mine = (m.senderUid === currentUid);

  const riskLine = (risk !== "none")
    ? `<div class="small soft">Risk: <strong>${escapeHtml(risk)}</strong>${riskTags ? ` · Tags: ${escapeHtml(riskTags)}` : ""}</div>`
    : `<div class="small soft">Risk: none</div>`;

  const meta = `
    <div class="small soft">
      ${createdAt ? `Created: ${escapeHtml(createdAt)} · ` : ""}
      Cooldown until: ${escapeHtml(cooldownUntil)} · Scheduled: ${escapeHtml(scheduledFor)} · Delivered: ${escapeHtml(deliveredAt)}
    </div>
  `;

  const actions = (mine && state === "cooldown")
    ? `<div class="row" style="margin-top:10px;">
         <button class="btn danger" data-unsend="1" data-mid="${escapeHtml(m.id)}" data-tid="${escapeHtml(threadId)}" type="button">Unsend (during cooldown)</button>
       </div>`
    : "";

  const rewrite = (m.suggestedRewrite && (risk === "medium" || risk === "high"))
    ? `<details style="margin-top:10px;">
         <summary class="small soft">Suggested calmer rewrite</summary>
         <pre class="card" style="padding:12px; white-space:pre-wrap; margin-top:10px;">${escapeHtml(m.suggestedRewrite)}</pre>
       </details>`
    : "";

  return `
    <div class="card" style="padding:14px;">
      <div class="row" style="justify-content:space-between; align-items:flex-start;">
        <div style="max-width:860px;">
          ${riskLine}
          <div style="margin-top:8px; white-space:pre-wrap;">${text}</div>
          ${rewrite}
          <div style="margin-top:10px;">${meta}</div>
        </div>
        <div>${badgeForState(state)}</div>
      </div>
      ${actions}
    </div>
  `;
}

// ------------------ boot index ------------------
async function bootPeaceIndex() {
  const who = $("who");
  const threadsList = $("threadsList");
  const emptyState = $("emptyState");

  const createBtn = $("createBtn");
  const createMsg = $("createMsg");
  const titleEl = $("threadTitle");
  const inviteEl = $("inviteEmail");

  const user = await requireUser();
  if (who) who.textContent = `Signed in as ${user.email || user.uid}`;

  async function refresh() {
    if (!threadsList) return;
    threadsList.innerHTML = "";

    const threads = await listThreadsFor(user.uid);
    if (!threads.length) {
      if (emptyState) emptyState.style.display = "";
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    threadsList.innerHTML = threads.map(renderThreadCard).join("");
  }

  createBtn?.addEventListener("click", async () => {
    if (createMsg) createMsg.textContent = "";
    createBtn.disabled = true;

    try {
      const title = (titleEl?.value || "").trim();
      const inviteEmail = (inviteEl?.value || "").trim();

      const id = await createThreadFor(user.uid, title, inviteEmail);
      if (createMsg) createMsg.textContent = "Thread created. Opening…";
      window.location.href = `/peace/thread.html?id=${encodeURIComponent(id)}`;
    } catch (e) {
      console.log(e);
      if (createMsg) createMsg.textContent = "Unable to create thread. Try again.";
      createBtn.disabled = false;
    }
  });

  await refresh();
}

// ------------------ boot thread ------------------
async function bootPeaceThread() {
  const who = $("who");
  const titleNode = $("threadTitle");
  const messagesList = $("messagesList");
  const emptyState = $("emptyState");

  const msgText = $("msgText");
  const sendBtn = $("sendBtn");
  const rewriteBtn = $("rewriteBtn");
  const clearBtn = $("clearBtn");
  const composeMsg = $("composeMsg");
  const riskBox = $("riskBox");

  const user = await requireUser();
  if (who) who.textContent = `Signed in as ${user.email || user.uid}`;

  const { id: threadId } = qs();
  if (!threadId) {
    if (titleNode) titleNode.textContent = "Thread not found";
    if (messagesList) messagesList.innerHTML = `<div class="alert bad"><strong>Error:</strong> Missing thread id.</div>`;
    return;
  }

  const thread = await getThread(threadId);
  if (!thread) {
    if (titleNode) titleNode.textContent = "Thread not found";
    if (messagesList) messagesList.innerHTML = `<div class="alert bad"><strong>Error:</strong> Thread does not exist.</div>`;
    return;
  }

  if (titleNode) titleNode.textContent = thread.title || "Peace Path Thread";

  await finalizeScheduling(thread, threadId, user.uid);

  async function refreshMessages() {
    if (!messagesList) return;

    const msgs = await listMessages(threadId);

    if (!msgs.length) {
      if (emptyState) emptyState.style.display = "";
      messagesList.innerHTML = "";
      return;
    }

    if (emptyState) emptyState.style.display = "none";
    messagesList.innerHTML = msgs.map(m => renderMessage(m, user.uid, threadId)).join("");

    messagesList.querySelectorAll('button[data-unsend="1"]').forEach(btn => {
      btn.addEventListener("click", async () => {
        const mid = btn.getAttribute("data-mid");
        if (!mid) return;
        btn.disabled = true;
        await unsendMessage(threadId, mid, user.uid);
        await refreshMessages();
      });
    });
  }

  function setRiskUI(risk) {
    if (!riskBox) return;

    if (risk.level === "none") {
      riskBox.style.display = "none";
      riskBox.innerHTML = "";
      if (rewriteBtn) rewriteBtn.style.display = "none";
      return;
    }

    const cls = (risk.level === "high") ? "bad" : (risk.level === "medium" ? "warn" : "");
    riskBox.className = "alert " + cls;
    riskBox.style.display = "";
    riskBox.innerHTML =
      `<strong>Heads up:</strong> This draft may read poorly in court (${escapeHtml(risk.level)}).
       ${risk.tags?.length ? `<div class="small soft" style="margin-top:6px;">Tags: ${escapeHtml(risk.tags.join(", "))}</div>` : ""}`;

    if (rewriteBtn) rewriteBtn.style.display = (risk.level === "medium" || risk.level === "high") ? "" : "none";
  }

  rewriteBtn?.addEventListener("click", () => {
    const t = String(msgText?.value || "");
    const r = suggestRewrite(t);
    if (!r) return;

    if (composeMsg) {
      composeMsg.innerHTML = `<div class="alert">Suggested rewrite inserted below. Adjust it in your own words.</div>`;
    }

    if (msgText) msgText.value = r;
    setRiskUI(assessRisk(msgText.value));
  });

  clearBtn?.addEventListener("click", () => {
    if (msgText) msgText.value = "";
    if (composeMsg) composeMsg.textContent = "";
    setRiskUI({ level: "none", tags: [] });
  });

  msgText?.addEventListener("input", () => {
    setRiskUI(assessRisk(msgText.value));
  });

  sendBtn?.addEventListener("click", async () => {
    if (composeMsg) composeMsg.textContent = "";

    const text = String(msgText?.value || "").trim();
    if (!text) {
      if (composeMsg) composeMsg.textContent = "Write something first.";
      return;
    }

    sendBtn.disabled = true;
    try {
      await addCooldownMessage(thread, threadId, user.uid, text);

      if (msgText) msgText.value = "";
      setRiskUI({ level: "none", tags: [] });

      if (composeMsg) {
        composeMsg.innerHTML = `<div class="alert ok"><strong>Cooldown started.</strong> You can unsend during the cooldown window.</div>`;
      }

      await refreshMessages();
    } catch (e) {
      console.log(e);
      if (composeMsg) composeMsg.textContent = "Unable to save message. Try again.";
    } finally {
      sendBtn.disabled = false;
    }
  });

  await refreshMessages();

  setInterval(async () => {
    try {
      await finalizeScheduling(thread, threadId, user.uid);
      await refreshMessages();
    } catch (_) {}
  }, 20000);
}

// ------------------ auto-boot (based on page) ------------------
// Canon compliance: HTML loads /peace/peace.js as page module.
// This file decides what to initialize based on the served page.
document.addEventListener("DOMContentLoaded", () => {
  if (pageIs("/peace/index.html") || hasEl("threadsList")) {
    bootPeaceIndex().catch(() => {});
    return;
  }
  if (pageIs("/peace/thread.html") || hasEl("messagesList")) {
    bootPeaceThread().catch(() => {});
    return;
  }
});
