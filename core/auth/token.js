<<<<<<< HEAD
cat > core/auth/token.js <<'EOF'
=======
<<<<<<< HEAD
// Canon: only import Firebase primitives from firebase-config.js.
// Provides a single helper for getting the current user's ID token.

=======
<<<<<<< HEAD

=======
>>>>>>> 0b68752 (Dashboard auth token + job list UI)
>>>>>>> 49af68f (Dashboard auth token + job list UI)
import { auth } from "/firebase-config.js";

/**
 * Canon helper: fetch Firebase ID token for authenticated requests.
 * - No Firebase imports outside firebase-config.js
 * - No globals
 */
export async function getAuthToken(forceRefresh = true) {
  const u = auth?.currentUser;
  if (!u) throw new Error("Not signed in (auth.currentUser is null).");
  return await u.getIdToken(forceRefresh);
}
<<<<<<< HEAD
EOF
=======
<<<<<<< HEAD
=======
>>>>>>> 5e3e610 (Dashboard auth token + job list UI)
>>>>>>> 0b68752 (Dashboard auth token + job list UI)
>>>>>>> 49af68f (Dashboard auth token + job list UI)
