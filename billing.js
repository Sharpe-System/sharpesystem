import { getAuthStateOnce, getUserProfile } from "/firebase-config.js";

(async () => {
  const user = await getAuthStateOnce();
  if (!user) return;

  const profile = await getUserProfile(user.uid);
  if (!profile) return;

  document.documentElement.dataset.userTier = profile.tier || "free";
})();
