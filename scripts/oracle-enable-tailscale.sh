#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-$HOME/fazenda2e}"
APP_PORT="${APP_PORT:-8080}"
HOSTNAME="${TAILSCALE_HOSTNAME:-fazenda2e}"
HTTPS_MARKER="${HTTPS_MARKER:-$HOME/.fazenda2e-https-enabled}"

say(){ printf '\n[Fazenda 2E Tailscale] %s\n' "$*"; }
fail(){ say "ERRO: $*"; exit 1; }

command -v curl >/dev/null || fail "curl não encontrado"
command -v sudo >/dev/null || fail "sudo não encontrado"
[ -d "$REPO_DIR/.git" ] || fail "repositório não encontrado em $REPO_DIR"

cd "$REPO_DIR"
say "Atualizando arquivos..."
git fetch origin main
git checkout main
git pull --ff-only origin main

if ! command -v tailscale >/dev/null 2>&1; then
  say "Instalando Tailscale..."
  tmp="$(mktemp)"
  curl -fsSL https://tailscale.com/install.sh -o "$tmp"
  sudo sh "$tmp"
  rm -f "$tmp"
fi

say "Conectando esta VM ao Tailscale..."
say "Se aparecer um link, abra no celular e conclua o login."
sudo tailscale up --hostname="$HOSTNAME"

say "Ativando HTTPS público pelo Tailscale Funnel..."
say "Se aparecer uma tela de autorização do Funnel, aprove e volte ao terminal."
sudo tailscale funnel --bg --yes "$APP_PORT"

DNS_NAME="$(tailscale status --json | python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("Self",{}).get("DNSName") or "").rstrip("."))')"
[ -n "$DNS_NAME" ] || fail "não foi possível descobrir o endereço HTTPS do Tailscale"
URL="https://${DNS_NAME}/irrigacao/"
HEALTH="https://${DNS_NAME}/health"

say "Validando HTTPS..."
ok=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 "$HEALTH" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
[ "$ok" -eq 1 ] || fail "o Funnel foi criado, mas o endereço HTTPS ainda não respondeu"

say "HTTPS validado. Desativando o Caddy antigo..."
docker rm -f fazenda2e-caddy >/dev/null 2>&1 || true

touch "$HTTPS_MARKER"

say "Concluído."
say "Acesso seguro: $URL"
say "O Tailscale inicia automaticamente com a VM e o Funnel permanece configurado."
say "Depois de confirmar o acesso, remova a regra pública da porta 8080 na Oracle Cloud."
