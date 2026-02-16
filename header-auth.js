// /header-auth.js
// Frozen AUTH CORE helper:
// - Updates header auth UI if elements exist
// - Provides logout action
// - Does not redirect or gate pages (gate.js owns gating)

import { getAuthStateOnce, getUserProfile, auth } from "/firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

function qs(sel) { return document.querySelector(sel); }

function safeText(el, txt) {
  if (!el) return;
  el.textContent = txt;
}

function show(el, on) {
  if (!el) return;
  el.style.display = on ? "" : "none";
}

(async function headerAuthBoot() {
  // Optional hooks (use whichever your header has):
  const elUser = qs("[data-auth-user]");          // span/div for "Signed in as..."
  const elTier = qs("[data-auth-tier]");          // badge/label
  const elLogin = qs("[data-auth-login]");        // link/button -> login
  const elLogout = qs("[data-auth-logout]");      // button -> logout

  // If nothing exists, do nothing.
  if (!elUser && !elTier && !elLogin && !elLogout) return;

  const { user } = await getAuthStateOnce();

  if (!user) {
    show(elLogin, true);
    show(elLogout, false);
    safeText(elUser, "");
    safeText(elTier, "");
    return;
  }

  show(elLogin, false);
  show(elLogout, true);

  safeText(elUser, user.email || "Signed in");
  const profile = await getUserProfile(user.uid);
  safeText(elTier, (profile?.tier || "free").toString());

  if (elLogout) {
    elLogout.addEventListener("click", async (e) => {
      e.preventDefault();
      try { await signOut(auth); } catch {}
      // No redirect here. If page requires auth, gate.js on reload/navigation will handle.
      window.location.reload();
    }, { once: true });
  }
})();
