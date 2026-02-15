// /header-auth.js
// Header account link behavior (NO redirects, just swaps links/buttons)

import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

function setEl(id, fn) {
  const el = document.getElementById(id);
  if (el) fn(el);
}

function setLoggedOutUI() {
  setEl("navAccount", (a) => {
    a.textContent = "Log in";
    a.setAttribute("href", "/login?next=/dashboard");
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
    a.setAttribute("href", "/dashboard");
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
        // go home after logout; no loops
        window.location.href = "/home";
      } catch (e) {
        console.error(e);
      }
    });
  });
}

// Called AFTER header HTML is injected
window.initHeaderAuth = function initHeaderAuth() {
  bindLogoutOnce();

  // Default to logged out UI until auth resolves
  setLoggedOutUI();

  onAuthStateChanged(auth, (user) => {
    if (user) setLoggedInUI();
    else setLoggedOutUI();
  });
};
