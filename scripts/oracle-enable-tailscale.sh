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

say "Validando backend local..."
for _ in $(seq 1 20); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${APP_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS --max-time 3 "http://127.0.0.1:${APP_PORT}/health" >/dev/null 2>&1 || fail "o backend local não respondeu na porta ${APP_PORT}"

say "Confirmando Funnel..."
FUNNEL_STATUS="$(sudo tailscale funnel status 2>/dev/null || true)"
printf '%s\n' "$FUNNEL_STATUS" | grep -q "127.0.0.1:${APP_PORT}" || fail "o Funnel não está apontando para o backend local"

say "Protegendo o backend para acesso somente local..."
touch "$HTTPS_MARKER"
if ! bash "$REPO_DIR/scripts/oracle-deploy.sh"; then
  rm -f "$HTTPS_MARKER"
  fail "o redeploy protegido falhou; o backend anterior foi preservado"
fi

say "Desativando o Caddy antigo..."
docker rm -f fazenda2e-caddy >/dev/null 2>&1 || true

say "Concluído."
say "Acesso seguro: $URL"
say "O Tailscale inicia automaticamente com a VM e o Funnel permanece configurado."
say "Agora a porta 8080 do aplicativo fica somente no localhost da VM."
say "Você pode remover a regra pública da porta 8080 na Oracle Cloud."
