#!/usr/bin/env bash
# ── Deploy Forza Motos → VPS ─────────────────────────────────────────────────
# Uso: ./deploy.sh            (deploya o site)
#      ./deploy.sh worker     (deploya também o worker de sync)
set -euo pipefail

VPS="root@187.127.46.251"
APP_DIR="/opt/forza/app"

echo "→ Verificando fronteira server/client e cor fixa/tema no painel admin…"
node scripts/verificar-painel.mjs

echo "→ Enviando código para a VPS…"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude .vercel \
  --exclude worker/node_modules --exclude .env.local --exclude .env.production \
  --exclude .DS_Store --exclude .claude --exclude '_backup*' \
  --exclude e2e-20260810 --exclude 'forza eventos.txt' \
  --exclude output --exclude tmp \
  --exclude tsconfig.tsbuildinfo \
  ./ "$VPS:$APP_DIR/"

echo "→ Build, migração de banco e subida…"
ssh "$VPS" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/forza
# Remove cópia legada recuperável pelo app.env e monta o arquivo como secret
# efêmero durante o build. Nenhuma credencial entra em COPY/camada de imagem.
rm -f /opt/forza/app/.env.production
BUILDER_IMG=$(DOCKER_BUILDKIT=1 docker build --no-cache -q \
  --target builder \
  --secret id=app_env,src=/opt/forza/app.env \
  /opt/forza/app)
DOCKER_BUILDKIT=1 docker build \
  --secret id=app_env,src=/opt/forza/app.env \
  --tag forza-app:latest \
  /opt/forza/app

# Antes de tocar na base real, restaura um snapshot em um banco temporário e
# aplica nele as mesmas migrations. Isso detecta incompatibilidade com os
# dados existentes sem interromper a loja nem depender de `db push`.
MIGRATION_CHECK_DB="forza_migration_check_$(date +%s)_$$"
MIGRATION_CHECK_DUMP=$(mktemp)
MIGRATION_CHECK_ENV=$(mktemp)
cleanup_migration_check() {
  docker exec forza-db dropdb -U forza_user --if-exists "$MIGRATION_CHECK_DB" >/dev/null 2>&1 || true
  rm -f "$MIGRATION_CHECK_DUMP" "$MIGRATION_CHECK_ENV"
}
trap cleanup_migration_check EXIT
case "$MIGRATION_CHECK_DB" in
  forza_migration_check_[0-9_]*) ;;
  *) echo "Nome inválido para banco temporário" >&2; exit 1 ;;
esac
docker exec forza-db createdb -U forza_user -T template0 "$MIGRATION_CHECK_DB"
docker exec forza-db pg_dump -U forza_user -d forzamotos --format=custom > "$MIGRATION_CHECK_DUMP"
test -s "$MIGRATION_CHECK_DUMP"
docker exec -i forza-db pg_restore \
  -U forza_user -d "$MIGRATION_CHECK_DB" --no-owner --no-privileges --exit-on-error \
  < "$MIGRATION_CHECK_DUMP" >/dev/null

PROD_DATABASE_URL=$(docker run --rm --env-file /opt/forza/app.env postgres:16-alpine \
  sh -c 'printf %s "$DATABASE_URL"')
case "$PROD_DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *) echo "DATABASE_URL de produção inválida" >&2; exit 1 ;;
esac
DB_URL_SEM_QUERY="${PROD_DATABASE_URL%%\?*}"
if [[ "$PROD_DATABASE_URL" == *"?"* ]]; then
  DB_URL_QUERY="?${PROD_DATABASE_URL#*\?}"
else
  DB_URL_QUERY=""
fi
MIGRATION_CHECK_URL="${DB_URL_SEM_QUERY%/*}/${MIGRATION_CHECK_DB}${DB_URL_QUERY}"
printf 'DATABASE_URL=%s\n' "$MIGRATION_CHECK_URL" > "$MIGRATION_CHECK_ENV"
chmod 600 "$MIGRATION_CHECK_ENV"
docker run --rm --network forza --env-file "$MIGRATION_CHECK_ENV" "$BUILDER_IMG" npx prisma migrate deploy
cleanup_migration_check
trap - EXIT

# Backup recuperável imediatamente antes das migrations.
mkdir -p /opt/forza/backups
BACKUP_FILE="/opt/forza/backups/forzamotos-pre-deploy-$(date +%Y%m%d-%H%M%S).dump"
docker exec forza-db pg_dump -U forza_user -d forzamotos --format=custom > "$BACKUP_FILE"
test -s "$BACKUP_FILE"

# Migrações Prisma versionadas rodam a partir do estágio builder (tem o CLI).
docker run --rm --network forza --env-file /opt/forza/app.env "$BUILDER_IMG" npx prisma migrate deploy
docker image rm "$BUILDER_IMG" >/dev/null 2>&1 || true

docker compose up -d --no-build --wait app
docker compose ps app

# Mantém os crons existentes e instala/atualiza as reconciliações do checkout,
# eventos e NF-e. O helper lê CRON_SECRET direto do app.env (permissão 700), sem
# colocar o segredo na crontab, no processo do deploy ou nos logs.
test -x /opt/forza/cron-forza.sh
CRON_ATUAL=$(mktemp)
CRON_NOVO=$(mktemp)
crontab -l 2>/dev/null > "$CRON_ATUAL" || true
grep -Fv '/api/eventos/reconciliar' "$CRON_ATUAL" \
  | grep -Fv '/api/pedidos/reconciliar' \
  | grep -Fv '/api/olist/reconciliar-nfe' \
  | grep -Fv '/api/crm/queue' > "$CRON_NOVO" || true
echo '*/5 * * * * /opt/forza/cron-forza.sh /api/pedidos/reconciliar >> /var/log/forza-pedidos-reconciliar.log 2>&1' >> "$CRON_NOVO"
echo '2-59/5 * * * * /opt/forza/cron-forza.sh /api/olist/reconciliar-nfe >> /var/log/forza-olist-nfe.log 2>&1' >> "$CRON_NOVO"
echo '*/5 * * * * /opt/forza/cron-forza.sh /api/eventos/reconciliar >> /var/log/forza-eventos-reconciliar.log 2>&1' >> "$CRON_NOVO"
echo '* * * * * /opt/forza/cron-forza.sh /api/crm/queue >> /var/log/forza-crm-queue.log 2>&1' >> "$CRON_NOVO"
crontab "$CRON_NOVO"
rm -f "$CRON_ATUAL" "$CRON_NOVO"
REMOTE

if [[ "${1:-}" == "worker" ]]; then
  echo "→ Rebuild do worker…"
  ssh "$VPS" "cd /opt/forza && docker compose build worker && docker compose up -d worker"
fi

echo "✓ Deploy concluído → https://www.forzamotos.com.br"
