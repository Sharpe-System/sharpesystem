// /db.js
// Compatibility shim: keep legacy imports working.
// Canon: Firebase CDN imports must live only in /firebase-config.js.

export { db, fsDoc, fsGetDoc, fsSetDoc, fsUpdateDoc, fsCollection } from "./firebase-config.js";
export default {};
