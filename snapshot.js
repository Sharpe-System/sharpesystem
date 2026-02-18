// /snapshot.js
// Snapshot (paid module).
// Canon rules:
// - NO redirects for auth/tier (gate.js owns gating)
// - NO Firebase CDN imports
// - Auth state via getAuthStateOnce()
// - Data access via /db.js and /firebase-config.js helpers only

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";
import { ensureUserDoc, readUserDoc } from "/db.js";

(function () {
  "use strict";

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function parseRisks(risks) {
    if (!risks) return null;
    if (typeof risks === "object") return risks;
    try {
      return JSON.parse(risks);
    } catch (_) {
      return null;
    }
  }

  function classify(intake) {
    const caseType = (intake?.caseType || "").toLowerCase();
    const stage = (intake?.stage || "").toLowerCase();
    const deadline = (intake?.nextDate || "").trim();
    const risks = parseRisks(intake?.risks) || {};

    let track = "General";
    if (caseType === "family") track = "Family / custody / divorce";
    else if (caseType === "protective_order") track = "Protective order";
    else if (caseType === "criminal") track = "Criminal";
    else if (caseType === "civil") track = "Civil";
    else if (caseType === "housing") track = "Housing";
    else if (caseType === "employment") track = "Employment";
    else if (caseType === "admin") track = "Government / benefits";
    else if (caseType === "unsure") track = "Not sure yet";
    else if (caseType === "other") track = "Other";

    let urgency = "Normal";
    if (deadline) urgency = "Deadline anchored";
    if (stage === "upcoming_hearing") urgency = "Upcoming hearing";
    if (stage === "responding") urgency = "Response window";
    if (risks?.safety) urgency = "Safety-sensitive";
    if (risks?.noContact) urgency = "No-contact constrained";

    // Minimal deterministic "next steps" (informational only; checklist.js will own real flow)
    const next = [];
    if (deadline) next.push("Confirm the exact court date/deadline and write it in your Timeline.");
    if (stage === "responding") next.push("Identify what you received and the response deadline.");
    if (stage === "upcoming_hearing") next.push("Prepare a one-page hearing outline and start an evidence list.");
    if (stage === "changing_order") next.push("List the change you want and the facts supporting best interests / necessity.");
    if (stage === "enforcement") next.push("List violations with dates, and gather supporting screenshots/records.");
    if (risks?.noContact) next.push("Plan communications assuming strict no-contact boundaries.");
    if (risks?.money) next.push("Prefer low-cost procedural options and prioritize must-file items.");
    if (next.length === 0) next.push("Complete Intake if anything is missing, then proceed to Checklist.");

    return { track, urgency, next, risks };
  }

  function render({ user, profile, intake }) {
    const box = $(".template-box") || $(".container.content") || document.body;
    const ctaRow = $(".cta-row", box) || null;

    const c = classify(intake);

    const riskLines = [];
    const r = c.risks || {};
    if (r.noContact) riskLines.push("No-contact / restraining order");
    if (r.safety) riskLines.push("Safety concern");
    if (r.money) riskLines.push("Fee sensitivity");
    if (r.language) riskLines.push("Language support");
    if (r.selfRep) riskLines.push("Self-represented");
    const where = (r.where || "").trim();

    const facts = (intake?.facts || "").trim();
    const goal = (intake?.goal || "").trim();
    const stage = (intake?.stage || "").trim();
    const caseType = (intake?.caseType || "").trim();
    const nextDate = (intake?.nextDate || "").trim();

    const html = `
      <div class="card" style="padding:14px; margin-top:12px;">
        <div class="row" style="justify-content:space-between; align-items:flex-start;">
          <div>
            <div class="muted" style="font-size:13px;">Signed in as</div>
            <div style="font-weight:800;">${esc(user?.email || "(no email)")}</div>
          </div>
          <div class="badge" title="Profile tier">
            Tier: ${esc(profile?.tier || "free")}
          </div>
        </div>

        <div class="hr"></div>

        <div class="grid-2">
          <div class="card" style="padding:12px;">
            <div class="muted" style="font-size:13px;">Track</div>
            <div style="font-weight:850; margin-top:4px;">${esc(c.track)}</div>
            <div class="muted" style="margin-top:8px;">Urgency</div>
            <div style="font-weight:850; margin-top:4px;">${esc(c.urgency)}</div>
          </div>

          <div class="card" style="padding:12px;">
            <div class="muted" style="font-size:13px;">Where</div>
            <div style="font-weight:750; margin-top:4px;">${esc(where || "—")}</div>
            <div class="muted" style="margin-top:8px;">Deadline / court date</div>
            <div style="font-weight:750; margin-top:4px;">${esc(nextDate || "—")}</div>
          </div>
        </div>

        <div class="hr"></div>

        <div class="grid-2">
          <div class="card" style="padding:12px;">
            <div class="muted" style="font-size:13px;">Intake</div>
            <div style="margin-top:8px;"><span class="badge">Case type: ${esc(caseType || "—")}</span></div>
            <div style="margin-top:8px;"><span class="badge">Stage: ${esc(stage || "—")}</span></div>
            <div class="muted" style="margin-top:10px;">Goal</div>
            <div style="margin-top:6px;">${esc(goal || "—")}</div>
          </div>

          <div class="card" style="padding:12px;">
            <div class="muted" style="font-size:13px;">Flags</div>
            ${
              riskLines.length
                ? `<ul style="margin:8px 0 0 18px; color:var(--muted);">
                    ${riskLines.map((x) => `<li>${esc(x)}</li>`).join("")}
                   </ul>`
                : `<div style="margin-top:8px;" class="muted">—</div>`
            }
          </div>
        </div>

        <div class="hr"></div>

        <div class="card" style="padding:12px;">
          <div class="muted" style="font-size:13px;">Facts (plain)</div>
          <div style="margin-top:8px; white-space:pre-wrap;">${esc(facts || "—")}</div>
        </div>

        <div class="hr"></div>

        <div class="card" style="padding:12px;">
          <div class="muted" style="font-size:13px;">Suggested next steps (informational)</div>
          <ol style="margin:10px 0 0 18px; color:var(--muted);">
            ${c.next.map((x) => `<li style="margin:6px 0;">${esc(x)}</li>`).join("")}
          </ol>
          <div class="muted" style="margin-top:10px; font-size:12px;">
            Next steps become your Checklist once saved items exist.
          </div>
        </div>
      </div>
    `;

    // Replace the placeholder "muted" line if present, and keep CTA row intact.
    const placeholder = $(".muted", box);
    if (placeholder) {
      placeholder.outerHTML = html;
    } else {
      box.insertAdjacentHTML("beforeend", html);
    }

    // Ensure CTA row stays at the bottom (if present)
    if (ctaRow) box.appendChild(ctaRow);
  }

  async function init() {
    try {
      const { user } = await getAuthStateOnce();
      if (!user) return; // gate.js handles auth redirect

      await ensureUserDoc(user.uid);

      const [profile, data] = await Promise.all([
        getUserProfile(user.uid).catch(() => ({})),
        readUserDoc(user.uid).catch(() => ({})),
      ]);

      const intake = data?.intake || {};

      render({ user, profile, intake });
    } catch (e) {
      console.error(e);
      const box = document.querySelector(".template-box") || document.body;
      box.insertAdjacentHTML(
        "beforeend",
        `<div class="alert warn" style="margin-top:12px;">Snapshot failed to load. Check console.</div>`
      );
    }
  }

  init();
})();
