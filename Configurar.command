#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Instale Node.js LTS em https://nodejs.org e execute novamente.'
  exit 1
fi
npm ci --no-fund
npm run build
exec node scripts/launch.cjs
