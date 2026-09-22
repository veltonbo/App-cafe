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

# O runtime atual já contém as correções consolidadas. Os scripts patch-*
# permanecem no repositório apenas como histórico/migração e não são
# reaplicados durante um build limpo. Reaplicá-los torna o build dependente
# de marcadores de versões antigas e pode sobrescrever código mais novo.

# Verificações estruturais do runtime consolidado.
# Não dependem de marcadores de patches históricos.
RUN node --check server/api/viveiro/_seconds.js \
    && node --check server/api/viveiro/_climate4.js \
    && node --check server/continuous/seconds-manager.js \
    && node --check server/continuous/seconds-handler.js \
    && grep -q 'enforceViveiroInterlocks' server/continuous/server.js \
    && grep -q 'runViveiroWeatherCheck' server/continuous/server.js

RUN npm run build

# Frontend consolidado é a fonte canônica da irrigação.
# Copiamos diretamente a versão revisada, sem reaplicar a cadeia histórica de patches.
RUN npm --prefix irrigacao-react ci --silent \
    && npm --prefix irrigacao-react run build \
    && rm -rf dist/irrigacao \
    && mkdir -p dist/irrigacao \
    && cp -a irrigacao-react/dist/. dist/irrigacao/ \
    && grep -q '/irrigacao/' dist/irrigacao/index.html \
    && grep -q 'fazenda2e-react-final-v4' dist/irrigacao/sw.js


RUN npm prune --omit=dev

# A interface React continua no repositório para evolução e testes, mas não faz
# parte do caminho crítico do controlador. Uma falha no preview não pode impedir
# a publicação de correções do viveiro em produção.

ENV SMARTLIFE_PYTHON_BIN=/opt/smartlife/bin/python
ENV NODE_ENV=production
ENV PORT=8080
ENV MALLOC_ARENA_MAX=2
ENV MALLOC_TRIM_THRESHOLD_=131072
ENV MALLOC_MMAP_THRESHOLD_=131072

EXPOSE 8080

CMD ["npm","start"]
