# JM Equipment Parts Store — production container. See LAUNCH.md for the
# full go-live runbook and environment variable reference.
#
# Gated build (default — safe, noindex):
#   docker build -t jme-parts-store .
# LAUNCH build (indexable; the flag is read at build time):
#   docker build -t jme-parts-store --build-arg JME_LAUNCH=live .
# Run:
#   docker run -p 3000:3000 \
#     -e OPS_TOKEN=<strong-secret> \
#     -e SMTP_HOST=... -e SMTP_USER=... -e SMTP_PASS=... \
#     -e RFQ_NOTIFY_TO=parts@jmequipment.net \
#     -v jme-rfq-data:/app/.data \
#     jme-parts-store
#
# The /app/.data volume holds the RFQ inbox and audit log (customer PII) —
# persist and back it up. All env vars are optional except OPS_TOKEN, without
# which the /ops desk is disabled in production.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ARG JME_LAUNCH=""
ENV JME_LAUNCH=$JME_LAUNCH NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S jme && adduser -S jme -G jme && mkdir .data && chown jme:jme .data
COPY --from=build --chown=jme:jme /app/.next/standalone ./
COPY --from=build --chown=jme:jme /app/.next/static ./.next/static
COPY --from=build --chown=jme:jme /app/public ./public
USER jme
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
