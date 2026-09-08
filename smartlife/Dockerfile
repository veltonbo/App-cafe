FROM node:24-bookworm-slim

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

RUN npm run build \
    && node scripts/inject-irrigacao-ui.js \
    && npm prune --omit=dev

ENV SMARTLIFE_PYTHON_BIN=/opt/smartlife/bin/python
ENV NODE_ENV=production

EXPOSE 8080

CMD ["npm","start"]
