// /gate.js
import { auth, ensureUserDoc } from "/db.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function requireLogin(nextPath) {
  const n = encodeURIComponent(nextPath || window.location.pathname);
  window.location.replace(`/login.html?next=${n}`);
}

export function requireTier1() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return requireLogin(window.location.pathname);

      try {
        const doc = await ensureUserDoc(user.uid);
        const active = doc?.active === true;
        const tier = String(doc?.tier || "");

        if (!active || tier !== "tier1") {
          window.location.replace("/tier1.html");
          return;
        }

        resolve({ user, doc });
      } catch (e) {
        console.log(e);
        window.location.replace("/tier1.html");
      }
    });
  });
}
