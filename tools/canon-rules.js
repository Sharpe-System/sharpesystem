/* /tools/canon-rules.js
   Single source of truth for Validizer + Canonizer + Renderer.

   Tool policy (HARD):
   - /tools/* pages are public and MUST NOT include /gate.js
   - Tools are Firebase-free, redirect-free, deterministic, offline.
*/

(function () {
  "use strict";

  function re(s, flags) { return new RegExp(s, flags); }

  window.SHS_CANON = {
    version: "canon-rules.v1",

    // Fragment contract (HARD)
    fragment: {
      requireSingleRootSectionCard: true,
      forbidPatterns: [
        { id: "FRAG_NO_DOCTYPE", re: re("<!doctype", "i"), msg: "Fragment must not include <!doctype>." },
        { id: "FRAG_NO_HTML", re: re("<\\s*html\\b", "i"), msg: "Fragment must not include <html>." },
        { id: "FRAG_NO_HEAD", re: re("<\\s*head\\b", "i"), msg: "Fragment must not include <head>." },
        { id: "FRAG_NO_BODY", re: re("<\\s*body\\b", "i"), msg: "Fragment must not include <body>." },
        { id: "FRAG_NO_MAIN", re: re("<\\s*main\\b", "i"), msg: "Fragment must not include <main>." },
        { id: "FRAG_NO_SCRIPT", re: re("<\\s*script\\b", "i"), msg: "Fragment must not include <script>." },
        { id: "FRAG_NO_STYLE", re: re("<\\s*style\\b", "i"), msg: "Fragment must not include <style>." },
        { id: "FRAG_NO_LINK", re: re("<\\s*link\\b", "i"), msg: "Fragment must not include <link>." },
        { id: "FRAG_NO_META", re: re("<\\s*meta\\b", "i"), msg: "Fragment must not include <meta>." },
      ],
    },

    // Canonical output shell invariants (for generated pages)
    output: {
      lang: "en",
      bodyClass: "shell",
      headerMountId: "site-header",
      mainClass: "page",
      containerClass: "container content",
      scriptStack: [
        { src: "/ui.js", type: "classic" },
        { src: "/header-loader.js", type: "classic" },
        { src: "/partials/header.js", type: "classic" },
        { src: "/i18n.js", type: "classic" },
        { src: "/gate.js", type: "module" }, // NOTE: required in OUTPUT pages, not in /tools/*
      ],
    },

    // Validizer rule checks (string-based, deterministic)
    rules: [
      {
        id: "C1",
        severity: "CRITICAL",
        desc: "No Firebase CDN imports (must be only in /firebase-config.js)",
        evidence: "firebase CDN import detected",
        test: (text) => !/https:\/\/www\.gstatic\.com\/firebasejs\/|firebase-app\.js|firebase-auth\.js|firebase-firestore\.js/i.test(String(text || "")),
      },
      {
        id: "C2",
        severity: "CRITICAL",
        desc: "No onAuthStateChanged usage here (must be only in /firebase-config.js)",
        evidence: "onAuthStateChanged detected",
        test: (text) => !/\bonAuthStateChanged\s*\(/i.test(String(text || "")),
      },
      {
        id: "C7",
        severity: "CRITICAL",
        desc: "No legacy window.firebase usage",
        evidence: "window.firebase usage detected",
        test: (text) => !/\bwindow\.firebase\b/i.test(String(text || "")),
      },
      {
        id: "C3-HEUR",
        severity: "MAJOR",
        desc: "No redirect-like calls in this pasted code (gate.js owns gating/redirects)",
        evidence: "redirect-like call detected",
        test: (text) => !/\b(location\.href|location\.assign|location\.replace|window\.location|document\.location)\b/i.test(String(text || "")),
      },
      {
        id: "C6-HEUR",
        severity: "MAJOR",
        desc: "Avoid duplicating header-auth logic in pages/modules",
        evidence: "header/auth duplication heuristic hit",
        test: (text) => !/\b(header-auth\.js|#site-header\b|header-loader\.js\b)\b/i.test(String(text || "")),
      },
    ],

    // JSON “page spec” schema (lightweight, deterministic)
    jsonSpec: {
      allowedBlockTypes: [
        "p", "h2", "h3",
        "ul", "ol",
        "hr",
        "note",
        "cta",
        "details"
      ],
      // default root section styling
      rootSectionStyle: "padding:var(--pad);",
    },
  };
})();
