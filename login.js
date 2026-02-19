// /login.js
// Canon rules:
// - NO Firebase CDN imports here (only /firebase-config.js may import Firebase)
// - NO onAuthStateChanged here (must be only in /firebase-config.js)
// - gate.js owns gating/redirects; this page only performs sign-in then navigates
// - ES module (must be loaded with <script type="module" src="/login.js"></script>)

import { authSignIn } from "/firebase-config.js";

(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const msg = $("#msg");
  const btnLogin = $("#btnLogin");
  const btnSignup = $("#btnSignup");
  const emailEl = $("#email");
  const passEl = $("#password");

  function setMsg(text, isError = false) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.style.color = isError ? "#ff6b6b" : "";
  }

  function safeNextUrl() {
    const params = new URLSearchParams(location.search);
    const next = params.get("next");
    if (!next) return "/dashboard.html";
    if (next.startsWith("/") && !next.startsWith("//")) return next;
    return "/dashboard.html";
  }

  async function doLogin() {
    const email = String(emailEl?.value || "").trim();
    const password = String(passEl?.value || "");

    if (!email || !password) {
      setMsg("Email and password required.", true);
      return;
    }

    btnLogin?.setAttribute("disabled", "disabled");
    setMsg("Signing in…");

    try {
      await authSignIn(email, password);
      window.location.href = safeNextUrl();
    } catch (err) {
      console.error("Login failed:", err);

      let text = "Login failed.";
      const code = err?.code || "";

      if (code.includes("invalid-email") || code.includes("wrong-password") || code.includes("user-not-found")) {
        text = "Invalid email or password.";
      } else if (code.includes("too-many-requests")) {
        text = "Too many attempts. Wait a moment and try again.";
      } else if (err?.message) {
        text = err.message;
      }

      setMsg(text, true);
      btnLogin?.removeAttribute("disabled");
    }
  }

  btnLogin?.addEventListener("click", doLogin);

  btnSignup?.addEventListener("click", () => {
    window.location.href = "/signup.html";
  });

  passEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });
})();
