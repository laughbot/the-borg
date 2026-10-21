# Server di gioco di The Borg (Nakama)

Il gioco online passa da un server [Nakama](https://heroiclabs.com/nakama/) con database PostgreSQL.
Per ora il server gestisce le **stanze amici**: chi apre il gioco con lo stesso `?amici=<codice>` entra nella stessa stanza sul server e vede gli altri (posizione, look, chat, emote, messaggi privati, visite in casa, minigiochi, mercatino). È lo stesso protocollo di presenza che prima viaggiava su PeerJS, ma la stanza vive sul server: niente "padrone di casa" che, uscendo, fa cadere tutti.

## Avviarlo in locale

Serve Docker.

```sh
cd server
docker compose up -d
```

- API e websocket del gioco: `127.0.0.1:7350`
- Console di amministrazione: http://127.0.0.1:7351 (admin / password, solo per il locale)

Poi apri il gioco con il server:

```
index.html?amici=prova&server=127.0.0.1:7350
```

Da un telefono nella stessa rete Wi-Fi usa l'indirizzo del computer (es. `server=192.168.1.20:7350`).

## Provarlo

```sh
node test/stanza.test.mjs          # tre giocatori finti: stanze, chat, ingressi, uscite, limiti
bash test/produzione.test.sh      # installazione e aggiornamento automatico del server online
```

## Com'è fatto

| File | Cosa fa |
|---|---|
| `nakama/modules/the-borg.js` | Modulo del server: RPC `stanza_entra` (una sola partita per codice) e partita autoritativa `stanza` (presenze, anti-spam, limite 8 KB, chiusura delle stanze vuote) |
| `nakama/local.yml` | Configurazione per il locale (le chiavi di produzione arrivano dalle variabili d'ambiente del server, mai dal repo) |
| `client/nakama-stanza.js` | Client per il gioco: accesso anonimo con id del dispositivo, websocket, riconnessione automatica. **Entra in `index.html` da qui** (lo include `strumenti/costruisci.mjs`, prima del modulo online): se lo cambi, ricostruisci il gioco con `node strumenti/costruisci.mjs` (il test controlla che `index.html` sia aggiornato) |
| `test/stanza.test.mjs` | Prova automatica con lo stesso client del gioco |

Nel gioco (`src/online/amici.js`, modulo "ONLINE CON GLI AMICI") il server si sceglie così:

1. `?server=host:porta` nel link (per le prove);
2. altrimenti `B3.SERVER`, che verrà impostato all'indirizzo di produzione (es. `https://api.<dominio>`);
3. senza server si resta su PeerJS come prima.

## Server online

La guida completa per dominio, sito del gioco e server è in `MESSA-ONLINE.md` nella cartella principale.

Tutto quello che serve è in `produzione/`: Nakama, PostgreSQL e **Caddy** che prende da solo il certificato HTTPS. Si crea dal telefono, senza comandi.

### Crearlo su Hetzner

1. Su [console.hetzner.cloud](https://console.hetzner.cloud) crea un progetto "The Borg" e poi **Aggiungi server**.
2. Posizione: Germania o Finlandia. Immagine: **Ubuntu 24.04**. Tipo: il più piccolo con processore x86 (2 vCPU, 4 GB) basta per le prove.
3. Nel riquadro **Cloud config** incolla il contenuto di `produzione/cloud-config.yml`, cambiando la password (almeno 12 caratteri, solo lettere e numeri).
4. Crea il server e copia il suo **indirizzo IPv4** (es. `1.2.3.4`).
5. Dopo circa 5 minuti apri `https://1-2-3-4.sslip.io/healthcheck` (l'IP con i trattini al posto dei punti): se vedi `{}` il server è acceso.

Indirizzi (finché non c'è il dominio vero si usa sslip.io, che trasforma l'IP in un nome con HTTPS):

- Gioco: `https://<ip-con-trattini>.sslip.io` → nel gioco `?amici=prova&server=https://<ip-con-trattini>.sslip.io`. Con il dominio vero non serve: il gioco su `https://tuodominio.it` usa da solo `https://api.tuodominio.it` (`B3.serverDelDominio`)
- Console: `https://console.<ip-con-trattini>.sslip.io` (utente `admin`, la password scelta)

### Cosa fa da solo

- **Aggiornamento automatico**: ogni 5 minuti controlla `main` su GitHub; se sono cambiati file di `server/`, scarica il codice e riavvia solo quello che serve (Nakama per i moduli, Caddy per il `Caddyfile`). Quindi: si unisce la pull request e in pochi minuti il server è aggiornato.
- **Backup** del database ogni notte in `/var/backups/the-borg` (tiene 14 giorni).
- **Firewall**: aperte solo le porte 22 (SSH), 80 e 443. Nakama e il database non sono raggiungibili da fuori.
- **Segreti** (chiavi di sessione, password del database) creati sul server in `/etc/the-borg/.env`, mai nel repository.

Quando il repository diventerà privato, il server dovrà avere una "deploy key" di sola lettura per continuare ad aggiornarsi.
Quando ci sarà il dominio vero: `DOMINIO=api.<dominio>` in `/etc/the-borg/installa.conf` e si rilancia `installa.sh`.

### File

| File | Cosa fa |
|---|---|
| `produzione/cloud-config.yml` | Da incollare su Hetzner: installa tutto alla creazione del server |
| `produzione/installa.sh` | Installa Docker, scarica il codice, crea i segreti, firewall, timer, avvia (si può rilanciare) |
| `produzione/aggiorna.sh` | Aggiornamento automatico da GitHub |
| `produzione/backup.sh` | Copia notturna del database |
| `produzione/docker-compose.yml`, `nakama.yml`, `Caddyfile` | Il server vero e proprio |
| `test/produzione.test.sh` | Prova installazione e aggiornamenti con programmi finti (gira anche nei controlli di GitHub) |

## Prossimi passi

Il piano completo è in `PIANO-THE-BORG.md` nei documenti del progetto. In ordine: collegare il gioco al server di prova (`B3.SERVER`), poi account veri e salvataggi sul server, economia autoritativa, moderazione, app negli store.
