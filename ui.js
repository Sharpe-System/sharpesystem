/* =========================================================
   SharpeSystem — UI Hardening Layer
   File: /ui.js

   Safe to include on any page.
   - Offline banner + basic network awareness
   - Global toast notifications (errors/success)
   - External link hardening (noopener/noreferrer)
   - Focus management for in-page navigation
   - Form UX: disable double-submit, mark required, show simple validation toast
   - Page loading indicator hooks (optional)
   - Defensive error capture (window.onerror / unhandledrejection)

   Does NOT modify auth layer files.
   ========================================================= */

(function () {
  "use strict";

  const UI = {};
  const doc = document;

  function el(tag, attrs = {}, children = []) {
    const n = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) n.setAttribute(k, String(v));
    }
    for (const c of children) n.append(c);
    return n;
  }

  // ---------- Toasts ----------
  let toastHost = null;

  function ensureToastHost() {
    if (toastHost) return toastHost;
    toastHost = el("div", {
      id: "ui-toast-host",
      style: [
        "position:fixed",
        "right:16px",
        "bottom:16px",
        "z-index:9999",
        "display:grid",
        "gap:10px",
        "max-width:min(420px, calc(100vw - 32px))"
      ].join(";")
    });
    doc.body.appendChild(toastHost);
    return toastHost;
  }

  function toast(message, type = "info", opts = {}) {
    const host = ensureToastHost();
    const duration = Number.isFinite(opts.duration) ? opts.duration : 4200;

    const border =
      type === "ok" ? "rgba(52,211,153,.35)" :
      type === "warn" ? "rgba(251,191,36,.35)" :
      type === "bad" ? "rgba(251,113,133,.35)" :
      "rgba(110,231,255,.25)";

    const bg =
      type === "ok" ? "rgba(52,211,153,.10)" :
      type === "warn" ? "rgba(251,191,36,.10)" :
      type === "bad" ? "rgba(251,113,133,.10)" :
      "rgba(255,255,255,.04)";

    const t = el("div", {
      role: "status",
      "aria-live": "polite",
      style: [
        "border:1px solid " + border,
        "background:" + bg,
        "color:rgba(232,238,246,.95)",
        "border-radius:16px",
        "padding:12px 14px",
        "box-shadow:0 18px 40px rgba(0,0,0,.30)",
        "backdrop-filter: blur(10px)",
        "-webkit-backdrop-filter: blur(10px)",
        "font-size:14px",
        "line-height:1.35",
        "display:flex",
        "gap:10px",
        "align-items:flex-start"
      ].join(";")
    });

    const txt = el("div", {}, [doc.createTextNode(String(message))]);
    const btn = el("button", {
      type: "button",
      "aria-label": "Dismiss",
      style: [
        "margin-left:auto",
        "border:1px solid rgba(27,42,63,.8)",
        "background:rgba(255,255,255,.03)",
        "color:rgba(232,238,246,.9)",
        "border-radius:12px",
        "padding:6px 10px",
        "cursor:pointer"
      ].join(";"),
      onclick: () => t.remove()
    }, [doc.createTextNode("Close")]);

    t.append(txt, btn);
    host.appendChild(t);

    if (duration > 0) setTimeout(() => { if (t.isConnected) t.remove(); }, duration);
  }

  UI.toast = toast;

  // ---------- Offline Banner ----------
  let offlineBar = null;

  function ensureOfflineBar() {
    if (offlineBar) return offlineBar;
    offlineBar = el("div", {
      id: "ui-offline-bar",
      role: "status",
      "aria-live": "polite",
      style: [
        "position:fixed",
        "left:0",
        "right:0",
        "top:0",
        "z-index:10000",
        "display:none",
        "padding:10px 14px",
        "text-align:center",
        "border-bottom:1px solid rgba(251,191,36,.35)",
        "background:rgba(251,191,36,.12)",
        "color:rgba(232,238,246,.95)",
        "backdrop-filter: blur(10px)",
        "-webkit-backdrop-filter: blur(10px)"
      ].join(";")
    }, [doc.createTextNode("You appear to be offline. Some features may not load.")]);
    doc.body.appendChild(offlineBar);
    return offlineBar;
  }

  function setOffline(isOffline) {
    const bar = ensureOfflineBar();
    bar.style.display = isOffline ? "block" : "none";
    if (!isOffline) return;
    // Avoid spamming toasts.
    if (!setOffline._didToast) {
      toast("Offline detected. If pages are slow, check Wi-Fi and reload.", "warn", { duration: 4500 });
      setOffline._didToast = true;
      setTimeout(() => { setOffline._didToast = false; }, 12000);
    }
  }

  // ---------- External Link Hardening ----------
  function hardenLinks() {
    const links = doc.querySelectorAll('a[href]');
    for (const a of links) {
      const href = a.getAttribute("href") || "";
      if (!href) continue;

      // If it opens a new tab, enforce security flags.
      const target = (a.getAttribute("target") || "").toLowerCase();
      const isExternal = /^https?:\/\//i.test(href) && !href.startsWith(location.origin);

      if (target === "_blank") {
        const rel = (a.getAttribute("rel") || "").split(/\s+/).filter(Boolean);
        if (!rel.includes("noopener")) rel.push("noopener");
        if (!rel.includes("noreferrer")) rel.push("noreferrer");
        a.setAttribute("rel", rel.join(" "));
      }

      // Optional: mark external links with a tiny hint for screen readers
      if (isExternal && !a.dataset.externalMarked) {
        a.dataset.externalMarked = "1";
        a.setAttribute("aria-label", (a.getAttribute("aria-label") || a.textContent || "External link") + " (opens external site)");
      }
    }
  }

  // ---------- Focus for hash navigation ----------
  function focusHashTarget() {
    const hash = location.hash;
    if (!hash || hash.length < 2) return;
    const id = decodeURIComponent(hash.slice(1));
    const target = doc.getElementById(id);
    if (!target) return;

    // Make focusable if needed
    const hadTabindex = target.hasAttribute("tabindex");
    if (!hadTabindex) target.setAttribute("tabindex", "-1");

    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "smooth", block: "start" });

    if (!hadTabindex) {
      // restore after focus for cleanliness
      setTimeout(() => {
        if (target.isConnected) target.removeAttribute("tabindex");
      }, 1500);
    }
  }

  // ---------- Form UX Hardening ----------
  function hardenForms() {
    const forms = doc.querySelectorAll("form");
    for (const f of forms) {
      if (f.dataset.uiHardened) continue;
      f.dataset.uiHardened = "1";

      // Disable double-submit
      f.addEventListener("submit", (e) => {
        const submitter = e.submitter;
        if (submitter && submitter.tagName === "BUTTON") {
          if (submitter.dataset.submitting === "1") {
            e.preventDefault();
            return;
          }
          submitter.dataset.submitting = "1";
          submitter.disabled = true;
          const old = submitter.textContent;
          submitter.dataset.oldText = old || "";
          submitter.textContent = "Working…";
          setTimeout(() => {
            // Failsafe unlock in case a page doesn’t navigate
            if (!submitter.isConnected) return;
            submitter.disabled = false;
            submitter.dataset.submitting = "0";
            submitter.textContent = submitter.dataset.oldText || "Submit";
          }, 12000);
        }

        // Basic required check + toast (doesn’t replace native validation)
        const required = f.querySelectorAll("[required]");
        for (const field of required) {
          if (field.disabled) continue;
          const val = (field.value || "").trim();
          if (!val) {
            toast("Please complete all required fields.", "warn");
            // Bring attention to first missing field
            try { field.focus(); } catch (_) {}
            break;
          }
        }
      });

      // Mark required labels visually if label wraps/precede input
      const requiredInputs = f.querySelectorAll("[required]");
      for (const input of requiredInputs) {
        const id = input.getAttribute("id");
        if (!id) continue;
        const lab = f.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (!lab) continue;
        if (lab.dataset.reqMarked) continue;
        lab.dataset.reqMarked = "1";
        lab.appendChild(doc.createTextNode(" *"));
        lab.style.color = "rgba(182,194,210,.95)";
      }
    }
  }

  // ---------- Global error capture (defensive) ----------
  function attachErrorHandlers() {
    window.addEventListener("error", (ev) => {
      const msg = ev && ev.message ? String(ev.message) : "An unexpected error occurred.";
      // Avoid infinite loops
      if (attachErrorHandlers._last === msg) return;
      attachErrorHandlers._last = msg;
      toast(msg, "bad", { duration: 6500 });
    });

    window.addEventListener("unhandledrejection", (ev) => {
      const reason = ev && ev.reason ? ev.reason : null;
      const msg = reason && reason.message ? String(reason.message) : "A network or script error occurred.";
      if (attachErrorHandlers._last === msg) return;
      attachErrorHandlers._last = msg;
      toast(msg, "bad", { duration: 6500 });
    });
  }

  // ---------- Optional page loading hooks ----------
  function attachLoadHooks() {
    // If a page includes an element with id="globalLoading", we will manage it.
    const loader = doc.getElementById("globalLoading");
    if (!loader) return;

    function show() { loader.style.display = "block"; }
    function hide() { loader.style.display = "none"; }

    // Show during navigation clicks that look like page transitions
    doc.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href) return;
      if (href.startsWith("#")) return;
      if (a.getAttribute("target") === "_blank") return;
      show();
      setTimeout(hide, 8000);
    });

    window.addEventListener("pageshow", hide);
    window.addEventListener("pagehide", show);
  }

  // ---------- Init ----------
  function init() {
    hardenLinks();
    hardenForms();
    focusHashTarget();
    attachErrorHandlers();
    attachLoadHooks();

    setOffline(!navigator.onLine);
    window.addEventListener("offline", () => setOffline(true));
    window.addEventListener("online", () => {
      setOffline(false);
      toast("Back online.", "ok", { duration: 1800 });
    });

    // Re-run when DOM changes (lightweight observer)
    const obs = new MutationObserver(() => {
      hardenLinks();
      hardenForms();
    });
    obs.observe(doc.documentElement, { subtree: true, childList: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();

  // Expose a tiny API if you want it
  window.SharpeUI = UI;

})();
