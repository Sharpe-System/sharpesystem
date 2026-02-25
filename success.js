/* /success.js
   Payment/checkout success landing (Phase 1)
   - Requires auth (via gate.js + auth state)
   - Calls server-side entitlement grant endpoint
   - Redirects to return path (or dashboard)
*/

import { authOnAuthStateChanged, auth } from "./firebase-config.js";

(function () {
  "use strict";

  function getParam(name) {
    try { return new URLSearchParams(window.location.search).get(name); } catch { return null; }
  }

  function safePath(raw) {
    if (!raw) return null;
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return null;
  }

  const returnTo = safePath(getParam("return")) || "/dashboard.html";

  const box = document.querySelector(".template-box") || document.body;
  function setMsg(html) {
    try { box.innerHTML = html; } catch {}
  }

  authOnAuthStateChanged(auth, async (user) => {
    if (!user) {
      const url = "/login.html?next=" + encodeURIComponent("/success.html?return=" + encodeURIComponent(returnTo));
      try { window.location.href = url; } catch {}
      return;
    }

    setMsg(
      "<h1>Finalizing…</h1>" +
      "<p class='muted'>Confirming access. Do not close this tab.</p>"
    );

    let token = "";
    try { token = await user.getIdToken(); } catch {}

    const res = await fetch("/api/entitlements/export/grant", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + token
      },
      body: JSON.stringify({ source: "success" })
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      setMsg(
        "<h1>Success</h1>" +
        "<p class='muted'>Payment completed, but access could not be confirmed.</p>" +
        "<pre style='white-space:pre-wrap; margin-top:12px;'>" + String(t).slice(0, 2000) + "</pre>" +
        "<div class='cta-row' style='margin-top:12px;'>" +
          "<a class='button primary' href='" + returnTo + "'>Continue</a>" +
          "<a class='button' href='/dashboard.html'>Dashboard</a>" +
        "</div>"
      );
      return;
    }

    setMsg(
      "<h1>Success</h1>" +
      "<p class='muted'>Access unlocked.</p>" +
      "<div class='cta-row' style='margin-top:12px;'>" +
        "<a class='button primary' href='" + returnTo + "'>Continue</a>" +
        "<a class='button' href='/dashboard.html'>Dashboard</a>" +
      "</div>"
    );

    try { window.location.href = returnTo; } catch {}
  });
})();
