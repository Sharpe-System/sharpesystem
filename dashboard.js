/* /dashboard.js
   Fix: never call getAuth() here.
   Use getAuthStateOnce + getUserProfile from firebase-config.js.
*/

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";

function $(id) { return document.getElementById(id); }

const tierEl = $("tierValue") || $("tier");
const activeEl = $("activeValue") || $("active");
const statusEl = $("statusLine") || $("status");

function setText(el, text) { if (el) el.textContent = text || ""; }

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
    const tier = profile?.tier || "free";
    const active = (typeof profile?.active === "boolean") ? profile.active : false;

    setText(statusEl, "Session active.");
    setText(tierEl, tier);
    setText(activeEl, active ? "Yes" : "No");
  } catch (e) {
    console.error(e);
    setText(statusEl, "Session check failed. See console.");
  }
})();
