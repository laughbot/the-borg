#!/usr/bin/env bash
# =====================================================================
# THE BORG: AGGIORNAMENTO AUTOMATICO DEL SERVER
# Lo lancia ogni 5 minuti the-borg-aggiorna.timer. Se su GitHub il ramo
# seguito (di solito main) e' cambiato, scarica il codice nuovo e, se sono
# cambiati file di server/, riavvia quello che serve.
#   --forza   riavvia comunque (usato da installa.sh)
# =====================================================================
set -euo pipefail

CARTELLA=${THEBORG_CARTELLA:-/opt/the-borg}
CONF=${THEBORG_CONF:-/etc/the-borg}
RAMO=$(cat "$CONF/ramo" 2>/dev/null || echo main)
FORZA=0; [ "${1:-}" = "--forza" ] && FORZA=1
dc() { docker compose --env-file "$CONF/.env" -f "$CARTELLA/server/produzione/docker-compose.yml" "$@"; }

cd "$CARTELLA"
git fetch -q origin "$RAMO"
PRIMA=$(git rev-parse HEAD); DOPO=$(git rev-parse "origin/$RAMO")
if [ "$PRIMA" = "$DOPO" ] && [ $FORZA = 0 ]; then exit 0; fi

CAMBIATI=$(git diff --name-only "$PRIMA" "$DOPO" -- server/ || true)
git reset -q --hard "origin/$RAMO"
echo "$(date -Is) codice aggiornato a $(git rev-parse --short HEAD)"

if [ $FORZA = 0 ] && [ -z "$CAMBIATI" ]; then exit 0; fi

# se e' cambiato questo stesso sistema di aggiornamento, rimetti i file di systemd
if echo "$CAMBIATI" | grep -q '^server/produzione/systemd/'; then
  install -m 644 server/produzione/systemd/*.service server/produzione/systemd/*.timer "${THEBORG_SYSTEMD:-/etc/systemd/system}/"
  systemctl daemon-reload
fi

dc pull -q
dc up -d --remove-orphans
# i moduli e i file di configurazione sono montati: up -d non se ne accorge
if [ $FORZA = 1 ] || echo "$CAMBIATI" | grep -qE '^server/(nakama/|produzione/nakama\.yml)'; then dc restart nakama; fi
if [ $FORZA = 1 ] || echo "$CAMBIATI" | grep -q '^server/produzione/Caddyfile'; then dc restart caddy; fi
docker image prune -f >/dev/null
echo "$(date -Is) server riavviato"
