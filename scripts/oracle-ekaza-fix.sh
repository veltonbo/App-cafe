#!/usr/bin/env bash
set -euo pipefail
cd "$HOME/fazenda2e"

echo '[1/5] Atualizando repositório...'
git fetch origin main
git checkout main
git pull --ff-only origin main

echo '[2/5] Executando deploy seguro...'
bash scripts/oracle-deploy.sh

echo '[3/5] Verificando correção dentro do container ativo...'
docker exec fazenda2e-irrigacao sh -lc "grep -q 'FAZENDA2E_NEW_EKAZA_SYNC_V2' /app/server/api/viveiro/_seconds.js"

if docker exec fazenda2e-irrigacao sh -lc "grep -q 'Atualize a programação do EKAZA antes de ativar o modo em segundos.' /app/server/api/viveiro/_seconds.js"; then
  echo 'ERRO: container ainda contém a mensagem antiga do EKAZA.' >&2
  exit 41
fi

echo '[4/5] Verificando saúde do serviço...'
curl -fsS http://127.0.0.1:8080/health >/dev/null

echo '[5/5] Resultado:'
echo 'OK - correção do novo EKAZA está ativa no container em produção.'
echo 'Agora abra o app e toque em Salvar e armar.'
