// /auth.js
import app from "/firebase-config.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const auth = getAuth(app);

// Call once, early. Durable local persistence preferred.
// Falls back to session persistence if storage is restricted.
export async function initAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
    return "local";
  } catch (e) {
    console.log("Local persistence failed, falling back to session:", e);
    try {
      await setPersistence(auth, browserSessionPersistence);
      return "session";
    } catch (e2) {
      console.log("Session persistence failed:", e2);
      return "none";
    }
  }
}
