# ── Forza Motos — Next.js standalone p/ VPS ─────────────────────────────────
# Build:  docker build -t forza-app .
# O .env.production precisa existir no contexto (deploy.sh cuida disso):
# next build lê as NEXT_PUBLIC_* e as páginas dinâmicas usam DATABASE_URL.

FROM node:20-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# next build (SEM prisma migrate deploy — migração roda no deploy.sh)
RUN npx next build

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
CMD ["node", "server.js"]
