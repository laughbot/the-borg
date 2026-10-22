#!/usr/bin/env bash
# THE BORG: copia del database ogni notte (the-borg-backup.timer), tiene le ultime 14.
set -euo pipefail
CONF=/etc/the-borg
DEST=/var/backups/the-borg
mkdir -p "$DEST"
docker compose --env-file "$CONF/.env" -f /opt/the-borg/server/produzione/docker-compose.yml \
  exec -T postgres pg_dump -U postgres nakama | gzip > "$DEST/nakama-$(date +%F).sql.gz"
find "$DEST" -name 'nakama-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup fatto"
