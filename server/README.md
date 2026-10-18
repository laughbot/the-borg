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
```

## Com'è fatto

| File | Cosa fa |
|---|---|
| `nakama/modules/the-borg.js` | Modulo del server: RPC `stanza_entra` (una sola partita per codice) e partita autoritativa `stanza` (presenze, anti-spam, limite 8 KB, chiusura delle stanze vuote) |
| `nakama/local.yml` | Configurazione per il locale (le chiavi di produzione arrivano dalle variabili d'ambiente del server, mai dal repo) |
| `client/nakama-stanza.js` | Client per il gioco: accesso anonimo con id del dispositivo, websocket, riconnessione automatica. **È copiato dentro `index.html`** prima del modulo online: se lo cambi, aggiorna anche la copia (il test lo controlla) |
| `test/stanza.test.mjs` | Prova automatica con lo stesso client del gioco |

Nel gioco (`index.html`, modulo "ONLINE CON GLI AMICI") il server si sceglie così:

1. `?server=host:porta` nel link (per le prove);
2. altrimenti `B3.SERVER`, che verrà impostato all'indirizzo di produzione (es. `https://api.<dominio>`);
3. senza server si resta su PeerJS come prima.

## Prossimi passi

Il piano completo con fasi e costi è in `the-borg/lancio/PIANO-LANCIO.md` nei file del progetto. In ordine: server di prova online su Hetzner con HTTPS e deploy automatico, poi account veri e salvataggi sul server, economia autoritativa, moderazione, app negli store.
