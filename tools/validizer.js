// /tools/validizer.js
// Canon compliance checks — no Firebase, heuristic static checks only

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const input = $("valIn");
  const reportEl = $("valReport");

  const btnValidate = $("btnValidate");
  const btnCopy = $("btnCopyReport");
  const btnClear = $("btnClearVal");

  function check(code) {
    const findings = [];

    function add(rule, ok, msg) {
      findings.push({
        rule,
        status: ok ? "PASS" : "FAIL",
        msg
      });
    }

    const text = String(code || "");

    add("C1", !/gstatic\.com\/firebase/i.test(text), "No Firebase CDN imports");
    add("C2", !/onAuthStateChanged/i.test(text), "No onAuthStateChanged outside firebase-config");
    add("C7", !/window\.firebase/i.test(text), "No legacy window.firebase");
    add("C3", !/location\.href|redirect|window\.location/i.test(text), "No redirect logic");
    add("C6", !/site-header.*auth|auth.*site-header/i.test(text), "No header-auth duplication");

    return findings;
  }

  function run() {
    const code = input.value || "";
    const findings = check(code);

    let score = 100;
    findings.forEach(f => {
      if (f.status === "FAIL") score -= 20;
    });

    let out =
`SHARPESYSTEM VALIDIZER REPORT
Time: ${new Date().toISOString()}
Score: ${score}/100

Rule | Status | Description
---------------------------
`;

    findings.forEach(f => {
      out += `${f.rule} | ${f.status} | ${f.msg}\n`;
    });

    reportEl.textContent = out;
  }

  btnValidate.addEventListener("click", run);

  btnCopy.addEventListener("click", async () => {
    await navigator.clipboard.writeText(reportEl.textContent || "");
  });

  btnClear.addEventListener("click", () => {
    input.value = "";
    reportEl.textContent = "";
  });

})();
