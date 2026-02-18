#!/usr/bin/env bash
set -euo pipefail

echo "== SharpeSystem Guardrails =="

# 1) Block window.firebase* bypass everywhere
echo "[1/3] Checking for window.firebase* bypass..."
if grep -RIn "window\.firebase" -- . >/dev/null 2>&1; then
  echo "FAIL: Found window.firebase* usage. This is a bypass vector."
  grep -RIn "window\.firebase" -- .
  exit 1
fi
echo "OK: No window.firebase* usage."

# 2) Block Firebase SDK usage outside approved canon files
echo "[2/3] Checking for Firebase SDK usage outside approved files..."

# Adjust this allowlist ONLY if you intentionally centralize further.
ALLOWED_FILES=(
  "firebase-config.js"
  "gate.js"
  "login.js"
  "signup.js"
  "billing.js"
  "peace/peace.js"
)

is_allowed () {
  local f="$1"
  for a in "${ALLOWED_FILES[@]}"; do
    if [[ "$f" == "$a" ]]; then
      return 0
    fi
  done
  return 1
}

# Patterns that typically indicate Firebase SDK usage in client JS
FIREBASE_PAT='(from[[:space:]]+["'\''][^"'\'']*firebase|firebase/auth|firebase/firestore|initializeApp|getAuth|getFirestore|onAuthStateChanged|signInWithEmailAndPassword|createUserWithEmailAndPassword|signOut|doc\(|setDoc\(|getDoc\(|updateDoc\(|collection\()'

HITS=()
while IFS= read -r f; do
  if is_allowed "$f"; then
    continue
  fi
  if grep -Eq "$FIREBASE_PAT" "$f"; then
    HITS+=("$f")
  fi
done < <(git ls-files "*.js")

if (( ${#HITS[@]} > 0 )); then
  echo "FAIL: Firebase SDK usage detected outside approved canon files:"
  printf ' - %s\n' "${HITS[@]}"
  echo ""
  echo "Fix: route all Firebase usage through firebase-config.js (or a canon module)."
  exit 1
fi
echo "OK: Firebase usage is confined to approved files."

# 3) Ensure every HTML route is listed in routes.manifest.json
echo "[3/3] Checking that all HTML routes are in routes.manifest.json..."

if [[ ! -f "routes.manifest.json" ]]; then
  echo "FAIL: routes.manifest.json missing at repo root."
  exit 1
fi

# Build list of all html routes in repo (prefixed with /, normalized)
ALL_HTML=$(git ls-files "*.html" | sed 's#^#/#' | sort -u)

# Extract all manifest paths (public/protected/paid arrays)
MANIFEST_HTML=$(node -e '
  const fs=require("fs");
  const m=JSON.parse(fs.readFileSync("routes.manifest.json","utf8"));
  const all=[...(m.public||[]),...(m.protected||[]),...(m.paid||[])];
  console.log([...new Set(all)].sort().join("\n"));
')

MISSING=()
while IFS= read -r route; do
  if ! grep -Fxq "$route" <<< "$MANIFEST_HTML"; then
    MISSING+=("$route")
  fi
done <<< "$ALL_HTML"

if (( ${#MISSING[@]} > 0 )); then
  echo "FAIL: These HTML routes exist in git but are missing from routes.manifest.json:"
  printf ' - %s\n' "${MISSING[@]}"
  echo ""
  echo "Fix: add each route to public/protected/paid in routes.manifest.json."
  exit 1
fi

echo "OK: routes.manifest.json covers all HTML routes."
echo "All guardrails passed."
