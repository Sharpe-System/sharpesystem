/* /rfo/fl300-print.js
   Print-perfect FL-300 preview.
   Source of truth: job payload from /api/jobs/:jobId
   Fallback: local draft in browser storage (if present).
*/

(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const jobId = (params.get("job") || "").trim();

  function $(id) { return document.getElementById(id); }

  function escText(s) {
    return String(s ?? "").trim();
  }

  function setText(id, value, fallback = "—") {
    const el = $(id);
    if (!el) return;
    const v = escText(value);
    el.textContent = v ? v : fallback;
  }

  function showErr(msg) {
    const el = $("v_err");
    if (!el) return;
    el.style.display = "block";
    el.textContent = String(msg || "Unknown error");
  }

  function roleLabel(v) {
    const s = String(v || "").toLowerCase();
    if (s === "petitioner") return "Petitioner";
    if (s === "respondent") return "Respondent";
    if (s === "other") return "Other";
    return v ? String(v) : "—";
  }

  function renderChecks(rfo) {
    const host = $("v_checks");
    if (!host) return;

    const items = [
      { key: "reqCustody", label: "Custody / visitation" },
      { key: "reqSupport", label: "Support" },
      { key: "reqOther", label: "Other" },
    ];

    host.innerHTML = items.map(it => {
      const on = !!rfo?.[it.key];
      return `
        <div class="check">
          <span class="cb ${on ? "on" : ""}"></span>
          <span>${it.label}: <strong>${on ? "Yes" : "No"}</strong></span>
        </div>
      `;
    }).join("");
  }

  // Attempt to read the same local draft your app uses.
  // We keep this permissive so it works even if key changes.
  function readLocalDraftFallback() {
    try {
      // Common candidates (you can tighten later once stabilized).
      const candidates = [
        "sharpesystem:draft",
        "sharpesystem:draft:rfo",
        "draft:rfo",
        "rfo:draft",
      ];

      for (const k of candidates) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      }

      // Last resort: scan for anything that looks like an RFO draft.
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (!key.toLowerCase().includes("draft")) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed?.rfo) return parsed;
      }
    } catch (_) {}
    return null;
  }

  async function fetchJob(jobId) {
    const res = await fetch("/api/jobs/" + encodeURIComponent(jobId), {
      headers: { accept: "application/json" }
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      throw new Error("Job fetch failed: " + (json?.error || res.status));
    }
    return json;
  }

  function extractRfo(jobJson) {
    // Prefer immutable job payload
    const data = jobJson?.data || jobJson?.payload || jobJson?.draft || null;
    const rfo = data?.rfo || jobJson?.rfo || null;
    return { data, rfo };
  }

  async function main() {
    let rfo = null;

    // 1) Job payload (preferred)
    if (jobId) {
      try {
        const jobJson = await fetchJob(jobId);
        const ex = extractRfo(jobJson);
        rfo = ex.rfo;
      } catch (e) {
        // don’t hard-fail — still try local draft
        console.warn(e);
      }
    }

    // 2) Local fallback
    if (!rfo) {
      const local = readLocalDraftFallback();
      rfo = local?.rfo || null;
    }

    if (!rfo) {
      showErr("No RFO data found. This print page expects job.data.rfo (preferred) or a local draft.");
      return;
    }

    // Bind fields
    setText("v_county", rfo.county);
    setText("v_branch", rfo.branch);
    setText("v_case", rfo.caseNumber);
    setText("v_role", roleLabel(rfo.role));

    // These may not exist yet in your interview UI; keep placeholders.
    setText("v_petitioner", rfo.petitionerName || rfo.petitioner || "");
    setText("v_respondent", rfo.respondentName || rfo.respondent || "");

    renderChecks(rfo);
    setText("v_details", rfo.requestDetails, "—");
  }

  main().catch(err => showErr(err?.message || String(err)));
})();
