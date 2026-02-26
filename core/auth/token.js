cat > core/auth/token.js <<'EOF'
import { auth } from "/firebase-config.js";

/**
 * Canon helper: returns Firebase ID token for authenticated user.
 * No Firebase imports here except from firebase-config.js.
 */
export async function getAuthToken(forceRefresh = true) {
  const u = auth?.currentUser;
  if (!u) throw new Error("Not signed in (auth.currentUser is null).");
  return await u.getIdToken(forceRefresh);
}
EOF
