#!/usr/bin/env bash
# Build every PDF from its HTML body + the shared brand stylesheet.
# Usage: ./build.sh          (build all)
#        ./build.sh 01       (build one)
set -euo pipefail
cd "$(dirname "$0")"
CHROME=${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}
CSS=brand/style.css
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for body in pdfs/*.body.html; do
  name=$(basename "$body" .body.html)
  [[ $# -gt 0 && "$name" != *"$1"* ]] && continue
  title=$(grep -o '<!-- title: [^>]*-->' "$body" | head -1 | sed 's/<!-- title: //;s/ *-->//')
  { echo '<!doctype html><html><head><meta charset="utf-8">'
    echo "<title>${title:-$name}</title><style>"
    cat "$CSS"
    echo '</style></head><body>'
    cat "$body"
    echo '</body></html>'
  } > "$TMP/$name.html"
  "$CHROME" --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
    --print-to-pdf="pdfs/$name.pdf" "$TMP/$name.html" 2>/dev/null
  echo "built pdfs/$name.pdf  ($(du -h "pdfs/$name.pdf" | cut -f1))"
done
