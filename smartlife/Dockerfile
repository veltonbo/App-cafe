FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY smartlife/requirements.txt /tmp/smartlife-requirements.txt
RUN python3 -m venv /opt/smartlife \
    && /opt/smartlife/bin/pip install --disable-pip-version-check --no-cache-dir -r /tmp/smartlife-requirements.txt

COPY . .

# Testes básicos ficam separados das transformações para que qualquer falha
# apareça com clareza no log do deploy.
RUN (npm audit --json > /tmp/npm-audit.json || true) \
    && node scripts/audit-summary.mjs /tmp/npm-audit.json \
    && npm test \
    && /opt/smartlife/bin/python -m py_compile \
       smartlife/bridge.py \
       smartlife/controller_shadow.py \
       smartlife/safety_watchdog.py \
       smartlife/controller_engine.py

# Patches do controlador/runtime.
RUN node scripts/patch-local-history-runtime.mjs \
    && node scripts/patch-auto4-runtime.mjs \
    && node scripts/patch-irrigation-runtime-v3.mjs \
    && node scripts/patch-viveiro-realtime.mjs \
    && node scripts/patch-climate-isolation.mjs \
    && node scripts/patch-system-consistency.mjs \
    && node scripts/patch-python-safety-watchdog.mjs \
    && node scripts/patch-python-primary-engine.mjs \
    && node scripts/patch-new-ekaza-cycle.mjs \
    && node scripts/patch-automatic-stability-v3.mjs \
    && node scripts/patch-runtime-sync-v5.mjs

# Verificações do runtime antes de compilar a interface.
RUN grep -q 'FAZENDA2E_NEW_EKAZA_SYNC_V2' server/api/viveiro/_seconds.js \
    && ! grep -q 'Atualize a programação do EKAZA antes de ativar o modo em segundos.' server/api/viveiro/_seconds.js \
    && grep -q 'FAZENDA2E_AUTOMATIC_STABILITY_V3' server/api/viveiro/_climate.js \
    && grep -q 'FAZENDA2E_RUNTIME_SYNC_V5' server/continuous/seconds-manager.js

RUN npm run build

# Patches da interface de produção.
RUN node scripts/inject-irrigacao-ui.js \
    && node scripts/patch-smartlife-reauth-ui.mjs \
    && node scripts/patch-secure-session-ui.mjs \
    && node scripts/patch-smartlife-reauth-runtime.mjs \
    && node scripts/patch-professional-dashboard-v4.mjs \
    && node scripts/patch-executive-v5.mjs \
    && node scripts/patch-ui-v6-final.mjs \
    && node scripts/patch-ekaza-selector-ui.mjs \
    && node scripts/patch-notifications-ui.mjs \
    && node scripts/patch-runtime-sync-v5.mjs \
    && node scripts/patch-ui-consistency-v7.mjs

# Verificações da interface de produção.
RUN grep -q 'FAZENDA2E_UI_V6_20260912' dist/irrigacao/index.html \
    && grep -q 'FAZENDA2E_UI_V6_20260912' dist/irrigacao/app.css \
    && grep -q 'FAZENDA2E_EKAZA_SELECTOR_V1' dist/irrigacao/index.html \
    && grep -q 'FAZENDA2E_EKAZA_SELECTOR_V1' dist/irrigacao/app.js \
    && grep -q 'FAZENDA2E_NOTIFICATIONS_V1' dist/irrigacao/index.html \
    && grep -q 'FAZENDA2E_NOTIFICATIONS_V1' dist/irrigacao/app.js \
    && grep -q 'FAZENDA2E_UI_SYNC_V5' dist/irrigacao/app.js \
    && grep -q 'FAZENDA2E_UI_CONSISTENCY_V7' dist/irrigacao/app.js \
    && grep -q "addEventListener('push'" dist/irrigacao/sw.js

RUN npm prune --omit=dev

# A interface React continua no repositório para evolução e testes, mas não faz
# parte do caminho crítico do controlador. Uma falha no preview não pode impedir
# a publicação de correções do viveiro em produção.

ENV SMARTLIFE_PYTHON_BIN=/opt/smartlife/bin/python
ENV NODE_ENV=production
ENV MALLOC_ARENA_MAX=2
ENV MALLOC_TRIM_THRESHOLD_=131072
ENV MALLOC_MMAP_THRESHOLD_=131072

EXPOSE 8080

CMD ["npm","start"]
