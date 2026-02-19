/* /tools/renderer.js
   JSON -> Fragment renderer (deterministic).

   Input (JSON object):
   {
     "file": "immigration-start.html",        // optional
     "title": "Immigration — Start",          // optional
     "h1": "Immigration help",                // required (recommended)
     "oneSentence": "Get oriented quickly.",  // optional
     "blocks": [ ... ]                        // required
   }

   Blocks (examples):
   { "type": "p", "text": "..." }
   { "type": "h2", "text": "Next steps" }
   { "type": "ul", "items": ["A", "B"] }
   { "type": "ol", "items": ["A", "B"] }
   { "type": "note", "title": "Note", "text": "..." }
   { "type": "cta", "links": [ { "label": "Home", "href": "/home.html" } ] }
   { "type": "details", "summary": "More", "items": ["A", "B"] }
   { "type": "hr" }

   Output: EXACTLY ONE root <section class="card" ...>...</section>
*/

(function () {
  "use strict";

  function canon() {
    const c = window.SHS_CANON;
    if (!c) throw new Error("Missing SHS_CANON. Load /tools/canon-rules.js before /tools/renderer.js.");
    return c;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }

  function normalizeSpec(spec) {
    if (!isObj(spec)) throw new Error("JSON spec must be an object.");
    const h1 = String(spec.h1 ?? "").trim();
    const blocks = Array.isArray(spec.blocks) ? spec.blocks : null;
    if (!h1) throw new Error("JSON spec requires 'h1'.");
    if (!blocks || blocks.length === 0) throw new Error("JSON spec requires non-empty 'blocks' array.");
    return {
      file: String(spec.file ?? "").trim(),
      title: String(spec.title ?? "").trim(),
      h1,
      oneSentence: String(spec.oneSentence ?? "").trim(),
      blocks
    };
  }

  function renderBlock(b) {
    const c = canon();
    if (!isObj(b)) throw new Error("Block must be an object.");

    const t = String(b.type ?? "").trim();
    if (!c.jsonSpec.allowedBlockTypes.includes(t)) {
      throw new Error("Unsupported block type: " + t);
    }

    if (t === "p") {
      return `<p>${esc(b.text ?? "")}</p>`;
    }

    if (t === "h2") {
      return `<h2>${esc(b.text ?? "")}</h2>`;
    }

    if (t === "h3") {
      return `<h3>${esc(b.text ?? "")}</h3>`;
    }

    if (t === "hr") {
      return `<hr style="margin:16px 0;" />`;
    }

    if (t === "ul" || t === "ol") {
      const items = Array.isArray(b.items) ? b.items : [];
      const tag = t;
      const lis = items.map((x) => `<li>${esc(x)}</li>`).join("");
      return `<${tag}>${lis}</${tag}>`;
    }

    if (t === "note") {
      const title = String(b.title ?? "Note").trim() || "Note";
      const text = String(b.text ?? "").trim();
      return `<div class="notice" style="margin-top:12px;"><strong>${esc(title)}:</strong> ${esc(text)}</div>`;
    }

    if (t === "cta") {
      const links = Array.isArray(b.links) ? b.links : [];
      const as = links.map((l) => {
        const label = esc((l && l.label) ?? "Link");
        const href = esc((l && l.href) ?? "#");
        return `<a class="button" href="${href}">${label}</a>`;
      }).join("\n    ");
      return `<div class="cta-row" style="margin-top:12px;">\n    ${as}\n  </div>`;
    }

    if (t === "details") {
      const summary = esc(b.summary ?? "More");
      const items = Array.isArray(b.items) ? b.items : [];
      const lis = items.map((x) => `<li>${esc(x)}</li>`).join("");
      return `<details>\n    <summary>${summary}</summary>\n    <ul>${lis}</ul>\n  </details>`;
    }

    // Defensive fallback
    throw new Error("Unhandled block type: " + t);
  }

  function renderFragmentFromJson(specObj) {
    const c = canon();
    const s = normalizeSpec(specObj);

    const meta = [];
    if (s.file) meta.push(`  <!-- FILE: ${esc(s.file)} -->`);
    if (s.title) meta.push(`  <!-- TITLE: ${esc(s.title)} -->`);
    meta.push(`  <!-- H1: ${esc(s.h1)} -->`);
    if (s.oneSentence) meta.push(`  <!-- ONE_SENTENCE: ${esc(s.oneSentence)} -->`);

    const body = [];
    body.push(...meta);
    body.push("");
    body.push(`  <h1>${esc(s.h1)}</h1>`);
    if (s.oneSentence) body.push(`  <p>${esc(s.oneSentence)}</p>`);

    for (const b of s.blocks) {
      body.push("  " + renderBlock(b).replace(/\n/g, "\n  "));
    }

    return `<section class="card" style="${c.jsonSpec.rootSectionStyle}">\n${body.join("\n")}\n</section>`;
  }

  // Expose deterministic API
  window.SHS_RENDERER = {
    renderFragmentFromJson,
    normalizeSpec,
  };
})();
