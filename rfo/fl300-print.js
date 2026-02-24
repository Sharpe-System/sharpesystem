/* /rfo/fl300-print.js
   Print-perfect FL-300 style output.
   v1 data source: localStorage draft:{flow}:v1 (client-only)
*/
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const flow = (params.get("flow") || "rfo").trim();

  const storageKey = `draft:${flow}:v1`;

  function readDraft() {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : { meta: { flow, version: 1 }, data: {} };
    } catch (_) {
      return { meta: { flow, version: 1 }, data: {} };
    }
  }

  function setText(bind, value) {
    const nodes = document.querySelectorAll(`[data-bind="${bind}"]`);
    for (const n of nodes) n.textContent = String(value ?? "");
  }

  const draft = readDraft();
  const d = draft.data || {};

  // v1: map from controller stub field(s) into placeholders.
  // Replace these with your real RFO/FL-300 fields as you build intake schema.
  const partyName = d.partyName || d.intakeField || "";
  const petitioner = d.petitioner || "";
  const respondent = d.respondent || "";
  const caseNumber = d.caseNumber || "";
  const county = d.county || "";
  const hearingDateTime = d.hearingDateTime || "";

  setText("partyName", partyName);
  setText("partyAddress", d.partyAddress || "");
  setText("partyPhone", d.partyPhone || "");
  setText("partyEmail", d.partyEmail || "");

  setText("county", county);
  setText("courtAddress", d.courtAddress || "");
  setText("courtCityZip", d.courtCityZip || "");
  setText("courtBranch", d.courtBranch || "");

  setText("petitioner", petitioner);
  setText("respondent", respondent);
  setText("caseNumber", caseNumber);
  setText("hearingDateTime", hearingDateTime);

  // Text blocks (stub defaults)
  setText("ordersRequested", d.ordersRequested || "Custody / visitation; support; and other related relief as detailed below.");
  setText("custodyText", d.custodyText || d.intakeField || "");
  setText("supportText", d.supportText || "");
  setText("otherOrdersText", d.otherOrdersText || "");
  setText("factsText", d.factsText || "");

  setText("generatedAt", new Date().toLocaleString());
})();
