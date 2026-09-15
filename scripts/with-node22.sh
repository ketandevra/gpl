#!/bin/sh
# Wrangler 4 requires Node 22+. Prefer Homebrew node@22 without changing
# the machine default (this repo's /usr/local/bin/node is still 20).
for candidate in \
  /opt/homebrew/opt/node@22/bin \
  /usr/local/opt/node@22/bin
do
  if [ -x "$candidate/node" ]; then
    PATH="$candidate:$PATH"
    export PATH
    break
  fi
done

major=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
if [ "$major" -lt 22 ]; then
  echo "Wrangler needs Node.js 22+. You are using $(node -v 2>/dev/null || echo unknown)."
  echo "Install with: brew install node@22"
  exit 1
fi

exec "$@"
