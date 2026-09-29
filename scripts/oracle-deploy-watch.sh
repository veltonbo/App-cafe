#!/usr/bin/env bash
set -Eeuo pipefail
REPO_DIR="${REPO_DIR:-$HOME/fazenda2e}"
DEPLOY_REF="${DEPLOY_REF:-production}"
STATE_DIR="${STATE_DIR:-$HOME/.local/state/fazenda2e}"
LAST_FILE="$STATE_DIR/last-deployed-sha"
mkdir -p "$STATE_DIR"
cd "$REPO_DIR"
REMOTE_SHA="$(git ls-remote origin "refs/heads/$DEPLOY_REF" | awk '{print $1}' | head -1)"
[ -n "$REMOTE_SHA" ] || { echo "[Fazenda 2E] branch $DEPLOY_REF não encontrada"; exit 0; }
LAST_SHA="$(cat "$LAST_FILE" 2>/dev/null || true)"
[ "$REMOTE_SHA" != "$LAST_SHA" ] || exit 0
echo "[Fazenda 2E] novo commit $REMOTE_SHA em $DEPLOY_REF"
if ! DEPLOY_REF="$DEPLOY_REF" "$REPO_DIR/scripts/oracle-deploy.sh"; then
  echo "[Fazenda 2E] deploy não concluído; o próximo ciclo tentará novamente"
  exit 0
fi
printf '%s\n' "$REMOTE_SHA" > "$LAST_FILE.tmp"
mv "$LAST_FILE.tmp" "$LAST_FILE"
echo "[Fazenda 2E] deploy confirmado $REMOTE_SHA"
