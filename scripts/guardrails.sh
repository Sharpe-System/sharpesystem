cd /Users/nathansharpe/Desktop/sharpesystem || exit 1
mkdir -p scripts

cat > scripts/guardrails.sh <<'EOF'
#!/bin/bash
set -eu

echo "== SharpeSystem Guardrails =="

# 1) Block legacy global firebase bypass in JS source (ignore scripts/)
echo "[1/3] Checking for legacy global firebase bypass in JS files..."
if grep -RIn --include="*.js" --exclude-dir="scripts" "window\.firebase" . >/dev/null 2>&1; then
  echo "FAIL: Found legacy global firebase usage in JS source."
  grep -RIn --include="*.js" --exclude-dir="scripts" "window\.firebase" .
  exit 1
fi
echo "OK: No legacy global firebase usage in JS source."

# 2) Block Firebase CDN imports outside approved canon files
echo "[2/3] Checking for Firebase CDN imports outside approved canon files..."

ALLOWED="firebase-config.js gate.js login.js signup.js billing.js peace/peace.js"

is_allowed() {
  f="$1"
  for a in $ALLOWED; do
    if [ "$f" = "$a" ]; then
      return 0
    fi
  done
  return 1
}

TMP="/tmp/jsfiles.$$"
git ls-files "*.js" > "$TMP"

HIT=0
while IFS= read -r f; do
  if is_allowed "$f"; then
    continue
  fi

  if grep -q "https://www.gstatic.com/firebasejs/" "$f" 2>/dev/null; then
    echo "FAIL: Firebase CDN import found outside canon: $f"
    grep -n "https://www.gstatic.com/firebasejs/" "$f" || true
    HIT=1
  fi
done < "$TMP"

rm -f "$TMP"

if [ "$HIT" -ne 0 ]; then
  echo ""
  echo "Fix: only these files may import Firebase CDN:"
  echo "  $ALLOWED"
  exit 1
fi

echo "OK: Firebase CDN imports are confined to approved files."

# 3) Ensure every HTML route is listed in routes.manifest.json
echo "[3/3] Checking that all HTML routes are in routes.manifest.json..."

if [ ! -f "routes.manifest.json" ]; then
  echo "FAIL: routes.manifest.json missing at repo root."
  exit 1
fi

ALL_HTML="/tmp/allhtml.$$"
MAN_HTML="/tmp/manhtml.$$"

git ls-files "*.html" | sed 's#^#/#' | sort -u > "$ALL_HTML"

node -e '
  const fs=require("fs");
  const m=JSON.parse(fs.readFileSync("routes.manifest.json","utf8"));
  const all=[...(m.public||[]),...(m.protected||[]),...(m.paid||[])];
  const out=[...new Set(all)].sort();
  console.log(out.join("\n"));
' > "$MAN_HTML"

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
EOF

chmod +x scripts/guardrails.sh
