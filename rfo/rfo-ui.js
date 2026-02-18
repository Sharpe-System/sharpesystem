import { getAuthStateOnce } from "/firebase-config.js";

(async () => {
  const user = await getAuthStateOnce();
  if (!user) return;

  // RFO UI logic
})();
