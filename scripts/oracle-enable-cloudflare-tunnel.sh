#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${REPO_DIR:-$HOME/fazenda2e}"
APP_NAME="fazenda2e-irrigacao"
TUNNEL_NAME="fazenda2e-cloudflared"
TUNNEL_IMAGE="cloudflare/cloudflared:latest"
TOKEN_FILE="${CLOUDFLARE_TUNNEL_TOKEN_FILE:-$HOME/.fazenda2e-cloudflare-tunnel-token}"
HOST_FILE="${CLOUDFLARE_TUNNEL_HOST_FILE:-$HOME/.fazenda2e-cloudflare-tunnel-host}"
HTTPS_MARKER="${HTTPS_MARKER:-$HOME/.fazenda2e-https-enabled}"

say(){ printf '\n[Fazenda 2E Tunnel] %s\n' "$*"; }
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

# Refuse Quick Tunnels for this app. They are temporary and do not support SSE,
# which is used by Fazenda 2E for live updates.
if [ ! -s "$TOKEN_FILE" ]; then
  say "Falta apenas conectar o túnel permanente da Cloudflare."
  say "No painel Cloudflare Zero Trust, crie um Tunnel chamado Fazenda2E,"
  say "publique um hostname apontando para http://localhost:8080 e copie o Tunnel Token."
  printf 'Cole o Tunnel Token aqui (ele não aparecerá na tela): '
  IFS= read -r -s TOKEN
  printf '\n'
  [ -n "$TOKEN" ] || fail "token não informado"
  umask 077
  printf '%s' "$TOKEN" > "$TOKEN_FILE"
  unset TOKEN
fi
chmod 600 "$TOKEN_FILE"

if [ ! -s "$HOST_FILE" ]; then
  printf 'Digite somente o hostname público configurado na Cloudflare (ex.: irrigacao.seudominio.com): '
  IFS= read -r HOST
  HOST="${HOST#https://}"
  HOST="${HOST%%/*}"
  [ -n "$HOST" ] || fail "hostname não informado"
  umask 077
  printf '%s' "$HOST" > "$HOST_FILE"
fi
HOST="$(tr -d '\r\n ' < "$HOST_FILE")"
[ -n "$HOST" ] || fail "hostname inválido"

say "Validando backend local..."
curl -fsS --max-time 5 http://127.0.0.1:8080/health >/dev/null || fail "backend não respondeu em localhost:8080"

say "Baixando conector Cloudflare..."
docker pull "$TUNNEL_IMAGE" >/dev/null

docker rm -f "$TUNNEL_NAME" >/dev/null 2>&1 || true

say "Iniciando túnel permanente..."
docker run -d \
  --name "$TUNNEL_NAME" \
  --restart unless-stopped \
  --network host \
  -e TUNNEL_TOKEN="$(cat "$TOKEN_FILE")" \
  "$TUNNEL_IMAGE" tunnel --no-autoupdate run >/dev/null

say "Aguardando HTTPS público..."
ok=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 6 "https://${HOST}/health" >/dev/null 2>&1; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  say "O túnel iniciou, mas o hostname ainda não respondeu."
  say "O aplicativo atual foi mantido sem alteração."
  docker logs --tail 50 "$TUNNEL_NAME" || true
  exit 2
fi

say "HTTPS pela Cloudflare validado. Protegendo a porta 8080..."
touch "$HTTPS_MARKER"

if ! bash "$REPO_DIR/scripts/oracle-deploy.sh"; then
  rm -f "$HTTPS_MARKER"
  fail "redeploy protegido falhou; o rollback do aplicativo foi preservado"
fi

say "Validando acesso final..."
if ! curl -fsS --max-time 8 "https://${HOST}/health" >/dev/null; then
  fail "o túnel estava funcionando, mas a validação final falhou"
fi

# Caddy is no longer required after the tunnel is proven healthy.
docker rm -f fazenda2e-caddy >/dev/null 2>&1 || true

say "Concluído."
say "Acesso seguro: https://${HOST}/irrigacao/"
say "A porta 8080 agora fica somente no localhost da VM."
say "O túnel usa conexão de saída; portas públicas 80 e 443 não são necessárias para ele."
