/* /billing.js */

import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";

function $(id) { return document.getElementById(id); }

const tierEl = $("tierValue");
const activeEl = $("activeValue");

function setText(el, value) {
  if (el) el.textContent = value;
}

(async function init() {
  try {
    const { user } = await getAuthStateOnce();

    if (!user) {
      setText(tierEl, "Not logged in");
      setText(activeEl, "—");
      return;
    }

    const profile = await getUserProfile(user.uid);

    const tier = profile?.tier || "free";
    const active = profile?.active ? "Yes" : "No";

    setText(tierEl, tier);
    setText(activeEl, active);

  } catch (err) {
    console.error(err);
    setText(tierEl, "Error");
    setText(activeEl, "Error");
  }
})();
