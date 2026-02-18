#!/bin/bash
set -euo pipefail

echo "== SharpeSystem Guardrails =="

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  echo ""
  echo "FAIL: $1"
  exit 1
}

# ---------- 1) Zero-tolerance: legacy globals ----------
echo "[1/5] Checking for forbidden legacy Firebase globals..."
if grep -RIn --include="*.js" --exclude-dir="scripts" "window\.firebase" . >/dev/null 2>&1; then
  echo "Found forbidden legacy Firebase globals:"
  grep -RIn --include="*.js" --exclude-dir="scripts" "window\.firebase" .
  fail "window.firebase* usage is forbidden (C7)."
fi
echo "OK"

# ---------- 2) Zero-tolerance: Firebase CDN imports outside firebase-config.js ----------
echo "[2/5] Checking for Firebase CDN imports outside /firebase-config.js..."
HITS="$(grep -RIn --include="*.js" "https://www\.gstatic\.com/firebasejs/" . || true)"

if [ -n "$HITS" ]; then
  BAD="$(echo "$HITS" | grep -vE '^firebase-config\.js:' || true)"
  if [ -n "$BAD" ]; then
    echo "$BAD"
    fail "Firebase CDN import found outside /firebase-config.js (C1)."
  fi
fi
echo "OK"

# ---------- 3) Zero-tolerance: onAuthStateChanged outside firebase-config.js ----------
echo "[3/5] Checking for onAuthStateChanged outside /firebase-config.js..."
HITS="$(grep -RIn --include="*.js" "onAuthStateChanged" . || true)"
if [ -n "$HITS" ]; then
  BAD="$(echo "$HITS" | grep -vE '^firebase-config\.js:' || true)"
  if [ -n "$BAD" ]; then
    echo "$BAD"
    fail "onAuthStateChanged found outside /firebase-config.js (C2)."
  fi
fi
echo "OK"

# ---------- 4) Zero-tolerance: auth redirects outside gate.js ----------
# We restrict to common patterns. Gate.js is allowed to redirect.
echo "[4/5] Checking for auth redirect patterns outside /gate.js..."
HITS="$(grep -RIn --include="*.js" "location\.(href|replace)\(\"/login\.html" . || true)"
if [ -n "$HITS" ]; then
  BAD="$(echo "$HITS" | grep -vE '^gate\.js:' || true)"
  if [ -n "$BAD" ]; then
    echo "$BAD"
    fail "Login redirects outside /gate.js are forbidden (C3)."
  fi
fi
echo "OK"

# ---------- 5) Manifest integrity: all routable HTML must be listed ----------
echo "[5/5] Checking routes.manifest.json covers all routable HTML..."

[ -f "routes.manifest.json" ] || fail "routes.manifest.json missing at repo root."

ALL_HTML="/tmp/sharpesystem_allhtml.$$"
MAN_HTML="/tmp/sharpesystem_manhtml.$$"

# Exclusions: non-routable templates/fragments
# - page.template.html
# - anything under /partials/
git ls-files "*.html" \
  | grep -vE '(^partials/|/partials/)' \
  | grep -vE '^page\.template\.html$' \
  | sed 's#^#/#' \
  | sort -u > "$ALL_HTML"

node -e '
  const fs = require("fs");
  const m = JSON.parse(fs.readFileSync("routes.manifest.json","utf8"));
  const all = [
    ...(m.public || []),
    ...(m.protected || []),
    ...(m.paid || [])
  ];
  const out = [...new Set(all)].sort();
  process.stdout.write(out.join("\n"));
' > "$MAN_HTML"

MISSING=0
while IFS= read -r route; do
  if ! grep -Fxq "$route" "$MAN_HTML"; then
    if [ "$MISSING" -eq 0 ]; then
      echo "Missing from routes.manifest.json:"
    fi
    echo " - $route"
    MISSING=1
  fi
done < "$ALL_HTML"

rm -f "$ALL_HTML" "$MAN_HTML"

[ "$MISSING" -eq 0 ] || fail "routes.manifest.json missing one or more routable HTML routes (C4)."

echo "OK"
echo "All guardrails passed."
