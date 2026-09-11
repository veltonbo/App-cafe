#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-$HOME/fazenda2e}"
HOSTNAME="${FAZENDA2E_HTTPS_HOST:-146-235-48-178.sslip.io}"
CADDY_NAME="fazenda2e-caddy"
CADDY_IMAGE="caddy:2-alpine"
CADDY_DATA="${CADDY_DATA:-$HOME/fazenda2e-caddy-data}"
CADDY_CONFIG="${CADDY_CONFIG:-$HOME/fazenda2e-caddy-config}"
HTTPS_MARKER="${HTTPS_MARKER:-$HOME/.fazenda2e-https-enabled}"
CADDYFILE="$REPO_DIR/deploy/Caddyfile"

say(){ printf '\n[Fazenda 2E HTTPS] %s\n' "$*"; }
fail(){ say "ERRO: $*"; exit 1; }

command -v git >/dev/null || fail "git não encontrado"
command -v docker >/dev/null || fail "docker não encontrado"
command -v curl >/dev/null || fail "curl não encontrado"
[ -d "$REPO_DIR/.git" ] || fail "repositório não encontrado em $REPO_DIR"

cd "$REPO_DIR"
say "Atualizando arquivos..."
git fetch origin main
git checkout main
git pull --ff-only origin main
[ -f "$CADDYFILE" ] || fail "Caddyfile não encontrado"

mkdir -p "$CADDY_DATA" "$CADDY_CONFIG"

say "Baixando Caddy..."
docker pull "$CADDY_IMAGE" >/dev/null

docker rm -f "$CADDY_NAME" >/dev/null 2>&1 || true

say "Iniciando HTTPS em $HOSTNAME..."
docker run -d \
  --name "$CADDY_NAME" \
  --restart unless-stopped \
  --network host \
  -v "$CADDYFILE:/etc/caddy/Caddyfile:ro" \
  -v "$CADDY_DATA:/data" \
  -v "$CADDY_CONFIG:/config" \
  "$CADDY_IMAGE" >/dev/null

say "Aguardando certificado HTTPS..."
ok=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 5 "https://${HOSTNAME}/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  say "HTTPS ainda não respondeu. O aplicativo atual foi mantido sem alteração."
  say "Verifique se as portas TCP 80 e 443 estão liberadas na Security List/NSG da Oracle Cloud."
  docker logs --tail 80 "$CADDY_NAME" || true
  exit 2
fi

say "HTTPS validado. Protegendo a porta interna 8080..."
touch "$HTTPS_MARKER"

if ! bash "$REPO_DIR/scripts/oracle-deploy.sh"; then
  rm -f "$HTTPS_MARKER"
  fail "HTTPS foi criado, mas o redeploy protegido falhou. O rollback do app foi preservado."
fi

say "Validando acesso final..."
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 "https://${HOSTNAME}/health" >/dev/null 2>&1; then
    say "Concluído. Acesso seguro: https://${HOSTNAME}/irrigacao/"
    say "A porta 8080 do aplicativo agora fica somente no localhost da VM."
    exit 0
  fi
  sleep 2
done

fail "O certificado foi emitido, mas a validação final falhou. Consulte os logs do Caddy."
