#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="fazenda2e-irrigacao"
REPO_DIR="${REPO_DIR:-$HOME/fazenda2e}"
ENV_FILE="${ENV_FILE:-$HOME/fazenda2e-irrigacao.env}"
DATA_DIR="${DATA_DIR:-$HOME/fazenda2e-data}"
DOCKERFILE="${DOCKERFILE:-smartlife/Dockerfile}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
PUBLIC_PORT="${PUBLIC_PORT:-8080}"
TEST_PORT="${TEST_PORT:-18080}"
HTTPS_MARKER="${HTTPS_MARKER:-$HOME/.fazenda2e-https-enabled}"
STAMP="$(date +%Y%m%d-%H%M%S)"
IMAGE="fazenda2e-irrigacao:${STAMP}"
CANDIDATE="${APP_NAME}-candidate-${STAMP}"
BACKUP="${APP_NAME}-backup-${STAMP}"

say(){ printf '\n[Fazenda 2E] %s\n' "$*"; }
fail(){ say "ERRO: $*"; exit 1; }

command -v git >/dev/null || fail "git não encontrado"
command -v docker >/dev/null || fail "docker não encontrado"
command -v curl >/dev/null || fail "curl não encontrado"
[ -d "$REPO_DIR/.git" ] || fail "repositório não encontrado em $REPO_DIR"
[ -f "$ENV_FILE" ] || fail "arquivo de ambiente não encontrado em $ENV_FILE"
mkdir -p "$DATA_DIR"

if [ -f "$HTTPS_MARKER" ]; then
  BIND_ADDR="127.0.0.1"
else
  BIND_ADDR="0.0.0.0"
fi

cd "$REPO_DIR"
say "Atualizando código..."
git fetch origin main
git checkout main
git pull --ff-only origin main

say "Construindo e testando nova imagem..."
docker build -t "$IMAGE" -f "$DOCKERFILE" .

cleanup_candidate(){ docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true; }
trap cleanup_candidate EXIT

say "Subindo versão candidata na porta local $TEST_PORT..."
docker run -d --name "$CANDIDATE" --restart no --env-file "$ENV_FILE" \
  -e FAZENDA2E_DATA_DIR=/data -v "$DATA_DIR:/data" \
  -p "127.0.0.1:${TEST_PORT}:8080" "$IMAGE" >/dev/null

say "Validando saúde da nova versão..."
ok=0
for _ in $(seq 1 40); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${TEST_PORT}${HEALTH_PATH}" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ "$ok" -eq 1 ] || { docker logs --tail 120 "$CANDIDATE" || true; fail "nova versão não passou no health check; versão atual foi preservada"; }

say "Nova versão aprovada. Fazendo troca segura..."
if docker ps -a --format '{{.Names}}' | grep -qx "$APP_NAME"; then
  docker stop "$APP_NAME" >/dev/null || true
  docker rename "$APP_NAME" "$BACKUP"
fi

docker rm -f "$CANDIDATE" >/dev/null 2>&1 || true
trap - EXIT

if ! docker run -d --name "$APP_NAME" --restart unless-stopped --env-file "$ENV_FILE" \
  -e FAZENDA2E_DATA_DIR=/data -v "$DATA_DIR:/data" \
  -p "${BIND_ADDR}:${PUBLIC_PORT}:8080" "$IMAGE" >/dev/null; then
  say "Falha ao iniciar nova versão. Restaurando anterior..."
  docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
  if docker ps -a --format '{{.Names}}' | grep -qx "$BACKUP"; then docker rename "$BACKUP" "$APP_NAME"; docker start "$APP_NAME" >/dev/null; fi
  fail "rollback executado"
fi

ok=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${PUBLIC_PORT}${HEALTH_PATH}" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
if [ "$ok" -ne 1 ]; then
  say "Health check final falhou. Restaurando versão anterior..."
  docker logs --tail 120 "$APP_NAME" || true
  docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
  if docker ps -a --format '{{.Names}}' | grep -qx "$BACKUP"; then docker rename "$BACKUP" "$APP_NAME"; docker start "$APP_NAME" >/dev/null; fi
  fail "rollback executado"
fi

say "Deploy concluído com sucesso."
docker ps --filter "name=^/${APP_NAME}$"
if [ "$BIND_ADDR" = "127.0.0.1" ]; then say "Backend protegido: porta $PUBLIC_PORT acessível apenas localmente; acesso público deve usar HTTPS."; fi
if docker ps -a --format '{{.Names}}' | grep -qx "$BACKUP"; then say "Backup mantido para rollback: $BACKUP"; fi
say "Dados locais persistentes: $DATA_DIR"
