// Canon: only import Firebase primitives from firebase-config.js.
// Provides a single helper for getting the current user's ID token.

import { auth } from "/firebase-config.js";

export async function getAuthToken(forceRefresh = true) {
  const u = auth?.currentUser;
  if (!u) throw new Error("Not signed in (auth.currentUser is null).");
  return await u.getIdToken(forceRefresh);
}
