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

RUN (npm audit --json > /tmp/npm-audit.json || true) \
    && node scripts/audit-summary.mjs /tmp/npm-audit.json \
    && npm test \
    && /opt/smartlife/bin/python -m py_compile smartlife/bridge.py smartlife/controller_shadow.py smartlife/safety_watchdog.py smartlife/controller_engine.py \
    && node scripts/patch-local-history-runtime.mjs \
    && node scripts/patch-irrigation-runtime-v3.mjs \
    && node scripts/patch-viveiro-realtime.mjs \
    && node scripts/patch-climate-isolation.mjs \
    && node scripts/patch-system-consistency.mjs \
    && node scripts/patch-python-safety-watchdog.mjs \
    && node scripts/patch-python-primary-engine.mjs \
    && npm run build \
    && node scripts/inject-irrigacao-ui.js \
    && node scripts/patch-smartlife-reauth-ui.mjs \
    && node scripts/patch-secure-session-ui.mjs \
    && node scripts/patch-smartlife-reauth-runtime.mjs \
    && npm prune --omit=dev

ENV SMARTLIFE_PYTHON_BIN=/opt/smartlife/bin/python
ENV NODE_ENV=production
# Keep glibc from retaining hundreds of MB in the native heap on long-running ARM64 workloads.
ENV MALLOC_ARENA_MAX=2
ENV MALLOC_TRIM_THRESHOLD_=131072
ENV MALLOC_MMAP_THRESHOLD_=131072

EXPOSE 8080

CMD ["npm","start"]
