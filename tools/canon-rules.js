/* /tools/canon-rules.js
   Canon Rules v1 (single source of truth for Validizer + Canonizer)

   HARD RULES:
   - Tools: no Firebase, no redirects, no network calls, no auth checks
   - Fragments: ONLY <section class="card">...</section> (exactly one root), no scripts, no shells
   - Canonizer output: MUST match invariant shell+stack, no duplicates, no omissions
*/

(function () {
  "use strict";

  const CANON = {
    version: "v1-20260219",

    // Canonizer output invariants (NON-NEGOTIABLE)
    output: {
      lang: "en",
      doctype: "<!doctype html>",
      bodyClass: "shell",
      headerMountId: "site-header",
      mainClass: "page",
      containerClass: "container content",
      scriptStack: [
        { src: "/ui.js", type: "classic" },
        { src: "/header-loader.js", type: "classic" },
        { src: "/partials/header.js", type: "classic" },
        { src: "/i18n.js", type: "classic" },
        { src: "/gate.js", type: "module" }, // REQUIRED in OUTPUT, even though tools pages exclude it
      ],
    },

    // Fragment contract (Creativizer + Validizer)
    fragment: {
      // Exactly one root section.card
      requireSingleRootSectionCard: true,

      // Forbidden tags/markers inside fragments
      forbidPatterns: [
        { id: "FRAG_NO_HTML", re: /<\s*html\b/i, msg: "Fragment must not contain <html>." },
        { id: "FRAG_NO_HEAD", re: /<\s*head\b/i, msg: "Fragment must not contain <head>." },
        { id: "FRAG_NO_BODY", re: /<\s*body\b/i, msg: "Fragment must not contain <body>." },
        { id: "FRAG_NO_DOCTYPE", re: /<!doctype\b/i, msg: "Fragment must not contain <!doctype>." },
        { id: "FRAG_NO_MAIN", re: /<\s*main\b/i, msg: "Fragment must not contain <main>." },
        { id: "FRAG_NO_HEADER_MOUNT", re: /id\s*=\s*["']site-header["']/i, msg: "Fragment must not include header mount." },
        { id: "FRAG_NO_SCRIPTS", re: /<\s*script\b/i, msg: "Fragment must not contain <script>." },
        { id: "FRAG_NO_STYLES", re: /<\s*style\b/i, msg: "Fragment must not contain <style>." },
        { id: "FRAG_NO_LINKSHEETS", re: /<\s*link\b/i, msg: "Fragment must not contain <link>." },
      ],
    },

    // Structural / security rules Validizer enforces
    rules: [
      {
        id: "C1",
        severity: "CRITICAL",
        desc: "No Firebase CDN imports (must be only in /firebase-config.js).",
        test: (text) => !/https:\/\/www\.gstatic\.com\/firebasejs/i.test(text),
        evidence: "Found firebasejs CDN reference.",
      },
      {
        id: "C2",
        severity: "CRITICAL",
        desc: "No onAuthStateChanged usage outside /firebase-config.js.",
        test: (text) => !/\bonAuthStateChanged\b/i.test(text),
        evidence: "Found onAuthStateChanged reference.",
      },
      {
        id: "C7",
        severity: "CRITICAL",
        desc: "No legacy window.firebase usage.",
        test: (text) => !/\bwindow\.firebase\b/i.test(text),
        evidence: "Found window.firebase usage.",
      },
      {
        id: "C3-HEUR",
        severity: "MAJOR",
        desc: "No redirect-like calls in pasted code (gate.js owns redirects).",
        test: (text) => !/\b(location\.href|location\.replace|window\.location)\b/i.test(text),
        evidence: "Found redirect-like usage.",
      },
      {
        id: "C6-HEUR",
        severity: "MAJOR",
        desc: "Avoid duplicating header/auth/tier logic in pages/modules.",
        test: (text) => !/\b(ensureAuth|renderUser|authState|headerAuth|data-auth-|userTier|tierGate)\b/i.test(text),
        evidence: "Found header-auth style hooks.",
      },
    ],
  };

  // Single shared global (no fetch, no modules, no network)
  window.SHARPE_CANON_RULES = CANON;
})();
