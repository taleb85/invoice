#!/usr/bin/env bash
# Deploy su Vercel da una copia senza .git: evita il blocco Hobby
# "Git author … must have access to the team" quando i commit non coincidono col proprietario Vercel.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERCEL_BIN="$ROOT/node_modules/.bin/vercel"
if [[ ! -e "$VERCEL_BIN" ]]; then
  echo "Esegui prima: npm install"
  exit 1
fi
TMP="$(mktemp -d "${TMPDIR:-/tmp}/invoice-vercel-nogit.XXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT
rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.vercel/cache' \
  "$ROOT/" "$TMP/"
cp -R "$ROOT/.vercel" "$TMP/"
cd "$TMP"
"$VERCEL_BIN" deploy --prod --yes "$@"
