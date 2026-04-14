#!/usr/bin/env bash
# Allinea origin (SSH), crea chiave Ed25519 se assente, poi push su main.
# Esegui dal Mac: bash scripts/github-push-bootstrap.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO_SSH="git@github.com:talebbarikhan/invoice.git"
git remote set-url origin "$REPO_SSH"
echo "origin → $REPO_SSH"

KEY="$HOME/.ssh/id_ed25519"
if [[ ! -f "$KEY" ]]; then
  echo "Creo $KEY (passphrase vuota; cambiala dopo con: ssh-keygen -p -f $KEY)"
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  ssh-keygen -t ed25519 -f "$KEY" -N "" -C "invoice-repo-$(hostname -s 2>/dev/null || echo mac)"
fi

eval "$(ssh-agent -s)" >/dev/null
ssh-add "$KEY" 2>/dev/null || true

SSH_OUT=$(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1) || true
if echo "$SSH_OUT" | grep -qi 'successfully authenticated'; then
  :
elif echo "$SSH_OUT" | grep -qi 'Permission denied'; then
  echo ""
  echo "=== Aggiungi questa chiave pubblica su GitHub ==="
  echo "    https://github.com/settings/ssh/new"
  echo ""
  cat "${KEY}.pub"
  echo ""
  echo "Poi rilancia: bash scripts/github-push-bootstrap.sh"
  exit 1
else
  echo "$SSH_OUT"
  echo "SSH verso GitHub: esito imprevisto. Controlla la connessione e riprova."
  exit 1
fi

echo "Push main…"
git push origin main
echo "OK."
