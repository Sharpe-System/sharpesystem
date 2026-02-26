// Canon: lightweight browser helper for acquiring a Firebase ID token.
// Do NOT add new Firebase imports here beyond firebase-config.js.

import { auth } from "/firebase-config.js";

/**
 * Returns a Firebase ID token for the currently signed-in user.
 * Throws if no user is signed in.
 *
 * Usage:
 *   import { getAuthToken } from "/core/auth/token.js";
 *   const token = await getAuthToken();
 */
export async function getAuthToken() {
  // Fast path: already signed in
  if (auth && auth.currentUser) {
    return await auth.currentUser.getIdToken();
  }

  // Wait once for auth state to resolve
  const user = await new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged((u) => {
      try { unsub(); } catch (e) {}
      resolve(u || null);
    });
  });

  if (!user) {
    throw new Error("Not authenticated: no current user");
  }

  return await user.getIdToken();
}
