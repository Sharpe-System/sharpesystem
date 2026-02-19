<!-- /rfo/public-draft.html -->
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>RFO — Public Draft — SharpeSystem</title>
  <meta name="description" content="Public RFO draft preview (local-only). Includes PeacePath off-ramp." />
  <link rel="stylesheet" href="/styles.css" />
</head>

<body class="shell">
  <div id="site-header"></div>

  <main class="page">
    <div class="container content">

      <section class="card" style="padding:var(--pad);">
        <div class="row" style="justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
          <div>
            <h1 style="margin:0;">RFO — Public Draft</h1>
            <p class="muted" style="margin:6px 0 0 0;">
              This is a structured preview generated from your Public Intake. It saves locally on this device.
            </p>
          </div>

          <div class="row" style="gap:10px; flex-wrap:wrap;">
            <button class="btn" id="btnCopy" type="button">Copy Draft</button>
            <button class="btn" id="btnSave" type="button">Save</button>
            <a class="btn" href="/rfo/public-intake.html#resume">Back to Intake</a>
          </div>
        </div>

        <div class="hr"></div>

        <!-- PeacePath must be present on every adversarial page -->
        <section class="card" style="padding:14px; margin:0 0 14px 0;">
          <h2 style="margin:0 0 6px 0;">Before you proceed with court</h2>
          <p class="muted" style="margin:0;">
            If a workable agreement is possible, you can use this draft as a clarity tool — then pivot to a cooperative resolution.
            Court is often the most expensive way to solve a solvable problem.
          </p>
          <div class="row" style="margin-top:12px; gap:10px; flex-wrap:wrap;">
            <a class="btn" href="/amicable.html">Try Amicable (Agreement Path)</a>
            <a class="btn" href="/peace-path.html">Peace Path (De-escalated Messaging)</a>
            <a class="btn primary" href="#draft">Continue draft</a>
          </div>
        </section>

        <div id="draft"></div>

        <h3 style="margin-top:0;">Draft preview</h3>
        <p class="muted" style="margin-top:6px;">
          This will later map into a declaration (MC-030-style narrative) and a clean “Orders Requested” section.
          Public mode does not export PDFs. Export is unlocked at the Print Gate.
        </p>

        <label class="field" style="margin-top:12px;">
          <span class="label">Generated draft text (editable)</span>
          <textarea class="input" id="draftText" rows="22" placeholder="Draft will appear here…"></textarea>
        </label>

        <div class="hr"></div>

        <h3>Next steps</h3>
        <p class="muted" style="margin-top:6px;">
          Organize exhibits and build the filing set. Public mode keeps your work local until you unlock print/export.
        </p>

        <div class="row" style="margin-top:12px; gap:10px; flex-wrap:wrap;">
          <a class="btn primary" id="btnNext" href="/rfo/public-exhibits.html">Continue to Exhibits</a>
          <a class="btn" href="/rfo/start.html">RFO Start</a>
        </div>

        <div class="small soft" style="margin-top:12px;">
          Public mode stores data in your browser only. Clearing browser storage clears the draft.
        </div>
      </section>

    </div>
  </main>

  <!-- Public canonical stack (NO gate.js) -->
  <script src="/ui.js"></script>
  <script src="/header-loader.js"></script>
  <script src="/partials/header.js"></script>
  <script src="/i18n.js"></script>

  <!-- Public RFO logic (localStorage-only) -->
  <script src="/rfo/rfo-public-draft.js"></script>
</body>
</html>
