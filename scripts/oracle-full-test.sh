#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-fazenda2e-irrigacao}"
REPO_DIR="${REPO_DIR:-$HOME/fazenda2e}"
DOCKERFILE="${DOCKERFILE:-smartlife/Dockerfile}"
STAMP="$(date +%Y%m%d-%H%M%S)"
IMAGE="fazenda2e-selftest:${STAMP}"
FAIL=0

ok(){ printf '✅ %s\n' "$*"; }
warn(){ printf '⚠️  %s\n' "$*"; }
bad(){ printf '❌ %s\n' "$*"; FAIL=1; }
section(){ printf '\n=== %s ===\n' "$*"; }

cd "$REPO_DIR"

section "Código"
git fetch origin main >/dev/null 2>&1 || bad "git fetch falhou"
git checkout main >/dev/null 2>&1 || bad "checkout main falhou"
git pull --ff-only origin main >/dev/null 2>&1 && ok "Código atualizado" || bad "git pull falhou"

section "Container atual"
if docker ps --format '{{.Names}}' | grep -qx "$APP_NAME"; then
  ok "Container $APP_NAME está rodando"
else
  bad "Container $APP_NAME não está rodando"
fi

RESTART="$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$APP_NAME" 2>/dev/null || true)"
[ "$RESTART" = "unless-stopped" ] && ok "Restart policy: unless-stopped" || warn "Restart policy: ${RESTART:-indisponível}"

section "Saúde local"
if curl -fsS --max-time 4 http://127.0.0.1:8080/health >/tmp/f2e-health.json 2>/dev/null; then
  ok "Health local respondeu"
  cat /tmp/f2e-health.json; echo
else
  bad "Health local não respondeu"
fi

section "Frontend HTTPS"
if curl -fsSI --max-time 10 https://fazenda2e.tail890201.ts.net/irrigacao/ >/tmp/f2e-head.txt 2>/dev/null; then
  ok "Frontend HTTPS/Tailscale respondeu"
else
  warn "Frontend HTTPS/Tailscale não respondeu a partir da própria VM"
fi

section "Proteção de API"
CODE="$(curl -sS -o /tmp/f2e-unauth.txt -w '%{http_code}' --max-time 5 http://127.0.0.1:8080/api/viveiro/dashboard || true)"
if [ "$CODE" = "401" ] || [ "$CODE" = "403" ]; then
  ok "Dashboard rejeita acesso sem autenticação ($CODE)"
else
  warn "Dashboard sem autenticação retornou HTTP ${CODE:-?}"
fi

section "Sintaxe no container"
docker exec "$APP_NAME" node --check /app/server/continuous/server.js >/dev/null 2>&1 && ok "server.js válido" || bad "server.js inválido"
docker exec "$APP_NAME" node --check /app/server/continuous/seconds-manager.js >/dev/null 2>&1 && ok "seconds-manager.js válido" || bad "seconds-manager.js inválido"
docker exec "$APP_NAME" node --check /app/server/continuous/python-engine.js >/dev/null 2>&1 && ok "python-engine.js válido" || bad "python-engine.js inválido"
docker exec "$APP_NAME" /opt/smartlife/bin/python -m py_compile /app/smartlife/controller_engine.py /app/smartlife/controller_shadow.py /app/smartlife/bridge.py >/dev/null 2>&1 && ok "Python crítico compila" || bad "Python crítico não compila"

section "Arquivos críticos"
for f in /app/dist/irrigacao/index.html /app/dist/irrigacao/app.js /app/dist/irrigacao/app.css /app/server/continuous/python-engine.js /app/smartlife/controller_engine.py; do
  docker exec "$APP_NAME" test -f "$f" && ok "$f" || bad "Ausente: $f"
done
if docker exec "$APP_NAME" grep -q 'smartLifeReconnectPanel' /app/dist/irrigacao/index.html 2>/dev/null; then
  ok "Painel de reconexão Smart Life presente"
else
  warn "Painel de reconexão Smart Life ainda não está na imagem em execução"
fi

section "Memória"
MEM="$(docker stats --no-stream --format '{{.MemUsage}}' "$APP_NAME" 2>/dev/null || true)"
[ -n "$MEM" ] && printf 'ℹ️  Uso de memória: %s\n' "$MEM" || warn "Não foi possível ler memória"

section "Logs recentes"
LOGS="$(docker logs --since 15m "$APP_NAME" 2>&1 || true)"
if printf '%s' "$LOGS" | grep -qi 'sign invalid'; then
  bad "Smart Life continua com erro: sign invalid"
else
  ok "Sem 'sign invalid' nos últimos 15 minutos"
fi
if printf '%s' "$LOGS" | grep -Eqi 'uncaught|unhandled|fatal|out of memory|heap out of memory'; then
  bad "Há erro fatal/uncaught nos logs recentes"
else
  ok "Sem erro fatal/uncaught nos últimos 15 minutos"
fi

section "Build completo sem iniciar segundo controlador"
if docker build -t "$IMAGE" -f "$DOCKERFILE" .; then
  ok "Build Docker completo passou (inclui npm test, Python compile e patches)"
else
  bad "Build Docker completo falhou"
fi

docker image rm "$IMAGE" >/dev/null 2>&1 || true

section "Resultado"
if [ "$FAIL" -eq 0 ]; then
  echo "✅ TESTE COMPLETO: APROVADO nos testes não destrutivos."
  exit 0
else
  echo "❌ TESTE COMPLETO: há falhas para corrigir."
  exit 1
fi
