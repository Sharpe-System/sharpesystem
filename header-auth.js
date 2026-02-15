// /header-auth.js
import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

function $(id){ return document.getElementById(id); }
function show(el, on){ if (el) el.classList.toggle("hidden", !on); }

function wire(){
  const navLogin = $("navLogin");
  const navDashboard = $("navDashboard");
  const navLogout = $("navLogout");

  // If header isn't injected yet, bail quietly.
  if (!navLogin && !navDashboard && !navLogout) return;

  onAuthStateChanged(auth, (user) => {
    const loggedIn = !!user;

    show(navLogin, !loggedIn);
    show(navDashboard, loggedIn);
    show(navLogout, loggedIn);

    // Optional: if user clicks "Log in" while already logged in, route to dashboard
    if (navLogin) {
      navLogin.onclick = (e) => {
        if (!loggedIn) return; // normal behavior
        e.preventDefault();
        window.location.assign("/dashboard.html");
      };
    }
  });

  if (navLogout) {
    navLogout.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.assign("/home.html");
      } catch (e) {
        console.log(e);
        // If signOut fails, still nudge them somewhere sane.
        window.location.assign("/home.html");
      }
    });
  }
}

// Run after DOM is ready (header may inject late, so retry a few times)
let tries = 0;
const t = setInterval(() => {
  tries += 1;
  wire();
  // once header exists, wire() will attach; stop after a bit regardless
  if (document.getElementById("navLogin") || tries > 40) clearInterval(t);
}, 150);
