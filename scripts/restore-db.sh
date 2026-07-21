#!/usr/bin/env bash
# ── Restore do PostgreSQL da VPS (Forza Motos) ───────────────────────────────
# Restaura um dump gerado pelo backup-db.sh para o banco da VPS.
#
# ⚠️  DESTRUTIVO: o dump usa --clean --if-exists, então ele DROPA e recria os
#     objetos. Restaurar por cima do banco em produção SOBRESCREVE os dados.
#
# Uso (no HOST da VPS):
#   ./scripts/restore-db.sh /opt/forza/backups/daily/forzamotos-20260721-030000.sql.gz
set -euo pipefail

APP_ENV_FILE="${APP_ENV_FILE:-/opt/forza/app.env}"
DB_CONTAINER="${DB_CONTAINER:-forza-db}"

ARQ="${1:-}"
[[ -n "$ARQ" && -f "$ARQ" ]] || { echo "Uso: $0 <arquivo.sql.gz>"; exit 1; }

if [[ -z "${DATABASE_URL:-}" && -f "$APP_ENV_FILE" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$APP_ENV_FILE" | head -1 | cut -d= -f2-)"
fi
[[ -n "${DATABASE_URL:-}" ]] || { echo "DATABASE_URL não encontrada."; exit 1; }

_url="${DATABASE_URL#*://}"
_creds="${_url%%@*}"
DB_USER="${_creds%%:*}"
DB_PASS="${_creds#*:}"
_after="${_url#*@}"
DB_NAME="${_after#*/}"; DB_NAME="${DB_NAME%%\?*}"

echo "⚠️  Vou RESTAURAR '$ARQ' sobre o banco '$DB_NAME' (container $DB_CONTAINER)."
echo "    Isso SOBRESCREVE os dados atuais. Digite EXATAMENTE 'RESTAURAR' para continuar:"
read -r confirma
[[ "$confirma" == "RESTAURAR" ]] || { echo "Cancelado."; exit 1; }

echo "→ Restaurando…"
gunzip -c "$ARQ" | docker exec -i -e PGPASSWORD="$DB_PASS" "$DB_CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -h 127.0.0.1 -v ON_ERROR_STOP=1

echo "✓ Restore concluído. Reinicie o app se necessário: docker compose restart app"
