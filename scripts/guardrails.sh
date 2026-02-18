#!/usr/bin/env bash
set -euo pipefail

echo "== SharpeSystem Guardrails =="

ROOT="."
MANIFEST="routes.manifest.json"

# -------------------------------
# [1/3] Block window.firebase* bypass (JS only; ignore scripts/)
# -------------------------------
echo "[1/3] Checking for window.firebase* bypass in JS..."
if grep -RIn --include="*.js" --exclude-dir="scripts" "window\.firebase" "$ROOT" >/dev/null 2>&1; then
  echo "FAIL: Found window.firebase* usage (bypass vector)."
  grep -RIn --include="*.js" --exclude-dir="scripts" "window\.firebase" "$ROOT" || true
  exit 1
fi
echo "OK: No window.firebase* usage in JS."

# -------------------------------
# [2/3] Block Firebase CDN imports outside firebase-config.js
# -------------------------------
echo "[2/3] Checking for Firebase CDN imports outside firebase-config.js..."
CDN_RE='https://www\.gstatic\.com/firebasejs/'

# Find all CDN import occurrences
FOUND="$(grep -RIn -- "$CDN_RE" "$ROOT" || true)"

# Filter out allowed file(s)
VIOLATIONS="$(echo "$FOUND" | grep -vE '(^|/)\.?firebase-config\.js:' || true)"

if [ -n "$VIOLATIONS" ]; then
  echo "FAIL: Firebase CDN import(s) found outside firebase-config.js"
  echo "$VIOLATIONS"
  echo ""
  echo "Fix: Only /firebase-config.js may import Firebase CDN."
  exit 1
fi
echo "OK: No Firebase CDN imports outside firebase-config.js."

# -------------------------------
# [3/3] Ensure all HTML routes are present in routes.manifest.json
# -------------------------------
echo "[3/3] Checking routes.manifest.json covers all HTML routes..."

if [ ! -f "$MANIFEST" ]; then
  echo "FAIL: Missing $MANIFEST"
  exit 1
fi

ALL_HTML="$(mktemp)"
MAN_HTML="$(mktemp)"

# List html files (skip node_modules, .git)
find "$ROOT" \
  -type d \( -name .git -o -name node_modules \) -prune -false \
  -o -type f -name "*.html" -print \
  | sed "s|^\./|/|" \
  | sort > "$ALL_HTML"

node - <<'NODE' > "$MAN_HTML"
const fs=require("fs");
const m=JSON.parse(fs.readFileSync("routes.manifest.json","utf8"));
const all=[...(m.public||[]),...(m.protected||[]),...(m.paid||[])];
const out=[...new Set(all)].sort();
console.log(out.join("\n"));
NODE

MISSING=0
while IFS= read -r route; do
  if ! grep -Fxq "$route" "$MAN_HTML"; then
    if [ "$MISSING" -eq 0 ]; then
      echo "FAIL: These HTML routes exist in git but are missing from routes.manifest.json:"
    fi
    echo " - $route"
    MISSING=1
  fi
done < "$ALL_HTML"

rm -f "$ALL_HTML" "$MAN_HTML"

if [ "$MISSING" -ne 0 ]; then
  echo ""
  echo "Fix: add each missing route to public/protected/paid in routes.manifest.json."
  exit 1
fi

echo "OK: routes.manifest.json covers all HTML routes."
echo "All guardrails passed."
