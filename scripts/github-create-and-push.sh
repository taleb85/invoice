#!/usr/bin/env bash
# Crea il repository su GitHub (account del token) e fa push di main.
# Uso una tantum:
#   export GITHUB_TOKEN=ghp_xxxx          # PAT: scope "repo"
#   export GITHUB_REPO=invoice            # opzionale, default: invoice
#   export GITHUB_PRIVATE=true            # opzionale, default: true
#   ./scripts/github-create-and-push.sh
#
# Poi rimuovi il token dalla shell: unset GITHUB_TOKEN

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO_NAME="${GITHUB_REPO:-invoice}"
PRIVATE="${GITHUB_PRIVATE:-true}"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Manca GITHUB_TOKEN. Crea un PAT su GitHub (Settings → Developer settings) con scope \"repo\", poi:"
  echo "  export GITHUB_TOKEN=ghp_..."
  echo "  ./scripts/github-create-and-push.sh"
  exit 1
fi

OWNER="$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" https://api.github.com/user | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);console.log(j.login||'')}catch{console.log('')}})")"
if [[ -z "$OWNER" ]]; then
  echo "Token non valido o API GitHub non ha restituito il login."
  exit 1
fi

echo "Account GitHub: $OWNER — repository: $REPO_NAME"

CREATE_CODE="$(curl -sS -o /tmp/gh-create-repo.json -w "%{http_code}" -X POST \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"${REPO_NAME}\",\"private\":${PRIVATE}}")"

if [[ "$CREATE_CODE" == "201" ]]; then
  echo "Repository creato."
elif [[ "$CREATE_CODE" == "422" ]]; then
  echo "Repository già esistente (422), proseguo con il push."
else
  echo "Creazione repo: HTTP $CREATE_CODE"
  cat /tmp/gh-create-repo.json 2>/dev/null || true
  if [[ "$CREATE_CODE" != "422" ]]; then
    exit 1
  fi
fi

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/${OWNER}/${REPO_NAME}.git"

echo "Push su main…"
git push -u "https://${OWNER}:${GITHUB_TOKEN}@github.com/${OWNER}/${REPO_NAME}.git" main

git remote set-url origin "https://github.com/${OWNER}/${REPO_NAME}.git"
echo "Completato. Remote origin (senza token nel config):"
git remote -v
