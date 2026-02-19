/* /rfo/rfo-pleading-paper.js
   Pleading Paper Generator (Public)
   Canon: localStorage only, no Firebase, no gate, single module
*/

(function () {
  "use strict";

  const KEY = "ss_pleading_paper_v1";

  function $(id) { return document.getElementById(id); }
  function s(v) { return String(v ?? ""); }

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
    catch (_) { return null; }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function read() {
    return {
      docTitle: s($("docTitle").value).trim(),
      court: s($("court").value).trim(),
      caseName: s($("caseName").value).trim(),
      caseNumber: s($("caseNumber").value).trim(),
      body: s($("body").value)
    };
  }

  function write(d) {
    if (!d) return;
    $("docTitle").value = d.docTitle || "";
    $("court").value = d.court || "";
    $("caseName").value = d.caseName || "";
    $("caseNumber").value = d.caseNumber || "";
    $("body").value = d.body || "";
  }

  function esc(x) {
    return s(x)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function buildLines(text) {
    const raw = s(text).replace(/\r\n/g, "\n");
    // split into reasonable printable lines without hyphenation logic
    const out = [];
    const words = raw.split(/\s+/);
    let line = "";
    const limit = 92; // conservative monospaced width for pleading paper body
    for (const w of words) {
      if (!w) continue;
      if (line.length === 0) {
        line = w;
      } else if ((line.length + 1 + w.length) <= limit) {
        line += " " + w;
      } else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
    // preserve blank paragraphs
    // treat double-newline as blank line marker
    const paras = raw.split("\n\n");
    if (paras.length > 1) {
      const out2 = [];
      for (let i = 0; i < paras.length; i++) {
        const p = paras[i].trim();
        if (!p) { out2.push(""); continue; }
        const w2 = p.split(/\s+/);
        let l = "";
        for (const w of w2) {
          if (!w) continue;
          if (!l) l = w;
          else if ((l.length + 1 + w.length) <= limit) l += " " + w;
          else { out2.push(l); l = w; }
        }
        if (l) out2.push(l);
        if (i !== paras.length - 1) out2.push("");
      }
      return out2;
    }
    return out;
  }

  function render() {
    const d = read();
    save(d);

    const lines = buildLines(d.body);
    const max = Math.max(28, lines.length); // at least one page worth of rows
    const bodyRows = [];

    for (let i = 1; i <= max; i++) {
      const txt = lines[i - 1] || "";
      bodyRows.push(
        `<div class="pp-row"><div class="pp-ln">${i}</div><div class="pp-tx">${esc(txt)}</div></div>`
      );
    }

    $("preview").innerHTML = `
      <div class="pleading-paper">
        <div class="pp-header">
          <div class="pp-court">${esc(d.court)}</div>
          <div class="pp-title">${esc(d.docTitle)}</div>
          <div class="pp-case">
            <div>${esc(d.caseName)}</div>
            <div>Case No.: ${esc(d.caseNumber)}</div>
          </div>
        </div>
        <div class="pp-body">${bodyRows.join("")}</div>
      </div>
    `;
  }

  function injectPrintCSS() {
    if (document.getElementById("pp-style")) return;
    const style = document.createElement("style");
    style.id = "pp-style";
    style.textContent = `
      .pleading-paper { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .pp-header { margin-bottom: 10px; }
      .pp-court { font-weight: 700; }
      .pp-title { margin-top: 6px; font-weight: 700; text-transform: uppercase; }
      .pp-case { margin-top: 6px; }
      .pp-body { border-top: 1px solid #ddd; padding-top: 8px; }
      .pp-row { display: grid; grid-template-columns: 40px 1fr; gap: 10px; padding: 2px 0; }
      .pp-ln { text-align: right; color: #666; user-select: none; }
      .pp-tx { white-space: pre-wrap; }
      @media print {
        body.shell { background: #fff; }
        #site-header, .btn, .muted, .hr, .container.content > section.card > div.row, .container.content > section.card > p.muted { display: none !important; }
        .card { box-shadow: none !important; border: none !important; }
        .container { max-width: none !important; }
        .pp-ln { color: #000; }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectPrintCSS();

    const existing = load();
    if (existing) write(existing);

    ["docTitle", "court", "caseName", "caseNumber", "body"].forEach((id) => {
      $(id).addEventListener("input", render);
      $(id).addEventListener("change", render);
    });

    $("btnSave").addEventListener("click", render);
    $("btnPrint").addEventListener("click", () => {
      render();
      window.print();
    });

    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
