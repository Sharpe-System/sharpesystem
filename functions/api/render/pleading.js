import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function json(status, obj) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

/**
 * Deterministic normalization:
 * - normalize CRLF/CR -> LF
 * - tabs -> spaces
 * - NBSP -> space
 * - strip control chars except \n
 * - normalize smart quotes to straight quotes (stable across paste sources)
 */
function normalizeBodyText(s) {
  let t = String(s ?? "");
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/\t/g, "    "); // 4 spaces (deterministic)
  t = t.replace(/\u00A0/g, " "); // NBSP -> space
  t = t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"'); // smart quotes
  // Strip ASCII control chars except LF (\n = 0x0A)
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return t;
}

function pick(obj, k) {
  const v = obj && typeof obj === "object" ? obj[k] : "";
  return String(v ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/**
 * Deterministic greedy wrap:
 * - collapses runs of whitespace to single spaces within a wrapped line (v1)
 * - preserves explicit blank lines (handled by caller)
 * - hard-splits a token that exceeds maxWidth (no hyphenation)
 */
function wrapLine(line, maxWidth, measureText) {
  const src = String(line ?? "");
  if (!src.length) return [""];

  // v1: collapse internal whitespace to single spaces for wrap decisions/output
  const cleaned = src.replace(/\s+/g, " ").trim();
  if (!cleaned) return [""];

  const tokens = cleaned.split(" ");
  const out = [];
  let cur = "";

  function pushCur() {
    if (cur !== "") out.push(cur);
    cur = "";
  }

  function hardSplitToken(tok) {
    const parts = [];
    let s = tok;

    while (s.length) {
      // Find the longest prefix that fits (binary search)
      let lo = 1;
      let hi = s.length;
      let best = 1;

      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const prefix = s.slice(0, mid);
        if (measureText(prefix) <= maxWidth) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      // Safety: if even 1 char doesn't fit (shouldn't happen), force progress
      if (best < 1) best = 1;

      parts.push(s.slice(0, best));
      s = s.slice(best);
    }

    return parts;
  }

  for (const tok of tokens) {
    if (!tok) continue;

    // Token alone too wide -> hard split into pieces that fit
    if (measureText(tok) > maxWidth) {
      // flush current line first
      pushCur();
      const pieces = hardSplitToken(tok);
      for (const p of pieces) out.push(p);
      continue;
    }

    if (!cur) {
      cur = tok;
      continue;
    }

    const candidate = cur + " " + tok;
    if (measureText(candidate) <= maxWidth) {
      cur = candidate;
    } else {
      pushCur();
      cur = tok;
    }
  }

  pushCur();
  return out.length ? out : [""];
}

/**
 * Convert normalized body text into a flat list of renderable lines:
 * - preserve explicit newlines and explicit blank lines
 * - apply deterministic wrap per source line
 */
function bodyToRenderLines(bodyText, maxWidth, measureText) {
  const srcLines = String(bodyText ?? "").split("\n"); // preserves empties
  const renderLines = [];

  for (const ln of srcLines) {
    if (ln === "") {
      // explicit blank line preserved
      renderLines.push("");
      continue;
    }
    const wrapped = wrapLine(ln, maxWidth, measureText);
    for (const w of wrapped) renderLines.push(w);
  }

  return renderLines;
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed. Use POST.", route: "/api/render/pleading" });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json(400, { ok: false, error: "Invalid JSON body.", message: String(e?.message || e), route: "/api/render/pleading" });
  }

  const p = payload && typeof payload === "object" ? payload.pleading : null;
  if (!p || typeof p !== "object") {
    return json(400, { ok: false, error: "Missing required key: pleading", route: "/api/render/pleading" });
  }

  // ---- required fields ----
  const courtName = pick(p, "courtName");
  const county = pick(p, "county");
  const caseNumber = pick(p, "caseNumber");
  const petitioner = pick(p, "petitioner");
  const respondent = pick(p, "respondent");
  const filingParty = pick(p, "filingParty");
  const attorneyName = pick(p, "attorneyName");
  const attorneyBar = pick(p, "attorneyBar");
  const attorneyAddress = pick(p, "attorneyAddress");
  const documentTitle = pick(p, "documentTitle");
  const bodyTextRaw = p.bodyText ?? "";

  const bodyText = normalizeBodyText(bodyTextRaw);

  if (!courtName || !caseNumber || !petitioner || !respondent || !documentTitle || !String(bodyText).trim()) {
    return json(400, {
      ok: false,
      error: "Missing required fields.",
      required: ["courtName", "caseNumber", "petitioner", "respondent", "documentTitle", "bodyText"],
      route: "/api/render/pleading"
    });
  }

  try {
    // =========================
    // 1) Layout contract (constants)
    // =========================
    const PAGE_SIZE = [612, 792]; // Letter, points
    const LINE_COUNT = 28;

    const leftNumX = 24;
    const leftTextX = 72;
    const rightMargin = 54;

    const topMargin = 54;
    const bottomMargin = 54;

    // Line-height is derived deterministically from 28-line pleading grid.
    const lineHeight = (PAGE_SIZE[1] - topMargin - bottomMargin) / LINE_COUNT;

    const bodyFontSize = 12;
    const captionFontSize = 12;
    const titleFontSize = 14;

    // Start positions encoded as "line offsets" (keeps alignment with pleading grid).
    const CAPTION_START_LINE_OFFSET = 1.35;  // matches your current cy start
    const TITLE_LINE_OFFSET = 13.0;          // matches your current titleY placement
    const BODY_START_LINE_OFFSET_PAGE1 = 15.0; // matches your current bodyStartY

    const BODY_START_LINE_OFFSET_OTHER = CAPTION_START_LINE_OFFSET; // on pages 2+, body starts near top

    const MAX_TEXT_WIDTH = PAGE_SIZE[0] - leftTextX - rightMargin;

    // =========================
    // Build PDF + fonts
    // =========================
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    const lineColor = rgb(0, 0, 0);

    const measureBody = (text) => font.widthOfTextAtSize(String(text ?? ""), bodyFontSize);

    // =========================
    // 2-4) Normalize + wrap -> renderLines
    // =========================
    const renderLines = bodyToRenderLines(bodyText, MAX_TEXT_WIDTH, measureBody);

    // =========================
    // 5) Pagination (deterministic)
    // =========================
    function yForLineOffset(lineOffset) {
      // y = height - topMargin - lineOffset*lineHeight
      return PAGE_SIZE[1] - topMargin - (lineOffset * lineHeight);
    }

    const bodyStartY1 = yForLineOffset(BODY_START_LINE_OFFSET_PAGE1);
    const bodyStartYOther = yForLineOffset(BODY_START_LINE_OFFSET_OTHER);

    function linesFitFromY(startY) {
      // Count lines with baseline y >= bottomMargin
      // first line at startY, then startY - n*lineHeight ...
      if (startY < bottomMargin) return 0;
      return Math.floor((startY - bottomMargin) / lineHeight) + 1;
    }

    const LINES_PER_PAGE_1 = linesFitFromY(bodyStartY1);
    const LINES_PER_PAGE_OTHER = linesFitFromY(bodyStartYOther);

    // Split lines into page chunks
    const pages = [];
    pages.push(renderLines.slice(0, LINES_PER_PAGE_1));
    let remaining = renderLines.slice(LINES_PER_PAGE_1);

    while (remaining.length) {
      pages.push(remaining.slice(0, LINES_PER_PAGE_OTHER));
      remaining = remaining.slice(LINES_PER_PAGE_OTHER);
    }

    // =========================
    // 6) Render loop
    // =========================
    function drawLineNumbers(page) {
      for (let i = 1; i <= LINE_COUNT; i++) {
        const y = PAGE_SIZE[1] - topMargin - (i - 0.85) * lineHeight;
        page.drawText(String(i), {
          x: leftNumX,
          y,
          size: 10,
          font,
          color: lineColor
        });
      }
    }

    function drawCaptionAndTitle(page) {
      const captionLines = [];
      if (attorneyName) captionLines.push(attorneyName);
      if (attorneyBar) captionLines.push("State Bar No.: " + attorneyBar);
      if (attorneyAddress) captionLines.push(attorneyAddress);
      if (filingParty) captionLines.push("Attorney for: " + filingParty);

      const courtLine = county ? `${courtName}, ${county}` : courtName;

      const captionBlock = [
        ...captionLines,
        "",
        courtLine,
        "",
        `${petitioner},`,
        "Petitioner,",
        "v.",
        `${respondent},`,
        "Respondent.",
        "",
        "Case No.: " + caseNumber
      ];

      let cy = yForLineOffset(CAPTION_START_LINE_OFFSET);
      for (const ln of captionBlock) {
        page.drawText(String(ln ?? ""), {
          x: leftTextX,
          y: cy,
          size: captionFontSize,
          font: ln === courtLine ? fontBold : font,
          color: lineColor,
          maxWidth: MAX_TEXT_WIDTH
        });
        cy -= lineHeight;
        if (cy < bottomMargin) break;
      }

      // Title (centered)
      const titleY = yForLineOffset(TITLE_LINE_OFFSET);
      const titleWidth = fontBold.widthOfTextAtSize(documentTitle, titleFontSize);
      const titleX = Math.max(leftTextX, (PAGE_SIZE[0] - titleWidth) / 2);

      page.drawText(documentTitle, {
        x: titleX,
        y: titleY,
        size: titleFontSize,
        font: fontBold,
        color: lineColor
      });
    }

    function drawFooter(page) {
      const footer = "Generated by SharpeSystem";
      page.drawText(footer, {
        x: leftTextX,
        y: bottomMargin - 18,
        size: 9,
        font,
        color: lineColor
      });
    }

    for (let pi = 0; pi < pages.length; pi++) {
      const page = pdfDoc.addPage(PAGE_SIZE);

      drawLineNumbers(page);

      if (pi === 0) drawCaptionAndTitle(page);

      const startY = (pi === 0) ? bodyStartY1 : bodyStartYOther;
      const lines = pages[pi];

      let y = startY;
      for (const ln of lines) {
        if (y < bottomMargin) break;
        page.drawText(String(ln ?? ""), {
          x: leftTextX,
          y,
          size: bodyFontSize,
          font,
          color: lineColor,
          maxWidth: MAX_TEXT_WIDTH
        });
        y -= lineHeight;
      }

      drawFooter(page);
    }

    const out = await pdfDoc.save();

    return new Response(out, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'inline; filename="pleading-paper.pdf"',
        "cache-control": "no-store"
      }
    });
  } catch (e) {
    return json(500, { ok: false, error: "PDF render failed.", message: String(e?.message || e), route: "/api/render/pleading" });
  }
}
