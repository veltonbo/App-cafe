FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY public ./public
COPY server ./server
COPY scripts ./scripts
RUN node scripts/build-painel.mjs
ENV NODE_ENV=production
CMD ["node","server/painel/server.js"]
