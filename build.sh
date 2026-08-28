#!/bin/sh
# app/harmony-stack.html is body-only — the form the Artifact host expects.
# This wraps it into a standalone index.html for plain web hosting, hoisting
# the head material (title, meta, fonts, styles) out of the body fragment.
set -e
SPLIT=$(grep -n '<div class="wrap">' app/harmony-stack.html | head -1 | cut -d: -f1)
{
  printf '%s\n' '<!doctype html>' '<html lang="en">' '<head>' '<meta charset="utf-8">'
  head -n $((SPLIT - 1)) app/harmony-stack.html
  printf '%s\n' '</head>' '<body>'
  tail -n +$SPLIT app/harmony-stack.html
  printf '%s\n' '</body>' '</html>'
} > index.html
echo "wrote index.html"
