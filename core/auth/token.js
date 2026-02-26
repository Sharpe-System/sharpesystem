cat > core/auth/token.js <<'EOF'
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
EOF
