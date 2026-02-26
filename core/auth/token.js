cat > core/auth/token.js <<'EOF'
import { auth } from "/firebase-config.js";

/**
 * Returns a Firebase ID token for the currently signed-in user.
 * Throws if no user is signed in.
 */
export async function getAuthToken(forceRefresh = true) {
  const u = auth?.currentUser;
  if (!u) throw new Error("Not signed in (auth.currentUser is null).");
  return await u.getIdToken(forceRefresh);
}
EOF
