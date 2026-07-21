#!/usr/bin/env bash
# ── Backup do PostgreSQL da VPS (Forza Motos) ────────────────────────────────
# Faz pg_dump do banco, comprime, rotaciona (7 diários + 4 semanais) e envia
# uma cópia pra fora da VPS (opcional, via rclone).
#
# Roda no HOST da VPS (precisa de acesso ao docker). Instale no cron:
#   30 3 * * * /opt/forza/app/scripts/backup-db.sh >> /opt/forza/backups/backup.log 2>&1
#
# Config por variável de ambiente (todas têm default sensato):
#   APP_ENV_FILE   caminho do app.env com DATABASE_URL   (default /opt/forza/app.env)
#   DB_CONTAINER   nome do container do Postgres          (default forza-db)
#   BACKUP_DIR     onde guardar os dumps                  (default /opt/forza/backups)
#   RETENCAO_DIARIOS   quantos backups diários manter     (default 7)
#   RETENCAO_SEMANAIS  quantos semanais manter            (default 4)
#   BACKUP_RCLONE_REMOTE  remote rclone p/ cópia off-site (ex: b2:forza-backups). Vazio = só local.
set -euo pipefail

APP_ENV_FILE="${APP_ENV_FILE:-/opt/forza/app.env}"
DB_CONTAINER="${DB_CONTAINER:-forza-db}"
BACKUP_DIR="${BACKUP_DIR:-/opt/forza/backups}"
RETENCAO_DIARIOS="${RETENCAO_DIARIOS:-7}"
RETENCAO_SEMANAIS="${RETENCAO_SEMANAIS:-4}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
erro() { log "ERRO: $*" >&2; exit 1; }

# ── DATABASE_URL: do ambiente ou do app.env ──────────────────────────────────
if [[ -z "${DATABASE_URL:-}" && -f "$APP_ENV_FILE" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$APP_ENV_FILE" | head -1 | cut -d= -f2-)"
fi
[[ -n "${DATABASE_URL:-}" ]] || erro "DATABASE_URL não encontrada (nem no ambiente nem em $APP_ENV_FILE)"

# ── Extrai usuário / senha / banco da URL postgres ───────────────────────────
# formato: postgresql://user:pass@host:port/dbname?params
_url="${DATABASE_URL#*://}"
_creds="${_url%%@*}"
DB_USER="${_creds%%:*}"
DB_PASS="${_creds#*:}"
_after="${_url#*@}"
DB_NAME="${_after#*/}"; DB_NAME="${DB_NAME%%\?*}"
[[ -n "$DB_USER" && -n "$DB_NAME" ]] || erro "Não consegui extrair usuário/banco da DATABASE_URL"

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || erro "Container '$DB_CONTAINER' não encontrado (ajuste DB_CONTAINER)"

# ── Dump ─────────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/daily/${DB_NAME}-${STAMP}.sql.gz"
TMP="${OUT}.parcial"

log "Iniciando dump de '$DB_NAME' (container $DB_CONTAINER)…"
if ! docker exec -e PGPASSWORD="$DB_PASS" "$DB_CONTAINER" \
      pg_dump -U "$DB_USER" -d "$DB_NAME" -h 127.0.0.1 --no-owner --clean --if-exists \
      | gzip > "$TMP"; then
  rm -f "$TMP"
  erro "pg_dump falhou — backup NÃO gerado"
fi

# Sanidade: dump vazio/minúsculo indica falha silenciosa
TAM=$(stat -c%s "$TMP" 2>/dev/null || stat -f%z "$TMP")
[[ "$TAM" -gt 1000 ]] || { rm -f "$TMP"; erro "Dump gerado tem só ${TAM}B — abortando (provável falha)"; }
mv "$TMP" "$OUT"
log "Backup OK: $OUT ($(( TAM / 1024 )) KB)"

# ── Snapshot semanal (aos domingos) ──────────────────────────────────────────
if [[ "$(date +%u)" == "7" ]]; then
  cp "$OUT" "$BACKUP_DIR/weekly/${DB_NAME}-${STAMP}.sql.gz"
  log "Snapshot semanal criado."
fi

# ── Rotação local ────────────────────────────────────────────────────────────
prune() { # $1=pasta  $2=quantos manter
  local dir="$1" manter="$2"
  ls -1t "$dir"/*.sql.gz 2>/dev/null | tail -n +"$(( manter + 1 ))" | while read -r f; do
    rm -f "$f"; log "Removido antigo: $(basename "$f")"
  done
}
prune "$BACKUP_DIR/daily" "$RETENCAO_DIARIOS"
prune "$BACKUP_DIR/weekly" "$RETENCAO_SEMANAIS"

# ── Cópia off-site (opcional) ────────────────────────────────────────────────
if [[ -n "$BACKUP_RCLONE_REMOTE" ]]; then
  if command -v rclone >/dev/null 2>&1; then
    log "Enviando para $BACKUP_RCLONE_REMOTE …"
    rclone copy "$OUT" "$BACKUP_RCLONE_REMOTE/daily/" && log "Off-site OK."
    # Poda remota: apaga diários com mais de (retenção+1) dias
    rclone delete --min-age "$(( RETENCAO_DIARIOS + 1 ))d" "$BACKUP_RCLONE_REMOTE/daily/" 2>/dev/null || true
  else
    log "AVISO: BACKUP_RCLONE_REMOTE setado mas rclone não instalado — só backup local."
  fi
else
  log "Sem cópia off-site (BACKUP_RCLONE_REMOTE vazio). Recomendado configurar."
fi

log "Concluído."
