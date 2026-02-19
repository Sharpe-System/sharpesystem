/* /tools/renderer.js
   JSON -> Fragment renderer (deterministic, route-first).

   Preferred JSON spec (industry standard):
   {
     "route": "/immigration/",               // preferred single source of truth
     "title": "Immigration — Start",         // optional (recommended)
     "h1": "Immigration help",               // required
     "oneSentence": "Get oriented fast.",    // optional
     "blocks": [ ... ]                       // required
   }

   Back-compat (still accepted):
   { "file": "immigration/index.html", ... }

   Deterministic rules:
   - route MUST start with "/" and end with "/"
   - route "/" maps to "index.html"
   - route "/immigration/" maps to "immigration/index.html"
   - no network calls, no auth, no redirects, no Firebase
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

  function normRoute(route) {
    let r = String(route ?? "").trim();
    if (!r) return "";
    if (!r.startsWith("/")) r = "/" + r;
    // strip query/hash if someone pasted it
    r = r.split("#")[0].split("?")[0];
    // collapse multiple slashes
    r = r.replace(/\/{2,}/g, "/");
    if (!r.endsWith("/")) r += "/";
    return r;
  }

  function routeToFile(route) {
    const r = normRoute(route);
    if (!r) return "";
    if (r === "/") return "index.html";
    // "/immigration/" -> "immigration/index.html"
    return r.replace(/^\//, "") + "index.html";
  }

  function normalizeSpec(spec) {
    if (!isObj(spec)) throw new Error("JSON spec must be an object.");

    const h1 = String(spec.h1 ?? "").trim();
    const blocks = Array.isArray(spec.blocks) ? spec.blocks : null;
    if (!h1) throw new Error("JSON spec requires 'h1'.");
    if (!blocks || blocks.length === 0) throw new Error("JSON spec requires non-empty 'blocks' array.");

    const route = normRoute(spec.route ?? "");
    const fileFromRoute = route ? routeToFile(route) : "";
    const file = String(spec.file ?? "").trim() || fileFromRoute;

    // If both given, enforce consistency (hard, avoids drift)
    if (route && file && file !== fileFromRoute) {
      throw new Error(`route/file mismatch. route "${route}" implies file "${fileFromRoute}" but got "${file}".`);
    }

    return {
      route,
      file,
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

    if (t === "p") return `<p>${esc(b.text ?? "")}</p>`;
    if (t === "h2") return `<h2>${esc(b.text ?? "")}</h2>`;
    if (t === "h3") return `<h3>${esc(b.text ?? "")}</h3>`;
    if (t === "hr") return `<hr style="margin:16px 0;" />`;

    if (t === "ul" || t === "ol") {
      const items = Array.isArray(b.items) ? b.items : [];
      const lis = items.map((x) => `<li>${esc(x)}</li>`).join("");
      return `<${t}>${lis}</${t}>`;
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

    throw new Error("Unhandled block type: " + t);
  }

  function renderFragmentFromJson(specObj) {
    const c = canon();
    const s = normalizeSpec(specObj);

    const meta = [];
    if (s.route) meta.push(`  <!-- ROUTE: ${esc(s.route)} -->`);
    if (s.file) meta.push(`  <!-- FILE: ${esc(s.file)} -->`);
    if (s.title) meta.push(`  <!-- TITLE: ${esc(s.title)} -->`);
    meta.push(`  <!-- H1: ${esc(s.h1)} -->`);
    if (s.oneSentence) meta.push(`  <!-- ONE_SENTENCE: ${esc(s.oneSentence)} -->`);

    const body = [];
    body.push(...meta);
    body.push("");
    body.push(`  <h1>${esc(s.h1)}</h1>`);
    if (s.oneSentence) body.push(`  <p>${esc(s.oneSentence)}</p>`);
    for (const b of s.blocks) body.push("  " + renderBlock(b).replace(/\n/g, "\n  "));

    return `<section class="card" style="${c.jsonSpec.rootSectionStyle}">\n${body.join("\n")}\n</section>`;
  }

  window.SHS_RENDERER = {
    normalizeSpec,
    normRoute,
    routeToFile,
    renderFragmentFromJson
  };
})();
