# syntax=docker/dockerfile:1.7
# ── Forza Motos — Next.js standalone p/ VPS ─────────────────────────────────
# Build:  docker build -t forza-app .
# O app.env é montado como secret só no RUN do build. Ele nunca entra no
# contexto, no filesystem da imagem ou em uma camada do Docker.

FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# next build (SEM prisma migrate deploy — migração roda no deploy.sh)
RUN --mount=type=secret,id=app_env,target=/app/.env.production,required=true npx next build

# ── Runtime enxuto ───────────────────────────────────────────────────────────
FROM node:20-slim AS runner
RUN apt-get update -y && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
