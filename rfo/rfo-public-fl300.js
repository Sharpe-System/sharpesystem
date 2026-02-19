/* /rfo/rfo-public-fl300.js
   Public FL-300 mapper (localStorage only; text blocks only).
   Fixes:
   - Conservative "fit budgets" so courthouse PDF printing doesn't truncate as often
   - Auto-spill to MC-030 when draft exceeds fit budgets
   - Generates in-form summary + "See attached MC-030" + user-facing check/attachment instructions
   Canon (public):
   - NO gate.js usage
   - NO Firebase imports
   - NO redirects for auth/tier
*/

(function () {
  "use strict";

  const KEY_INTAKE = "ss_rfo_public_v1";
  const KEY_DRAFT = "ss_rfo_public_draft_v1";
  const KEY_FL300 = "ss_rfo_public_fl300_v1";

  function $(id) { return document.getElementById(id); }
  function safeStr(v) { return String(v ?? "").trim(); }
  function nowISO() { try { return new Date().toISOString(); } catch (_) { return ""; } }

  function toast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "20px";
    el.style.transform = "translateX(-50%)";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "10px";
    el.style.background = "rgba(0,0,0,.85)";
    el.style.color = "#fff";
    el.style.fontSize = "14px";
    el.style.zIndex = "9999";
    el.style.maxWidth = "90vw";
    document.body.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 1200);
  }

  function loadJSON(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function saveJSON(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
      return true;
    } catch (_) {
      alert("Unable to save. Your browser may be blocking storage or is full.");
      return false;
    }
  }

  function getSpillMode() {
    const auto = $("modeAuto");
    const max = $("modeMax");
    if (auto && auto.checked) return "auto";
    if (max && max.checked) return "maximize";
    return "auto";
  }

  function getStrictness() {
    return safeStr($("fitStrictness")?.value) || "safe";
  }

  function budgets(strictness) {
    // These are intentionally conservative to address courthouse PDF cutoffs.
    // You can tune later by form testing, but safe defaults prevent "looks like 4 lines, prints like 1.5".
    if (strictness === "aggressive") {
      return { orders: 900, why: 900, hardCap: 2200 };
    }
    if (strictness === "balanced") {
      return { orders: 650, why: 650, hardCap: 1800 };
    }
    return { orders: 450, why: 450, hardCap: 1400 };
  }

  function readInputs() {
    return {
      court: {
        county: safeStr($("county")?.value) || "Orange",
        caseNumber: safeStr($("caseNumber")?.value),
      },
      parties: {
        petitionerName: safeStr($("petitionerName")?.value),
        respondentName: safeStr($("respondentName")?.value),
      },
      request: {
        primary: safeStr($("primaryRequest")?.value),
        urgency: safeStr($("urgency")?.value),
        oneSentence: safeStr($("oneSentence")?.value),
      },
      spill: {
        mode: getSpillMode(),
        strictness: getStrictness()
      }
    };
  }

  function writeInputs(data) {
    $("county").value = data?.court?.county || "Orange";
    $("caseNumber").value = data?.court?.caseNumber || "";
    $("petitionerName").value = data?.parties?.petitionerName || "";
    $("respondentName").value = data?.parties?.respondentName || "";
    $("primaryRequest").value = data?.request?.primary || "";
    $("urgency").value = data?.request?.urgency || "";
    $("oneSentence").value = data?.request?.oneSentence || "";

    const mode = data?.spill?.mode || "auto";
    if ($("modeAuto")) $("modeAuto").checked = mode === "auto";
    if ($("modeMax")) $("modeMax").checked = mode === "maximize";

    $("fitStrictness").value = data?.spill?.strictness || "safe";
  }

  function labelPrimary(primary) {
    return primary === "custody_visitation" ? "custody and visitation" :
      primary === "support_child" ? "child support" :
      primary === "support_spousal" ? "spousal support" :
      primary === "orders_other" ? "other family-law orders" :
      "orders";
  }

  function labelUrgency(urg) {
    return urg === "time_sensitive" ? "time-sensitive" :
      urg === "safety" ? "safety-related" :
      urg === "standard" ? "standard" :
      "standard";
  }

  function splitSentences(text) {
    const t = safeStr(text);
    if (!t) return [];
    // Simple sentence split; good enough for summary selection
    return t
      .replace(/\r\n/g, "\n")
      .split(/(?<=[.!?])\s+/)
      .map((s) => safeStr(s))
      .filter(Boolean);
  }

  function summarize(text, maxChars) {
    const sentences = splitSentences(text);
    if (sentences.length === 0) return "";

    const picked = [];
    let total = 0;

    for (const s of sentences) {
      // prefer shorter sentences; skip super long ones
      const ss = s.length > 240 ? (s.slice(0, 236) + "…") : s;
      const add = (picked.length ? 1 : 0) + ss.length;
      if (total + add > maxChars) break;
      picked.push(ss);
      total += add;
      if (picked.length >= 3) break;
    }

    if (picked.length === 0) {
      const head = sentences[0];
      return head.length > maxChars ? (head.slice(0, Math.max(0, maxChars - 1)) + "…") : head;
    }

    return picked.join(" ");
  }

  function buildAttachLine(caseNumber, forceMC030) {
    const cn = safeStr(caseNumber);
    const base = forceMC030
      ? "Please see attached MC-030 Declaration and exhibit index for supporting facts."
      : "See attached declaration (MC-030) and exhibit index if applicable.";

    if (cn) return base + " Case No.: " + cn + ".";
    return base;
  }

  function mc030Decision(declText, b, mode) {
    const dt = safeStr(declText);
    if (!dt) return { required: false, reason: "No declaration text found in Public Draft." };

    // If the narrative is extremely long, always require attachment regardless of maximize mode.
    if (dt.length > b.hardCap) {
      return { required: true, reason: `Declaration length (${dt.length} chars) exceeds hard cap (${b.hardCap}).` };
    }

    if (mode === "auto") {
      // Auto: require MC-030 if narrative is longer than safe on-form budgets
      if (dt.length > Math.max(b.orders, b.why)) {
        return { required: true, reason: `Declaration length (${dt.length} chars) exceeds in-form fit budget.` };
      }
      return { required: false, reason: `Declaration length (${dt.length} chars) fits within selected budget.` };
    }

    // Maximize: allow longer, but still require if it exceeds aggressive packing beyond budgets
    if (dt.length > Math.round(Math.max(b.orders, b.why) * 1.5)) {
      return { required: true, reason: `Declaration length (${dt.length} chars) is too long to reliably print in FL-300 fields.` };
    }
    return { required: false, reason: `Maximize mode: allowing in-form text (still at risk of cutoff depending on PDF).` };
  }

  function buildFLOrders(inputs, decision, declText) {
    const primary = safeStr(inputs?.request?.primary);
    const urg = safeStr(inputs?.request?.urgency);
    const oneSentence = safeStr(inputs?.request?.oneSentence);

    const lines = [];
    lines.push(`I request the Court issue orders regarding ${labelPrimary(primary)}.`);

    // If MC-030 required, keep orders short + point to MC-030.
    if (decision.required) {
      if (oneSentence) lines.push(oneSentence);
      else lines.push("I request clear, specific, workable, and enforceable orders.");
      if (urg) lines.push(`This request is ${labelUrgency(urg)}.`);
      lines.push("Please see attached MC-030 Declaration.");
      return lines.join(" ");
    }

    // If MC-030 not required, allow more content, but still keep readable.
    if (oneSentence) lines.push(oneSentence);

    const dt = safeStr(declText);
    if (dt) {
      // Try to pack some facts if available.
      const extra = summarize(dt, 260);
      if (extra) lines.push("Summary facts: " + extra);
    }

    if (urg) lines.push(`This request is ${labelUrgency(urg)}.`);
    return lines.join(" ");
  }

  function buildFLWhy(inputs, decision, declText, b) {
    const primary = safeStr(inputs?.request?.primary);
    const urg = safeStr(inputs?.request?.urgency);

    const whyBase =
      primary === "custody_visitation"
        ? "Current parenting time orders are not working as written in practice, and a specific schedule is needed."
        : primary === "support_child"
        ? "A change in circumstances supports guideline recalculation and clear payment terms."
        : primary === "support_spousal"
        ? "A change in circumstances supports review and appropriate adjustment of support."
        : "Current orders are not workable and require clarification/modification.";

    const urgencyNote =
      urg === "safety" ? "This request involves safety-related concerns." :
      urg === "time_sensitive" ? "This request is time-sensitive due to upcoming events/deadlines." :
      "";

    if (decision.required) {
      const parts = [whyBase];
      if (urgencyNote) parts.push(urgencyNote);
      parts.push("Please see attached MC-030 Declaration for full facts and chronology.");
      return parts.join(" ");
    }

    // If not required, allow more "why" text but respect budgets.
    const max = b.why;
    const dt = safeStr(declText);
    const extra = dt ? summarize(dt, Math.max(200, Math.min(420, max - 120))) : "";
    const parts = [whyBase];
    if (urgencyNote) parts.push(urgencyNote);
    if (extra) parts.push("Key facts: " + extra);
    return parts.join(" ");
  }

  function buildCheckInstructions(decision, inputs) {
    const cn = safeStr(inputs?.court?.caseNumber);
    const lines = [];
    lines.push("COURT PDF INSTRUCTIONS (PUBLIC MODE)");
    lines.push("");
    lines.push("1) Paste the generated blocks into the corresponding FL-300 text fields.");
    lines.push("2) Use short, printable text in FL-300. Long narrative belongs in MC-030 pages.");
    lines.push("");

    if (decision.required) {
      lines.push("MC-030 TRIGGER: YES");
      lines.push("- Print and attach an MC-030 Declaration containing your full narrative.");
      lines.push("- In the FL-300 fields, keep text short and include: “Please see attached MC-030 Declaration.”");
      lines.push("- If the FL-300 has any checkbox/line for attachments/declaration, mark it to indicate you attached a declaration.");
    } else {
      lines.push("MC-030 TRIGGER: NO (optional)");
      lines.push("- You may proceed without MC-030 if your in-form text prints cleanly.");
      lines.push("- If you want more precision, you can still attach MC-030 and reference it briefly in FL-300.");
    }

    if (cn) {
      lines.push("");
      lines.push("Case No.: " + cn);
    }

    lines.push("");
    lines.push("Reminder: This is a structured guide, not legal advice. Confirm requirements for your case type and county.");
    return lines.join("\n");
  }

  async function copyText(text) {
    const t = safeStr(text);
    if (!t) { toast("Nothing to copy"); return; }
    try {
      await navigator.clipboard.writeText(t);
      toast("Copied");
    } catch (_) {
      toast("Clipboard blocked — select + copy");
    }
  }

  function regen() {
    const inputs = readInputs();
    const strictness = inputs.spill.strictness;
    const b = budgets(strictness);
    const mode = inputs.spill.mode;

    const draft = loadJSON(KEY_DRAFT);
    const declText = safeStr(draft?.text);

    // Decide if MC-030 required
    const decision = mc030Decision(declText, b, mode);

    // Status UI
    $("mc030Status").textContent = decision.required ? "✅ MC-030 REQUIRED (spillover triggered)" : "⚠️ MC-030 NOT REQUIRED (optional)";
    $("mc030Reason").textContent = decision.reason;

    // Outputs
    const orders = buildFLOrders(inputs, decision, declText);
    const why = buildFLWhy(inputs, decision, declText, b);
    const attach = buildAttachLine(inputs?.court?.caseNumber, decision.required);
    const checks = buildCheckInstructions(decision, inputs);

    $("flOrders").value = orders;
    $("flWhy").value = why;
    $("flAttach").value = attach;
    $("checkInstructions").value = checks;
    $("declText").value = declText || "";

    // Persist
    saveJSON(KEY_FL300, {
      version: 2,
      updatedAt: nowISO(),
      inputs,
      budgets: b,
      decision,
      outputs: { orders, why, attach, checks }
    });
  }

  function init() {
    const intake = loadJSON(KEY_INTAKE);
    const prior = loadJSON(KEY_FL300);

    if (prior?.inputs) {
      writeInputs(prior.inputs);
    } else if (intake) {
      writeInputs({
        court: intake.court,
        parties: intake.parties,
        request: intake.request,
        spill: { mode: "auto", strictness: "safe" }
      });
    } else {
      // defaults
      writeInputs({ spill: { mode: "auto", strictness: "safe" } });
    }

    // Ensure one mode selected
    if (!$("modeAuto").checked && !$("modeMax").checked) $("modeAuto").checked = true;

    regen();

    $("btnRegen")?.addEventListener("click", regen);

    $("btnCopyOrders")?.addEventListener("click", () => copyText($("flOrders").value));
    $("btnCopyWhy")?.addEventListener("click", () => copyText($("flWhy").value));
    $("btnCopyAttach")?.addEventListener("click", () => copyText($("flAttach").value));
    $("btnCopyDecl")?.addEventListener("click", () => copyText($("declText").value));
    $("btnCopyChecks")?.addEventListener("click", () => copyText($("checkInstructions").value));

    $("btnCopyAll")?.addEventListener("click", () => {
      const all = [
        "FL-300 COPY PACK (PUBLIC)",
        "",
        "ORDERS REQUESTED (paste into FL-300):",
        safeStr($("flOrders").value),
        "",
        "WHY SUMMARY (paste into FL-300):",
        safeStr($("flWhy").value),
        "",
        "ATTACHMENT LINE (paste into FL-300):",
        safeStr($("flAttach").value),
        "",
        "COURT PDF CHECK/ATTACH INSTRUCTIONS:",
        safeStr($("checkInstructions").value),
        "",
        "MC-030 DECLARATION TEXT (print + attach if triggered):",
        safeStr($("declText").value)
      ].join("\n");
      copyText(all);
    });

    $("btnSave")?.addEventListener("click", () => {
      const prior = loadJSON(KEY_FL300) || {};
      const ok = saveJSON(KEY_FL300, {
        ...(typeof prior === "object" ? prior : {}),
        version: 2,
        updatedAt: nowISO(),
        inputs: readInputs(),
        outputs: {
          orders: safeStr($("flOrders").value),
          why: safeStr($("flWhy").value),
          attach: safeStr($("flAttach").value),
          checks: safeStr($("checkInstructions").value)
        }
      });
      if (ok) toast("Saved");
    });

    [
      "county", "caseNumber", "petitionerName", "respondentName",
      "primaryRequest", "urgency", "oneSentence",
      "fitStrictness", "modeAuto", "modeMax"
    ].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", regen);
      el.addEventListener("input", () => {
        if (el.__ss_rfo_tick) return;
        el.__ss_rfo_tick = true;
        requestAnimationFrame(() => {
          el.__ss_rfo_tick = false;
          regen();
        });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
