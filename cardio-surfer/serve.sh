#!/usr/bin/env sh
# Cardio Surfer - run it locally on macOS / Linux.
#   ./serve.sh   then open http://localhost:8080/
# The camera only works on https:// or localhost, which is why this
# needs a server rather than opening index.html directly.
cd "$(dirname "$0")" || exit 1
PORT=${PORT:-8080}
echo "Serving on http://localhost:$PORT/  (ctrl-c to stop)"
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v node >/dev/null 2>&1; then
  exec npx --yes http-server -p "$PORT" -c-1 .
else
  echo "Need python3 or node installed." >&2
  exit 1
fi
