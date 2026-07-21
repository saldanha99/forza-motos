# Backup & Restore — PostgreSQL da VPS

Desde a saída do Neon, o Postgres da VPS é a **única fonte de dados**. Como não
há mais backup gerenciado, a rede de segurança é feita por `pg_dump` automático
com cópia **para fora da VPS**.

- `scripts/backup-db.sh` — dump + gzip + rotação (7 diários + 4 semanais) + off-site opcional
- `scripts/restore-db.sh` — restaura um dump (destrutivo)

Os scripts rodam **no host da VPS** (precisam de acesso ao `docker`) e leem o
`DATABASE_URL` de `/opt/forza/app.env`. Eles são enviados junto no deploy
(`rsync` → `/opt/forza/app/scripts/`).

---

## 1. Instalar o cron (uma vez)

Na VPS:

```bash
mkdir -p /opt/forza/backups
crontab -e
```

Adicione (backup diário às 03:30):

```cron
30 3 * * * /opt/forza/app/scripts/backup-db.sh >> /opt/forza/backups/backup.log 2>&1
```

Teste manual antes de confiar no cron:

```bash
/opt/forza/app/scripts/backup-db.sh
ls -lh /opt/forza/backups/daily
```

Sem nenhuma config extra, isso já gera backups **locais** rotacionados em
`/opt/forza/backups/`. Mas backup local não protege contra perda da VPS — siga o
passo 2.

---

## 2. Cópia off-site (fortemente recomendado)

Backup só vale se estiver **fora** da VPS. Use `rclone` (suporta Backblaze B2, S3,
Google Drive, etc. com uma config só).

### Backblaze B2 (mais barato para backup)

```bash
# instalar
curl https://rclone.org/install.sh | sudo bash

# configurar (crie um bucket + Application Key no painel da Backblaze)
rclone config
#   name> b2
#   storage> b2
#   account> <keyID>
#   key> <applicationKey>
```

Depois exponha o remote para o script. No `crontab -e`, troque a linha por:

```cron
30 3 * * * BACKUP_RCLONE_REMOTE=b2:forza-backups /opt/forza/app/scripts/backup-db.sh >> /opt/forza/backups/backup.log 2>&1
```

O script sobe cada dump para `b2:forza-backups/daily/` e poda os remotos com mais
de 8 dias. (Para S3/Wasabi/Google Drive é o mesmo — só muda o `rclone config`.)

---

## 3. Testar o restore (faça isso pelo menos uma vez!)

Backup não testado não é backup. O ideal é restaurar num banco **de teste**, não
em produção:

```bash
# sobe um postgres temporário e restaura o último dump nele
docker run -d --name pg-teste -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=forzamotos postgres:16-alpine
sleep 5
ULTIMO=$(ls -1t /opt/forza/backups/daily/*.sql.gz | head -1)
gunzip -c "$ULTIMO" | docker exec -i -e PGPASSWORD=teste pg-teste psql -U postgres -d forzamotos
docker exec -e PGPASSWORD=teste pg-teste psql -U postgres -d forzamotos -c "SELECT count(*) FROM \"Product\";"
docker rm -f pg-teste
```

Se o `count` bater com produção (~2.854 produtos), o backup está íntegro.

---

## 4. Restore de verdade (disaster recovery)

⚠️ **Destrutivo** — sobrescreve o banco atual.

```bash
# baixe o dump do off-site, se preciso:
#   rclone copy b2:forza-backups/daily/forzamotos-AAAAMMDD-HHMMSS.sql.gz /opt/forza/backups/daily/

/opt/forza/app/scripts/restore-db.sh /opt/forza/backups/daily/forzamotos-AAAAMMDD-HHMMSS.sql.gz
# digite RESTAURAR para confirmar
docker compose restart app
```

---

## Variáveis de ambiente dos scripts

| Var | Default | Para quê |
|-----|---------|----------|
| `APP_ENV_FILE` | `/opt/forza/app.env` | Onde ler o `DATABASE_URL` |
| `DB_CONTAINER` | `forza-db` | Nome do container do Postgres |
| `BACKUP_DIR` | `/opt/forza/backups` | Onde guardar os dumps |
| `RETENCAO_DIARIOS` | `7` | Diários mantidos |
| `RETENCAO_SEMANAIS` | `4` | Semanais mantidos (snapshot aos domingos) |
| `BACKUP_RCLONE_REMOTE` | *(vazio)* | Remote rclone p/ off-site (ex: `b2:forza-backups`) |
