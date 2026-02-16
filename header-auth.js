import app from "/firebase-config.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const auth = getAuth(app);
const db = getFirestore(app);

function removeAuthChecking() {
  document.documentElement.classList.remove("auth-checking");
}

function redirect(path) {
  window.location.replace(path);
}

onAuthStateChanged(auth, async (user) => {
  try {
    const requireAuth = document.body.dataset.requireAuth === "1";
    const requireTier = document.body.dataset.requireTier;

    if (!requireAuth) {
      removeAuthChecking();
      return;
    }

    if (!user) {
      redirect(`/login.html?next=${encodeURIComponent(location.pathname)}`);
      return;
    }

    if (!requireTier) {
      removeAuthChecking();
      return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
      redirect("/tier1.html");
      return;
    }

    const data = snap.data() || {};

    if (data.tier !== requireTier || data.active !== true) {
      redirect("/tier1.html");
      return;
    }

    removeAuthChecking();

  } catch (err) {
    console.error(err);
    removeAuthChecking();
  }
});
