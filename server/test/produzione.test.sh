#!/usr/bin/env bash
# Prova di installa.sh e aggiorna.sh senza un VPS: docker, systemctl, ufw e apt
# sono finti (scrivono solo cosa avrebbero fatto), git e openssl sono veri.
#   bash server/test/produzione.test.sh
set -euo pipefail
RADICE=$(cd "$(dirname "$0")/../.." && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
LOG=$T/comandi.log; : > "$LOG"
ok=0; ko=0
verifica() { if eval "$2"; then ok=$((ok+1)); echo "  ok  $1"; else ko=$((ko+1)); echo "  NO  $1"; fi; }

# --- programmi finti ---
mkdir -p "$T/finti"
for p in docker systemctl ufw apt-get; do
  printf '#!/bin/sh\necho "%s $*" >> "%s"\n' "$p" "$LOG" > "$T/finti/$p"; chmod +x "$T/finti/$p"
done
printf '#!/bin/sh\necho "1.1.1.1 via 5.6.7.1 dev eth0 src 5.6.7.8 uid 0"\n' > "$T/finti/ip"; chmod +x "$T/finti/ip"
export PATH="$T/finti:$PATH"
export THEBORG_PROVA=1 THEBORG_CARTELLA=$T/opt/the-borg THEBORG_CONF=$T/etc THEBORG_REGISTRO=$T/installa.log
export THEBORG_SYSTEMD=$T/systemd THEBORG_BACKUP=$T/backup THEBORG_REPO=$T/origine
mkdir -p "$THEBORG_SYSTEMD"

# --- repository "GitHub" finto con la cartella server/ attuale ---
git init -q -b main "$T/origine"
cp -r "$RADICE/server" "$T/origine/"
echo prova > "$T/origine/README.md"
git -C "$T/origine" -c user.email=t@t -c user.name=t add -A
git -C "$T/origine" -c user.email=t@t -c user.name=t commit -qm primo
salva() { git -C "$T/origine" -c user.email=t@t -c user.name=t commit -qam "$1"; }

INST="$RADICE/server/produzione/installa.sh"
AGG="$RADICE/server/produzione/aggiorna.sh"

echo "Installazione"
mkdir -p "$THEBORG_CONF"
printf 'CONSOLE_PASSWORD=Prova12345678\nDOMINIO=1-2-3-4.sslip.io\n' > "$THEBORG_CONF/installa.conf"
bash "$INST" > "$T/out1" 2>&1 || { cat "$T/out1"; exit 1; }
ENV=$THEBORG_CONF/.env
verifica "codice scaricato" '[ -f "$THEBORG_CARTELLA/server/produzione/docker-compose.yml" ]'
verifica "sette valori in .env" '[ "$(grep -c "^[A-Z_]*=." "$ENV")" = 7 ]'
verifica "password della console" 'grep -qx "CONSOLE_PASSWORD=Prova12345678" "$ENV"'
verifica "dominio" 'grep -qx "DOMINIO=1-2-3-4.sslip.io" "$ENV"'
verifica ".env leggibile solo da root" '[ "$(stat -c %a "$ENV")" = 600 ]'
verifica "password tolta da installa.conf" '! grep -q CONSOLE_PASSWORD "$THEBORG_CONF/installa.conf"'
verifica "timer installati" '[ -f "$THEBORG_SYSTEMD/the-borg-aggiorna.timer" ] && grep -q "enable --now the-borg-aggiorna.timer the-borg-backup.timer" "$LOG"'
verifica "firewall acceso" 'grep -q "ufw --force enable" "$LOG"'
verifica "server avviato" 'grep -q "docker compose .* up -d" "$LOG" && grep -q "restart nakama" "$LOG"'
verifica "indirizzo stampato" 'grep -q "https://1-2-3-4.sslip.io" "$T/out1"'

echo "Seconda installazione: i segreti restano"
PRIMA=$(grep -v DOMINIO "$ENV")
bash "$INST" > "$T/out2" 2>&1 || { cat "$T/out2"; exit 1; }
verifica "stessi segreti" '[ "$PRIMA" = "$(grep -v DOMINIO "$ENV")" ]'

echo "Aggiornamento automatico"
: > "$LOG"; bash "$AGG"
verifica "niente di nuovo: non tocca niente" '[ ! -s "$LOG" ]'
echo altro >> "$T/origine/README.md"; salva readme
: > "$LOG"; bash "$AGG" > /dev/null
verifica "cambia solo il gioco: server non riavviato" '! grep -q docker "$LOG"'
verifica "codice comunque aggiornato" 'grep -q altro "$THEBORG_CARTELLA/README.md"'
echo "// prova" >> "$T/origine/server/nakama/modules/the-borg.js"; salva modulo
: > "$LOG"; bash "$AGG" > /dev/null
verifica "cambia il modulo: Nakama riavviato" 'grep -q "restart nakama" "$LOG"'
verifica "Caddy non riavviato" '! grep -q "restart caddy" "$LOG"'
echo "# prova" >> "$T/origine/server/produzione/Caddyfile"; salva caddy
: > "$LOG"; bash "$AGG" > /dev/null
verifica "cambia il Caddyfile: Caddy riavviato" 'grep -q "restart caddy" "$LOG" && ! grep -q "restart nakama" "$LOG"'

echo "Dominio lasciato com'era nel cloud config"
printf 'DOMINIO=api.tuodominio.it\n' > "$THEBORG_CONF/installa.conf"
bash "$INST" > /dev/null 2>&1
verifica "usa l'indirizzo automatico" 'grep -qx "DOMINIO=5-6-7-8.sslip.io" "$ENV"'

echo "Password non valida"
printf 'CONSOLE_PASSWORD=corta\n' > "$THEBORG_CONF/installa.conf"
verifica "installazione rifiutata" '! bash "$INST" > /dev/null 2>&1'

echo; echo "$ok ok, $ko no"
[ $ko = 0 ]
