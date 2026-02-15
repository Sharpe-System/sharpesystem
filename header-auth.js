// /header-auth.js
import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

function $(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.classList.toggle("hidden", !on); }

function wireHeaderAuth() {
  const navLogin = $("navLogin");
  const navDashboard = $("navDashboard");
  const navLogout = $("navLogout");

  // Header may not be injected yet.
  if (!navLogin && !navDashboard && !navLogout) return false;

  onAuthStateChanged(auth, (user) => {
    const loggedIn = !!user;

    show(navLogin, !loggedIn);
    show(navDashboard, loggedIn);
    show(navLogout, loggedIn);

    // If user clicks "Log in" while already logged in, send to dashboard.
    if (navLogin) {
      navLogin.onclick = (e) => {
        if (!loggedIn) return;
        e.preventDefault();
        window.location.assign("/dashboard.html");
      };
    }
  });

  if (navLogout) {
    navLogout.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.log(e);
      } finally {
        window.location.assign("/home.html");
      }
    });
  }

  return true;
}

// Header is injected async. Retry briefly until present.
let tries = 0;
const timer = setInterval(() => {
  tries += 1;
  const ok = wireHeaderAuth();
  if (ok || tries > 60) clearInterval(timer);
}, 150);
