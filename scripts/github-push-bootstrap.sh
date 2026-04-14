#!/usr/bin/env bash
# Allinea origin (SSH), crea chiave Ed25519 se assente, poi push su main.
# Esegui dal Mac: bash scripts/github-push-bootstrap.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO_SSH="git@github.com:taleb85/invoice.git"
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
  echo "=== GitHub non accetta ancora questa chiave SSH ==="
  echo "    Usa l’account GitHub che possiede (o può pushare su) taleb85/invoice."
  echo ""
  if [[ "$(uname -s)" == "Darwin" ]] && command -v pbcopy >/dev/null; then
    pbcopy < "${KEY}.pub"
    echo "Chiave pubblica copiata negli appunti (una riga intera, senza spezzature)."
    command -v open >/dev/null && open "https://github.com/settings/ssh/new"
  else
    echo "Copia manualmente il file (una sola riga):"
    echo "  cat ${KEY}.pub | tr -d '\n' ; echo"
  fi
  echo ""
  echo "Su GitHub: Settings → SSH and GPG keys → New SSH key → incolla (Cmd+V) → Add."
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
