// /header-auth.js
// Frozen AUTH CORE helper (injection-safe, UI-only)
// - NO redirects (except optional logout destination)
// - NO gating (gate.js owns gating)
// - NO onAuthStateChanged listeners (prevents duplicate listeners on header re-injection)
// - Idempotent: safe if initHeaderAuth() is called multiple times

import { auth, getAuthStateOnce } from "/firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

function byId(id) {
  return document.getElementById(id);
}

function setLoggedOutUI() {
  const a = byId("navAccount");
  if (a) {
    a.textContent = "Log in";
    a.setAttribute("href", "/login.html?next=/dashboard.html");
    a.style.display = "";
  }

  const b = byId("navLogout");
  if (b) {
    b.style.display = "none";
    b.setAttribute("aria-hidden", "true");
  }
}

function setLoggedInUI() {
  const a = byId("navAccount");
  if (a) {
    a.textContent = "Dashboard";
    a.setAttribute("href", "/dashboard.html");
    a.style.display = "";
  }

  const b = byId("navLogout");
  if (b) {
    b.style.display = "";
    b.removeAttribute("aria-hidden");
  }
}

function bindLogoutOnce() {
  const b = byId("navLogout");
  if (!b) return;

  if (b.dataset.bound === "1") return;
  b.dataset.bound = "1";

  b.addEventListener(
    "click",
    async (e) => {
      e.preventDefault();
      try {
        await signOut(auth);
      } catch (err) {
        console.error(err);
        return;
      }
      // Optional destination. Keep deterministic.
      window.location.href = "/home.html";
    },
    { once: false }
  );
}

// Called AFTER header HTML is injected (by header-loader.js)
window.initHeaderAuth = async function initHeaderAuth() {
  // Bind logout handler exactly once per page load
  bindLogoutOnce();

  // Default state before auth resolution
  setLoggedOutUI();

  // Resolve auth state once (shared single-flight promise)
  const { user } = await getAuthStateOnce();
  if (user) setLoggedInUI();
  else setLoggedOutUI();
};
