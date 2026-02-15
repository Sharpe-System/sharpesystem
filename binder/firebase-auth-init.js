// /firebase-auth-init.js
import app from "/firebase-config.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth(app);

// Call once; safe if repeated.
setPersistence(auth, browserLocalPersistence).catch(() => {});
export default auth;
