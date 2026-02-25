(function () {
  "use strict";

  var DRAFT_KEY = "ss:draft:rfo";
  var API_URL = "/api/render/fl300";
  var DOWNLOAD_NAME = "FL-300.pdf";

  var lastBlobUrl = "";
  var lastBlob = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setStatus(s) {
    var el = $("#pdfStatus");
    if (el) el.textContent = String(s || "");
  }

  function setPreview(url) {
    var iframe = $("#pdfPreview");
    if (iframe) iframe.src = url || "";
  }

  function setDownload(blobUrl, enabled) {
    var a = $("#btnDownload");
    if (!a) return;

    if (!enabled || !blobUrl) {
      a.setAttribute("href", "#");
      a.setAttribute("aria-disabled", "true");
      a.classList.add("disabled");
      a.removeAttribute("download");
      return;
    }

    a.classList.remove("disabled");
    a.removeAttribute("aria-disabled");
    a.setAttribute("href", blobUrl);
    a.setAttribute("download", DOWNLOAD_NAME);
  }

  function revokeLastBlobUrl() {
    if (lastBlobUrl) {
      try { URL.revokeObjectURL(lastBlobUrl); } catch (_) {}
      lastBlobUrl = "";
    }
  }

  function setDebug(obj) {
    var pre = $("#debugOut");
    if (!pre) return;
    pre.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function readLocalDraftRaw() {
    try {
      return localStorage.getItem(DRAFT_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function readLocalDraftObject() {
    var raw = readLocalDraftRaw();
    if (!raw) return { ok: false, reason: "missing", raw: "" };

    try {
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return { ok: false, reason: "not_object", raw: raw };
      return { ok: true, reason: "ok", raw: raw, obj: obj };
    } catch (e) {
      return { ok: false, reason: "invalid_json", raw: raw, error: String(e && e.message ? e.message : e) };
    }
  }

  function payloadByteSize(str) {
    try {
      return new TextEncoder().encode(str).byteLength;
    } catch (_) {
      return str.length;
    }
  }

  function showNoDraftNotice(reason, extra) {
    var box = $("#draftNotice");
    var list = $("#inputList");
    var btn = $("#btnGen");

    if (btn) btn.disabled = true;
    if (list) list.innerHTML = "";
    if (!box) return;

    var html = "";
    if (reason === "missing") {
      html =
        "<div><strong>No draft found.</strong></div>" +
        "<div class='muted' style='margin-top:6px;'>Expected localStorage key <code>" + esc(DRAFT_KEY) + "</code>.</div>" +
        "<div style='margin-top:10px;' class='row'>" +
          "<a class='btn' href='/rfo/review'>Go to /rfo/review</a>" +
          "<a class='btn' href='/start'>Go to /start</a>" +
        "</div>";
    } else if (reason === "invalid_json") {
      html =
        "<div><strong>Draft is not valid JSON.</strong></div>" +
        "<div class='muted' style='margin-top:6px;'>Clear the key and rebuild the draft from review/start.</div>" +
        "<div class='mono' style='margin-top:10px;'>" + esc(extra || "") + "</div>" +
        "<div style='margin-top:10px;' class='row'>" +
          "<a class='btn' href='/rfo/review'>Go to /rfo/review</a>" +
          "<a class='btn' href='/start'>Go to /start</a>" +
        "</div>";
    } else {
      html =
        "<div><strong>Draft could not be loaded.</strong></div>" +
        "<div class='mono' style='margin-top:10px;'>" + esc(extra || "") + "</div>" +
        "<div style='margin-top:10px;' class='row'>" +
          "<a class='btn' href='/rfo/review'>Go to /rfo/review</a>" +
          "<a class='btn' href='/start'>Go to /start</a>" +
        "</div>";
    }

    box.style.display = "";
    box.innerHTML = html;
  }

  function hideNoDraftNotice() {
    var box = $("#draftNotice");
    if (!box) return;
    box.style.display = "none";
    box.innerHTML = "";
  }

  function hydratePanel(draftObj) {
    hideNoDraftNotice();

    var list = $("#inputList");
    if (!list) return;

    var r = (draftObj && draftObj.rfo && typeof draftObj.rfo === "object") ? draftObj.rfo : {};

    list.innerHTML =
      "<div><strong>Loaded from:</strong> localStorage:" + esc(DRAFT_KEY) + "</div>" +
      "<div style='margin-top:10px; line-height:1.35;'>" +
        "<div><strong>County</strong>: " + esc(r.county || "—") + "</div>" +
        "<div><strong>Branch</strong>: " + esc(r.branch || "—") + "</div>" +
        "<div><strong>Case #</strong>: " + esc(r.caseNumber || "—") + "</div>" +
        "<div><strong>Role</strong>: " + esc(r.role || "—") + "</div>" +
        "<div><strong>Custody</strong>: " + (r.reqCustody ? "Yes" : "No") + "</div>" +
        "<div><strong>Support</strong>: " + (r.reqSupport ? "Yes" : "No") + "</div>" +
        "<div><strong>Other</strong>: " + (r.reqOther ? "Yes" : "No") + "</div>" +
        "<div><strong>Details</strong>: " + esc(r.requestDetails || "—") + "</div>" +
      "</div>";

    setStatus("Not generated");
    setPreview("");
    setDownload("", false);
    setDebug({
      payloadBytes: 0,
      lastResponseStatus: null,
      lastContentType: null
    });
  }

  async function generateFilledPdf(draftObj) {
    var btn = $("#btnGen");
    if (btn) btn.disabled = true;

    revokeLastBlobUrl();
    lastBlob = null;

    try {
      setStatus("Generating…");
      setDownload("", false);

      var payload = JSON.stringify({ rfo: draftObj });
      var size = payloadByteSize(payload);

      var res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/pdf, application/json"
        },
        body: payload
      });

      var ct = (res.headers.get("content-type") || "");
      setDebug({
        payloadBytes: size,
        lastResponseStatus: res.status,
        lastContentType: ct
      });

      if (res.status === 200 && ct.toLowerCase().indexOf("application/pdf") !== -1) {
        var buf = await res.arrayBuffer();
        var blob = new Blob([buf], { type: "application/pdf" });
        var blobUrl = URL.createObjectURL(blob);

        lastBlob = blob;
        lastBlobUrl = blobUrl;

        setPreview(blobUrl);
        setDownload(blobUrl, true);
        setStatus("Generated");
        return;
      }

      var bodyText = "";
      try {
        if (ct.toLowerCase().indexOf("application/json") !== -1) {
          var j = await res.json();
          bodyText = JSON.stringify(j, null, 2);
        } else {
          bodyText = await res.text();
        }
      } catch (e) {
        bodyText = "Could not read error body: " + String(e && e.message ? e.message : e);
      }

      setStatus("Failed");
      setDebug({
        payloadBytes: size,
        lastResponseStatus: res.status,
        lastContentType: ct,
        error: bodyText ? String(bodyText).slice(0, 4000) : ""
      });
    } catch (e) {
      setStatus("Failed");
      setDebug({
        payloadBytes: 0,
        lastResponseStatus: null,
        lastContentType: null,
        error: String(e && e.message ? e.message : e)
      });
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function boot() {
    var draftRead = readLocalDraftObject();

    if (!draftRead.ok) {
      setPreview("");
      setDownload("", false);
      setStatus("No draft");
      if (draftRead.reason === "missing") showNoDraftNotice("missing", "");
      else if (draftRead.reason === "invalid_json") showNoDraftNotice("invalid_json", draftRead.error || "");
      else showNoDraftNotice(draftRead.reason, "");
      setDebug({
        payloadBytes: 0,
        lastResponseStatus: null,
        lastContentType: null
      });
      return;
    }

    var btn = $("#btnGen");
    if (btn) btn.disabled = false;

    hydratePanel(draftRead.obj);

    if (btn) {
      btn.addEventListener("click", function () {
        generateFilledPdf(draftRead.obj);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
