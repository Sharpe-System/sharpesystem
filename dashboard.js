/* /dashboard.js
   Dashboard session check (no getAuth() calls here).
   Uses frozen firebase-config exports to avoid "getProvider" crash.
*/

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";

function $(id) { return document.getElementById(id); }

const tierEl = $("tierValue") || $("tier");        // supports either id
const activeEl = $("activeValue") || $("active");  // supports either id
const statusEl = $("statusLine") || $("status");   // supports either id

function setText(el, text) { if (el) el.textContent = text; }

(async function init() {
  try {
    setText(statusEl, "Checking session…");

    const { user } = await getAuthStateOnce();

    if (!user) {
      setText(statusEl, "Not logged in.");
      setText(tierEl, "—");
      setText(activeEl, "—");
      return;
    }

    const profile = await getUserProfile(user.uid);

    const tier = (profile && profile.tier) ? profile.tier : "free";
    const active = (profile && typeof profile.active === "boolean") ? profile.active : false;

    setText(statusEl, "Session active.");
    setText(tierEl, tier);
    setText(activeEl, active ? "Yes" : "No");
  } catch (e) {
    console.error(e);
    setText(statusEl, "Session check failed. See console.");
    setText(tierEl, "—");
    setText(activeEl, "—");
  }
})();
