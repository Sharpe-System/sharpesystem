// /header-auth.js
// Header account link behavior (NO redirects, just swaps links/buttons)
// Uses shared auth export from firebase-config.js
// No re-init. No duplicate listeners.

import { auth } from "/firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

function setEl(id, fn) {
  const el = document.getElementById(id);
  if (el) fn(el);
}

function setLoggedOutUI() {
  setEl("navAccount", (a) => {
    a.textContent = "Log in";
    a.setAttribute("href", "/login.html?next=/dashboard.html");
    a.style.display = "";
  });

  setEl("navLogout", (b) => {
    b.style.display = "none";
    b.setAttribute("aria-hidden", "true");
  });
}

function setLoggedInUI() {
  setEl("navAccount", (a) => {
    a.textContent = "Dashboard";
    a.setAttribute("href", "/dashboard.html");
    a.style.display = "";
  });

  setEl("navLogout", (b) => {
    b.style.display = "";
    b.removeAttribute("aria-hidden");
  });
}

function bindLogoutOnce() {
  setEl("navLogout", (b) => {
    if (b.dataset.bound === "1") return;
    b.dataset.bound = "1";

    b.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "/home.html";
      } catch (e) {
        console.error(e);
      }
    });
  });
}

// Called AFTER header HTML is injected
window.initHeaderAuth = function initHeaderAuth() {
  bindLogoutOnce();

  // Default state before resolution
  setLoggedOutUI();

  onAuthStateChanged(auth, (user) => {
    if (user) setLoggedInUI();
    else setLoggedOutUI();
  });
};
