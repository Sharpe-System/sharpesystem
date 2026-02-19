/* /rfo/rfo-public-service.js
   Public service + proof-of-service workflow (localStorage only; text-only outputs).
   Canon (public):
   - NO gate.js usage
   - NO Firebase imports
   - NO redirects for auth/tier
*/

(function () {
  "use strict";

  const KEY_INTAKE = "ss_rfo_public_v1";
  const KEY_PUBLIC_SERVICE = "ss_rfo_public_service_v1";

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

  function readInputs() {
    return {
      hearingDate: safeStr($("hearingDate")?.value),
      hearingTime: safeStr($("hearingTime")?.value),
      county: safeStr($("county")?.value) || "Orange",
      caseNumber: safeStr($("caseNumber")?.value),
      servedParty: safeStr($("servedParty")?.value),
      servedRole: safeStr($("servedRole")?.value),
      serviceMethod: safeStr($("serviceMethod")?.value),
      hasAddress: safeStr($("hasAddress")?.value),
      hasNoContact: safeStr($("hasNoContact")?.value),
      serverType: safeStr($("serverType")?.value),
    };
  }

  function writeInputs(x) {
    $("hearingDate").value = x?.hearingDate || "";
    $("hearingTime").value = x?.hearingTime || "";
    $("county").value = x?.county || "Orange";
    $("caseNumber").value = x?.caseNumber || "";
    $("servedParty").value = x?.servedParty || "";
    $("servedRole").value = x?.servedRole || "";
    $("serviceMethod").value = x?.serviceMethod || "";
    $("hasAddress").value = x?.hasAddress || "";
    $("hasNoContact").value = x?.hasNoContact || "";
    $("serverType").value = x?.serverType || "";
  }

  function computePOSForm(x) {
    // Conservative (public) logic:
    // - Default to personal service unless user explicitly selects mail AND has reliable address.
    // - Mail service is "allowed only in some situations" (user must verify). We still output FL-335 guidance if selected.
    const method = x.serviceMethod === "unknown" ? "" : x.serviceMethod;

    const wantsMail = method === "mail";
    const hasAddr = x.hasAddress === "yes";
    const noContact = x.hasNoContact === "yes";

    if (wantsMail && hasAddr && !noContact) {
      return {
        form: "FL-335 (Proof of Service by Mail)",
        notes:
          "Use only if service by mail is permitted for your specific situation/case posture. If uncertain, use personal service (FL-330)."
      };
    }

    return {
      form: "FL-330 (Proof of Personal Service)",
      notes:
        "Recommended default. Personal service is generally the safest way to avoid service disputes. Use a registered process server if there are safety/no-contact constraints."
    };
  }

  function estimateDeadline(x) {
    // We avoid stating legal deadlines as facts. We provide a conservative reminder.
    // We'll compute: hearingDate - 16 days as a reminder target (common-ish for motion practice),
    // but label clearly as a reminder, not a rule.
    if (!x.hearingDate) return { ok: false, text: "Enter hearing date/time…" };
    const d = new Date(x.hearingDate + "T00:00:00");
    if (isNaN(+d)) return { ok: false, text: "Invalid hearing date." };
    const reminder = new Date(+d - 16 * 24 * 60 * 60 * 1000);
    const yyyy = reminder.getFullYear();
    const mm = String(reminder.getMonth() + 1).padStart(2, "0");
    const dd = String(reminder.getDate()).padStart(2, "0");
    return {
      ok: true,
      text: `Reminder target: serve/file Proof of Service by ~${yyyy}-${mm}-${dd} (verify actual rules).`
    };
  }

  function buildPacketList(x, pos) {
    const lines = [];
    lines.push("WHAT TO SERVE (PACKET LIST)");
    lines.push("");
    lines.push("At minimum, the server should receive:");
    lines.push("1) Filed FL-300 (Request for Order) + all attachments.");
    lines.push("2) Your declaration attachment (MC-030 style) if used.");
    lines.push("3) Exhibit index + exhibits (if you are serving exhibits; confirm local practice).");
    lines.push("4) Any blank response forms required/used in your case type (verify).");
    lines.push("");
    lines.push("Proof of Service form to complete after service:");
    lines.push("- " + pos.form);
    lines.push("");
    if (x.caseNumber) lines.push("Case No.: " + x.caseNumber);
    if (x.servedParty) lines.push("Person to be served: " + x.servedParty + (x.servedRole ? " (" + x.servedRole + ")" : ""));
    lines.push("");
    lines.push("Note: If you have a restraining order/no-contact constraints, use a registered process server and follow the order strictly.");
    return lines.join("\n");
  }

  function buildServiceInstructions(x, pos) {
    const served = x.servedParty ? x.servedParty : "[Other Party]";
    const role = x.servedRole ? " (" + x.servedRole + ")" : "";
    const hearingLine = x.hearingDate
      ? ("Hearing: " + x.hearingDate + (x.hearingTime ? (" at " + x.hearingTime) : ""))
      : "Hearing: [enter date/time]";

    const lines = [];
    lines.push("SERVICE INSTRUCTIONS (COPY-READY)");
    lines.push("");
    lines.push("Serve the following person:");
    lines.push("- " + served + role);
    lines.push("");
    lines.push(hearingLine);
    if (x.caseNumber) lines.push("Case No.: " + x.caseNumber);
    lines.push("County: " + (x.county || "Orange"));
    lines.push("");
    lines.push("Method:");
    lines.push("- " + pos.form.replace("Proof of ", "").trim());
    lines.push("");
    lines.push("Server requirements:");
    lines.push("- Must be 18+ and NOT a party to the case.");
    lines.push("- Recommended: registered process server for reliability and safety.");
    lines.push("");
    lines.push("After service is completed:");
    lines.push("- Complete " + pos.form + " accurately.");
    lines.push("- Sign under penalty of perjury (server signs).");
    lines.push("- File the Proof of Service with the court and keep a stamped copy (or e-file confirmation).");
    lines.push("");
    lines.push("Notes:");
    lines.push("- If the person cannot be located, document attempts (dates/times/addresses).");
    lines.push("- If there are any no-contact/DVRO constraints, do NOT personally serve—use a professional server.");
    return lines.join("\n");
  }

  function buildPOSChecklist(x, pos) {
    const lines = [];
    lines.push("PROOF OF SERVICE CHECKLIST");
    lines.push("");
    lines.push("Before service:");
    lines.push("☐ Confirm hearing date/time and the papers to be served.");
    lines.push("☐ Make clean copies of the filing packet.");
    lines.push("☐ Choose a server (18+ non-party; preferably a registered process server).");
    lines.push("☐ Provide the server with: the packet + the correct Proof of Service form.");
    lines.push("");
    lines.push("During service:");
    if (pos.form.startsWith("FL-330")) {
      lines.push("☐ Personal service: server hands the papers to the served person.");
      lines.push("☐ Server records: date/time/location/description of service.");
    } else {
      lines.push("☐ Mail service: server mails the papers as required and records date/mailing details.");
      lines.push("☐ Verify that mail service is permitted in your situation before relying on it.");
    }
    lines.push("");
    lines.push("After service:");
    lines.push("☐ Server completes and signs " + pos.form + ".");
    lines.push("☐ You file Proof of Service with the court before the hearing deadline (verify).");
    lines.push("☐ Bring a copy of Proof of Service to the hearing.");
    lines.push("");
    if (x.hearingDate) {
      lines.push("Hearing date: " + x.hearingDate + (x.hearingTime ? (" " + x.hearingTime) : ""));
    } else {
      lines.push("Hearing date: [enter date]");
    }
    if (x.caseNumber) lines.push("Case No.: " + x.caseNumber);
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
    const x = readInputs();
    const pos = computePOSForm(x);
    const dl = estimateDeadline(x);

    $("posForm").textContent = pos.form;
    $("posNotes").textContent = pos.notes;
    $("deadline").textContent = dl.text;

    $("svcInstructions").value = buildServiceInstructions(x, pos);
    $("packetList").value = buildPacketList(x, pos);
    $("posChecklist").value = buildPOSChecklist(x, pos);

    saveJSON(KEY_PUBLIC_SERVICE, {
      version: 1,
      updatedAt: nowISO(),
      inputs: x,
      outputs: {
        posForm: pos.form,
        posNotes: pos.notes,
        deadline: dl.text
      }
    });
  }

  function init() {
    const prior = loadJSON(KEY_PUBLIC_SERVICE);
    const intake = loadJSON(KEY_INTAKE);

    if (prior?.inputs) {
      writeInputs(prior.inputs);
    } else if (intake) {
      // Best-effort prefill from intake (if present in your intake schema).
      writeInputs({
        county: safeStr(intake?.court?.county) || "Orange",
        caseNumber: safeStr(intake?.court?.caseNumber) || "",
        servedParty: safeStr(intake?.parties?.otherPartyName) || "",
        servedRole: safeStr(intake?.parties?.otherPartyRole) || "",
      });
    }

    regen();

    $("btnCopyInstructions")?.addEventListener("click", () => copyText($("svcInstructions").value));
    $("btnCopyPacket")?.addEventListener("click", () => copyText($("packetList").value));
    $("btnCopyChecklist")?.addEventListener("click", () => copyText($("posChecklist").value));

    $("btnCopyAll")?.addEventListener("click", () => {
      const all = [
        "RFO — SERVICE PACK (PUBLIC)",
        "",
        "RECOMMENDED PROOF OF SERVICE FORM:",
        safeStr($("posForm")?.textContent),
        safeStr($("posNotes")?.textContent),
        "",
        "DEADLINE REMINDER (ESTIMATE):",
        safeStr($("deadline")?.textContent),
        "",
        $("svcInstructions").value,
        "",
        $("packetList").value,
        "",
        $("posChecklist").value
      ].join("\n");
      copyText(all);
    });

    $("btnSave")?.addEventListener("click", () => {
      const ok = saveJSON(KEY_PUBLIC_SERVICE, {
        version: 1,
        updatedAt: nowISO(),
        inputs: readInputs(),
        outputs: {
          posForm: safeStr($("posForm")?.textContent),
          posNotes: safeStr($("posNotes")?.textContent),
          deadline: safeStr($("deadline")?.textContent)
        }
      });
      if (ok) toast("Saved");
    });

    [
      "hearingDate", "hearingTime", "county", "caseNumber", "servedParty", "servedRole",
      "serviceMethod", "hasAddress", "hasNoContact", "serverType"
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
