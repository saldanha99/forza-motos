#!/usr/bin/env bash
# ── Deploy Forza Motos → VPS ─────────────────────────────────────────────────
# Uso: ./deploy.sh            (deploya o site)
#      ./deploy.sh worker     (deploya também o worker de sync)
set -euo pipefail

VPS="root@187.127.46.251"
APP_DIR="/opt/forza/app"

echo "→ Enviando código para a VPS…"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude .vercel \
  --exclude worker/node_modules --exclude .env.local --exclude .env.production \
  ./ "$VPS:$APP_DIR/"

echo "→ Build, migração de banco e subida…"
ssh "$VPS" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/forza
# .env.production dentro do contexto: next build lê NEXT_PUBLIC_* e DATABASE_URL
cp /opt/forza/app.env /opt/forza/app/.env.production

docker compose build app

# Migrações Prisma rodam a partir do estágio builder (tem o CLI do prisma)
BUILDER_IMG=$(docker build -q --target builder /opt/forza/app)
docker run --rm --network forza --env-file /opt/forza/app.env "$BUILDER_IMG" npx prisma db push

docker compose up -d app
docker compose ps app
REMOTE

if [[ "${1:-}" == "worker" ]]; then
  echo "→ Rebuild do worker…"
  ssh "$VPS" "cd /opt/forza && docker compose build worker && docker compose up -d worker"
fi

echo "✓ Deploy concluído → https://www.forzamotos.com.br"
