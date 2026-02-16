/* timeline-v2.js — Structured timeline + court-ready export (localStorage v1) */

(function () {
  "use strict";

  const KEY = "sharpe_timeline_v2";

  const $ = (id) => document.getElementById(id);

  const statusEl = $("status");
  const qualifierEl = $("qualifier");
  const date1El = $("date1");
  const date2Wrap = $("date2Wrap");
  const date2El = $("date2");

  const categoryEl = $("category");
  const subtypeEl = $("subtype");

  const fact1El = $("fact1");
  const fact2El = $("fact2");
  const fact3El = $("fact3");
  const privateNotesEl = $("privateNotes");
  const rawFactsEl = $("rawFacts");

  const btnAdd = $("btnAdd");
  const btnClear = $("btnClear");
  const btnSave = $("btnSave");
  const btnReset = $("btnReset");

  const viewModeEl = $("viewMode");
  const searchEl = $("search");
  const listEl = $("list");

  const exportBox = $("exportBox");
  const btnCopy = $("btnCopy");
  const btnDownload = $("btnDownload");

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { items: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
      return parsed;
    } catch (e) {
      return { items: [] };
    }
  }

  function saveState(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  let state = loadState();

  // ---- Taxonomy + template mapping ----

  const TAXONOMY = [
    {
      id: "custody_visitation",
      label: "Custody / Visitation",
      subtypes: [
        { id: "exchange_completed", label: "Exchange completed", tpl: "Exchange completed." },
        { id: "exchange_missed", label: "Exchange missed", tpl: "Exchange did not occur as planned." },
        { id: "makeup_requested", label: "Makeup time requested", tpl: "Makeup time was requested." },
        { id: "makeup_denied", label: "Makeup time denied", tpl: "Makeup time was denied." },
        { id: "schedule_change_requested", label: "Schedule change requested", tpl: "A schedule change was requested." },
        { id: "schedule_change_denied", label: "Schedule change denied", tpl: "A schedule change was denied." }
      ]
    },
    {
      id: "support_financial",
      label: "Support / Financial",
      subtypes: [
        { id: "support_paid", label: "Support paid", tpl: "Support payment was made." },
        { id: "support_missed", label: "Support missed", tpl: "Support payment was missed." },
        { id: "expense_request", label: "Expense reimbursement requested", tpl: "Reimbursement was requested." },
        { id: "expense_denied", label: "Expense reimbursement denied", tpl: "Reimbursement was denied." }
      ]
    },
    {
      id: "communication",
      label: "Communication",
      subtypes: [
        { id: "message_sent", label: "Message sent", tpl: "A message was sent." },
        { id: "no_response", label: "No response", tpl: "No response was received." },
        { id: "late_response", label: "Late response", tpl: "A response was received late." },
        { id: "platform_misuse", label: "Platform misuse", tpl: "Communication platform was used in a way that hindered coordination." }
      ]
    },
    {
      id: "court_filing",
      label: "Court / Filing",
      subtypes: [
        { id: "rfo_filed", label: "Request for Order filed", tpl: "A Request for Order was filed." },
        { id: "ex_parte_filed", label: "Ex parte filed", tpl: "An ex parte request was filed." },
        { id: "continuance_requested", label: "Continuance requested", tpl: "A continuance was requested." },
        { id: "hearing_held", label: "Hearing held", tpl: "A hearing occurred." },
        { id: "order_entered", label: "Order entered", tpl: "An order was entered." }
      ]
    },
    {
      id: "safety_incident",
      label: "Safety / Incident",
      subtypes: [
        { id: "police_contacted", label: "Police contacted", tpl: "Police were contacted." },
        { id: "welfare_check", label: "Welfare check", tpl: "A welfare check occurred." },
        { id: "incident_reported", label: "Incident reported", tpl: "An incident was reported." }
      ]
    },
    {
      id: "child_school_medical",
      label: "Child welfare / School / Medical",
      subtypes: [
        { id: "school_issue", label: "School issue", tpl: "A school-related issue occurred." },
        { id: "medical_appointment", label: "Medical appointment", tpl: "A medical appointment occurred." },
        { id: "record_access_issue", label: "Record access issue", tpl: "Access to records was an issue." }
      ]
    },
    {
      id: "other",
      label: "Other",
      subtypes: [
        { id: "other_event", label: "Other event", tpl: "An event occurred." }
      ]
    }
  ];

  function getCategory(catId) {
    return TAXONOMY.find(c => c.id === catId) || TAXONOMY[0];
  }

  function getSubtype(catId, subId) {
    const cat = getCategory(catId);
    return cat.subtypes.find(s => s.id === subId) || cat.subtypes[0];
  }

  function rebuildCategoryDropdown() {
    categoryEl.innerHTML = TAXONOMY.map(c => `<option value="${c.id}">${c.label}</option>`).join("");
  }

  function rebuildSubtypeDropdown() {
    const cat = getCategory(categoryEl.value);
    subtypeEl.innerHTML = cat.subtypes.map(s => `<option value="${s.id}">${s.label}</option>`).join("");
  }

  // ---- Date formatting (MM/DD/YYYY) ----

  function formatMMDDYYYY(raw) {
    const digits = String(raw || "").replace(/\D/g, "").slice(0, 8);
    const mm = digits.slice(0, 2);
    const dd = digits.slice(2, 4);
    const yyyy = digits.slice(4, 8);
    let out = mm;
    if (dd.length) out += "/" + dd;
    if (yyyy.length) out += "/" + yyyy;
    return out;
  }

  function normalizeDateForExport(mmddyyyy) {
    // Keep as-is for now, but enforce structure. If invalid, return empty.
    const s = String(mmddyyyy || "").trim();
    if (!s) return "";
    // Must match MM/DD/YYYY
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return "";
    const mm = Number(m[1]), dd = Number(m[2]), yyyy = Number(m[3]);
    if (mm < 1 || mm > 12) return "";
    if (dd < 1 || dd > 31) return "";
    if (yyyy < 1900 || yyyy > 2100) return "";
    return s;
  }

  function bindDateInput(el) {
    el.addEventListener("input", () => {
      const v = formatMMDDYYYY(el.value);
      if (el.value !== v) el.value = v;
    });
  }

  // ---- Sanitizer: messy paragraph -> neutral bullets ----

  const LOADED_WORDS = [
    "narcissist","abusive","crazy","insane","evil","liar","lying","fraud","fraudulent",
    "gaslight","gaslighting","psychopath","sociopath","toxic","manipulative"
  ];

  function sanitizeTextToBullets(raw) {
    const s = String(raw || "").trim();
    if (!s) return [];

    // Split into sentences-ish
    const parts = s
      .replace(/\r/g, "")
      .split(/[\n•\-]+/g)
      .map(x => x.trim())
      .filter(Boolean)
      .flatMap(line => line.split(/(?<=[.!?])\s+/g).map(x => x.trim()).filter(Boolean));

    const bullets = [];
    for (const p of parts) {
      let t = p;

      // Remove loaded words (simple pass)
      for (const w of LOADED_WORDS) {
        const re = new RegExp(`\\b${w}\\b`, "ig");
        t = t.replace(re, "");
      }

      // Remove repeated whitespace
      t = t.replace(/\s{2,}/g, " ").trim();

      // Convert intent accusations to observation framing (basic)
      t = t.replace(/\b(she|he|they)\s+tried\s+to\b/ig, "I believe there was an attempt to");
      t = t.replace(/\b(she|he|they)\s+intended\s+to\b/ig, "I believe there was an intent to");

      // Cap length
      if (t.length > 240) t = t.slice(0, 237) + "...";

      if (t) bullets.push(t);
      if (bullets.length >= 6) break;
    }

    return bullets;
  }

  // ---- Export formatting ----

  function dateLabel(item) {
    const q = item.qualifier;
    const d1 = normalizeDateForExport(item.date1);
    const d2 = normalizeDateForExport(item.date2);

    if (q === "between") {
      if (d1 && d2) return `Between ${d1} and ${d2}`;
      if (d1) return `Between ${d1} and (end date not provided)`;
      return `Between (date range not provided)`;
    }

    if (q === "on_or_about") {
      if (d1) return `On or about ${d1}`;
      return `On or about (date not provided)`;
    }

    // exact
    if (d1) return d1;
    return "(date not provided)";
  }

  function courtLine(item) {
    const cat = getCategory(item.categoryId).label;
    const sub = getSubtype(item.categoryId, item.subtypeId);
    const label = sub.label;

    const facts = [item.fact1, item.fact2, item.fact3]
      .map(x => String(x || "").trim())
      .filter(Boolean);

    const sanitizedBullets = sanitizeTextToBullets(item.rawFacts);

    // Build neutral output
    const bits = [];
    bits.push(sub.tpl);

    for (const f of facts) bits.push(f);
    for (const b of sanitizedBullets) bits.push(b);

    // De-dup and cap
    const seen = new Set();
    const clean = [];
    for (const b of bits) {
      const k = b.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      clean.push(b);
      if (clean.length >= 6) break;
    }

    const bullets = clean.map(x => `- ${x}`).join("\n");

    return `${dateLabel(item)} — ${cat} — ${label}\n${bullets}`;
  }

  function privateLine(item) {
    const base = courtLine(item);
    const notes = String(item.privateNotes || "").trim();
    if (!notes) return base;
    return `${base}\n[Private notes]\n${notes}`;
  }

  function buildExportText(mode, filteredItems) {
    if (!filteredItems.length) return "(No items yet.)";

    const lines = [];
    for (const item of filteredItems) {
      lines.push(mode === "private" ? privateLine(item) : courtLine(item));
      lines.push(""); // spacer
    }
    return lines.join("\n").trim();
  }

  // ---- Render list ----

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function matchesSearch(item, q) {
    if (!q) return true;
    const hay = [
      item.date1, item.date2,
      getCategory(item.categoryId).label,
      getSubtype(item.categoryId, item.subtypeId).label,
      item.fact1, item.fact2, item.fact3,
      item.rawFacts,
      item.privateNotes
    ].join(" ").toLowerCase();
    return hay.includes(q.toLowerCase());
  }

  function sortItems(items) {
    // v1: keep insertion order (most recent first)
    return [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function render() {
    const mode = viewModeEl.value;
    const q = (searchEl.value || "").trim();

    const items = sortItems(state.items).filter(it => matchesSearch(it, q));

    listEl.innerHTML = items.map(it => {
      const cat = getCategory(it.categoryId).label;
      const sub = getSubtype(it.categoryId, it.subtypeId).label;
      const d = dateLabel(it);

      const facts = [it.fact1, it.fact2, it.fact3].map(x => String(x || "").trim()).filter(Boolean);
      const bullets = sanitizeTextToBullets(it.rawFacts);

      const showNotes = (mode === "private") && String(it.privateNotes || "").trim();

      return `
        <div class="item" data-id="${it.id}">
          <div class="itemTop">
            <div>
              <div class="itemTitle">${escapeHtml(d)} — ${escapeHtml(cat)} — ${escapeHtml(sub)}</div>
              <div class="itemMeta">Qualifier: ${escapeHtml(it.qualifier)} • Created: ${new Date(it.createdAt).toLocaleString()}</div>
            </div>
            <div class="itemActions">
              <button class="btn secondary" data-action="edit" type="button">Edit</button>
              <button class="btn danger" data-action="delete" type="button">Delete</button>
            </div>
          </div>

          <div class="itemBody">
            ${facts.length ? `<ul>${facts.map(f => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : ""}
            ${bullets.length ? `<ul>${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul>` : ""}
            ${showNotes ? `<div class="itemMeta" style="margin-top:10px;">Private notes</div><div>${escapeHtml(it.privateNotes)}</div>` : ""}
          </div>
        </div>
      `;
    }).join("");

    exportBox.textContent = buildExportText(mode, items);
  }

  // ---- Add/edit/delete ----

  function uid() {
    return "tl_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  let editId = null;

  function clearForm() {
    editId = null;
    qualifierEl.value = "exact";
    date1El.value = "";
    date2El.value = "";
    date2Wrap.style.display = "none";

    categoryEl.value = TAXONOMY[0].id;
    rebuildSubtypeDropdown();

    fact1El.value = "";
    fact2El.value = "";
    fact3El.value = "";
    privateNotesEl.value = "";
    rawFactsEl.value = "";

    btnAdd.textContent = "Add to timeline";
    setStatus("Ready.");
  }

  function validateForm() {
    const q = qualifierEl.value;
    const d1 = normalizeDateForExport(date1El.value);
    const d2 = normalizeDateForExport(date2El.value);

    if (!d1) return "Date is required (MM/DD/YYYY).";

    if (q === "between" && !d2) return "End date is required for Between.";

    const f1 = String(fact1El.value || "").trim();
    const raw = String(rawFactsEl.value || "").trim();

    if (!f1 && !raw) return "Provide at least Fact 1 or paste a Raw paragraph.";

    // Court hygiene: keep facts short
    if (f1.length > 240) return "Fact 1 is too long.";

    return "";
  }

  function upsertItem() {
    const err = validateForm();
    if (err) {
      alert(err);
      setStatus(err);
      return;
    }

    const item = {
      id: editId || uid(),
      createdAt: editId ? state.items.find(x => x.id === editId)?.createdAt || Date.now() : Date.now(),
      updatedAt: Date.now(),

      qualifier: qualifierEl.value,
      date1: date1El.value,
      date2: qualifierEl.value === "between" ? date2El.value : "",

      categoryId: categoryEl.value,
      subtypeId: subtypeEl.value,

      fact1: String(fact1El.value || "").trim(),
      fact2: String(fact2El.value || "").trim(),
      fact3: String(fact3El.value || "").trim(),

      privateNotes: String(privateNotesEl.value || "").trim(),
      rawFacts: String(rawFactsEl.value || "").trim()
    };

    if (editId) {
      const idx = state.items.findIndex(x => x.id === editId);
      if (idx >= 0) state.items[idx] = item;
    } else {
      state.items.push(item);
    }

    saveState(state);
    setStatus(editId ? "Updated." : "Added.");
    clearForm();
    render();
  }

  function loadIntoForm(item) {
    editId = item.id;

    qualifierEl.value = item.qualifier || "exact";
    date1El.value = item.date1 || "";
    date2El.value = item.date2 || "";

    date2Wrap.style.display = (qualifierEl.value === "between") ? "" : "none";

    categoryEl.value = item.categoryId || TAXONOMY[0].id;
    rebuildSubtypeDropdown();
    subtypeEl.value = item.subtypeId || getCategory(categoryEl.value).subtypes[0].id;

    fact1El.value = item.fact1 || "";
    fact2El.value = item.fact2 || "";
    fact3El.value = item.fact3 || "";
    privateNotesEl.value = item.privateNotes || "";
    rawFactsEl.value = item.rawFacts || "";

    btnAdd.textContent = "Update event";
    setStatus("Editing existing event.");
  }

  function deleteItem(id) {
    const sure = confirm("Delete this event?");
    if (!sure) return;
    state.items = state.items.filter(x => x.id !== id);
    saveState(state);
    setStatus("Deleted.");
    render();
  }

  // ---- Export actions ----

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportBox.textContent || "");
      setStatus("Copied export text.");
    } catch (e) {
      setStatus("Copy failed. Select the text manually.");
    }
  }

  function downloadExport() {
    const txt = exportBox.textContent || "";
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timeline_export.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Downloaded timeline_export.txt");
  }

  // ---- Wire events ----

  function onQualifierChange() {
    const q = qualifierEl.value;
    date2Wrap.style.display = (q === "between") ? "" : "none";
    if (q !== "between") date2El.value = "";
  }

  function init() {
    rebuildCategoryDropdown();
    rebuildSubtypeDropdown();

    qualifierEl.addEventListener("change", onQualifierChange);
    categoryEl.addEventListener("change", () => rebuildSubtypeDropdown());

    bindDateInput(date1El);
    bindDateInput(date2El);

    btnAdd.addEventListener("click", upsertItem);
    btnClear.addEventListener("click", clearForm);

    btnSave.addEventListener("click", () => {
      saveState(state);
      setStatus("Saved.");
    });

    btnReset.addEventListener("click", () => {
      const sure = confirm("Reset Timeline v2? This clears saved entries.");
      if (!sure) return;
      state = { items: [] };
      saveState(state);
      clearForm();
      render();
      setStatus("Reset.");
    });

    viewModeEl.addEventListener("change", render);
    searchEl.addEventListener("input", render);

    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      const itemEl = e.target.closest(".item");
      if (!itemEl) return;

      const id = itemEl.getAttribute("data-id");
      const item = state.items.find(x => x.id === id);
      if (!item) return;

      if (action === "edit") loadIntoForm(item);
      if (action === "delete") deleteItem(id);
    });

    btnCopy.addEventListener("click", copyExport);
    btnDownload.addEventListener("click", downloadExport);

    clearForm();
    render();
  }

  init();
})();
