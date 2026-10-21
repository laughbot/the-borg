#!/usr/bin/env bash
# =====================================================================
# THE BORG: INSTALLAZIONE DEL SERVER ONLINE
# Da lanciare come root su un VPS nuovo con Ubuntu 24.04 (per esempio Hetzner).
# Di solito parte da solo alla creazione del server, dal "Cloud config"
# (vedi cloud-config.yml in questa cartella). Si puo' rilanciare senza danni:
# i segreti gia' creati restano, il resto si aggiorna.
#
# Legge /etc/the-borg/installa.conf (facoltativo):
#   CONSOLE_PASSWORD=...   password della console di amministrazione (solo lettere e numeri, almeno 12)
#   DOMINIO=...            vuoto = indirizzo automatico <ip>.sslip.io
#   RAMO=main              ramo del repository da seguire
# =====================================================================
set -euo pipefail

REPO_URL=${THEBORG_REPO:-https://github.com/laughbot/the-borg.git}
CARTELLA=${THEBORG_CARTELLA:-/opt/the-borg}
CONF=${THEBORG_CONF:-/etc/the-borg}
REGISTRO=${THEBORG_REGISTRO:-/var/log/the-borg-installa.log}

exec > >(tee -a "$REGISTRO") 2>&1
echo "=== The Borg: installazione $(date -Is) ==="

[ "$(id -u)" = 0 ] || [ -n "${THEBORG_PROVA:-}" ] || { echo "Serve root"; exit 1; }
mkdir -p "$CONF"; chmod 700 "$CONF"

CONSOLE_PASSWORD="${CONSOLE_PASSWORD:-}"; DOMINIO="${DOMINIO:-}"; RAMO="${RAMO:-main}"
# shellcheck disable=SC1091
[ -f "$CONF/installa.conf" ] && . "$CONF/installa.conf"

# --- programmi di base e Docker ---
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q git curl ca-certificates ufw openssl unattended-upgrades
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# --- codice del gioco ---
if [ -d "$CARTELLA/.git" ]; then
  git -C "$CARTELLA" fetch -q origin "$RAMO"
  git -C "$CARTELLA" checkout -q -B "$RAMO" "origin/$RAMO"
else
  git clone -q --branch "$RAMO" "$REPO_URL" "$CARTELLA"
fi
echo "$RAMO" > "$CONF/ramo"

# --- indirizzo del server ---
if [ -z "$DOMINIO" ]; then
  IP=$(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<NF;i++) if($i=="src") print $(i+1)}')
  [ -n "$IP" ] || { echo "Non trovo l'IP pubblico"; exit 1; }
  DOMINIO="${IP//./-}.sslip.io"
fi

# --- segreti (creati una volta sola, poi restano) ---
casuale() { openssl rand -hex 24; }
ENV="$CONF/.env"
leggi() { [ -f "$ENV" ] && sed -n "s/^$1=//p" "$ENV" | head -1 || true; }
VECCHIA_PW=$(leggi CONSOLE_PASSWORD)
if [ -z "$CONSOLE_PASSWORD" ]; then CONSOLE_PASSWORD="$VECCHIA_PW"; fi
if [ -z "$CONSOLE_PASSWORD" ]; then
  CONSOLE_PASSWORD=$(openssl rand -hex 8)
  echo "ATTENZIONE: nessuna CONSOLE_PASSWORD indicata, ne ho creata una: la trovi in $ENV"
fi
if ! [[ "$CONSOLE_PASSWORD" =~ ^[A-Za-z0-9]{12,}$ ]]; then
  echo "CONSOLE_PASSWORD deve avere almeno 12 caratteri, solo lettere e numeri"; exit 1
fi
umask 077
cat > "$ENV.nuovo" <<FINE
# Creato da installa.sh: NON copiarlo nel repository
DOMINIO=$DOMINIO
CONSOLE_PASSWORD=$CONSOLE_PASSWORD
DB_PASSWORD=$( v=$(leggi DB_PASSWORD); echo "${v:-$(casuale)}" )
SESSIONE_CHIAVE=$( v=$(leggi SESSIONE_CHIAVE); echo "${v:-$(casuale)}" )
SESSIONE_RINNOVO_CHIAVE=$( v=$(leggi SESSIONE_RINNOVO_CHIAVE); echo "${v:-$(casuale)}" )
RUNTIME_HTTP_KEY=$( v=$(leggi RUNTIME_HTTP_KEY); echo "${v:-$(casuale)}" )
CONSOLE_FIRMA=$( v=$(leggi CONSOLE_FIRMA); echo "${v:-$(casuale)}" )
FINE
mv "$ENV.nuovo" "$ENV"
umask 022
# la password scritta nel cloud config non serve piu' li'
[ -f "$CONF/installa.conf" ] && sed -i '/^CONSOLE_PASSWORD=/d' "$CONF/installa.conf"

# --- firewall: solo SSH e web ---
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

# --- aggiornamento automatico e backup ---
mkdir -p "${THEBORG_BACKUP:-/var/backups/the-borg}"
install -m 644 "$CARTELLA"/server/produzione/systemd/*.service "$CARTELLA"/server/produzione/systemd/*.timer "${THEBORG_SYSTEMD:-/etc/systemd/system}/"
systemctl daemon-reload
systemctl enable --now the-borg-aggiorna.timer the-borg-backup.timer

# --- avvio ---
bash "$CARTELLA/server/produzione/aggiorna.sh" --forza

echo "$DOMINIO" > "$CONF/indirizzo"
echo
echo "=== Fatto ==="
echo "Gioco:   https://$DOMINIO"
echo "Prova:   https://$DOMINIO/healthcheck"
echo "Console: https://console.$DOMINIO  (utente admin)"
