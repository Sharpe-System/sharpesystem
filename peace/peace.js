import { getAuthStateOnce } from "/firebase-config.js";

(async () => {
  const user = await getAuthStateOnce();
  if (!user) return;

  // Peace module UI logic
})();
