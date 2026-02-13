import app from "./firebase-config.js";
import { getAuth } from "firebase/auth";

const auth = getAuth(app);

// Temporary test
console.log("LOGIN JS LOADED");
