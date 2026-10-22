# The Borg — Messa online (dominio, sito e server)

*21 ottobre 2026. Tutto si fa dal telefono. I nomi dei menu di Cloudflare e Hetzner possono cambiare un po' nel tempo: se non trovi una voce, chiedi in chat.*

## Come sarà

| Indirizzo | Cosa c'è | Dove sta |
|---|---|---|
| `https://tuodominio.it` (e `www.`) | La home di presentazione (cartella `sito/`) | Cloudflare Pages (gratis) |
| `https://tuodominio.it/gioca/` | Il gioco | Cloudflare Pages |
| `https://api.tuodominio.it` | Server online: stanze amici, poi account e salvataggi | VPS Hetzner (pochi euro al mese) |
| `https://console.api.tuodominio.it` | Console di amministrazione del server | stesso VPS |

Il gioco aperto dal dominio si collega da solo a `api.` del suo dominio: non serve cambiare il codice quando si sceglie il nome. Il link con `?amici=codice` passa dal server; il vecchio link di GitHub resta com'è (PeerJS).

Cloudflare pubblica il gioco da `main` a ogni pull request unita; il server si aggiorna da solo entro 5 minuti quando cambia `server/`.

## Prima: unire la pull request

Su GitHub unisci la PR del server (#45). L'installazione del server scarica i file da `main`.

## 1. Dominio (Cloudflare)

1. Crea un account su **dash.cloudflare.com**.
2. Cerca il nome nella sezione di registrazione domini (*Domain Registration → Register Domains*). Prima controlla che il nome non sia un marchio di altri.
3. Compralo (serve la carta). Se il nome con l'estensione che vuoi (per esempio `.it`) non è disponibile su Cloudflare, compralo da un registrar italiano e poi aggiungilo a Cloudflare con *Add a domain* (piano Free), cambiando i "nameserver" presso il registrar con quelli che ti indica Cloudflare.

## 2. Sito del gioco (Cloudflare Pages)

1. In Cloudflare: *Workers & Pages → Create → Pages → Connect to Git*.
2. Collega GitHub e scegli il repository `laughbot/the-borg`.
3. Impostazioni di build:
   - ramo: `main`
   - comando di build: `node strumenti/pubblica.mjs`
   - cartella di output: `pubblica`
4. *Save and Deploy*. Dopo un minuto il gioco è su un indirizzo `….pages.dev`.
5. Nel progetto: *Custom domains → Set up a custom domain*: aggiungi `tuodominio.it`, poi anche `www.tuodominio.it`.

## 3. Server (Hetzner)

1. Crea un account su **console.hetzner.cloud** e un progetto "The Borg".
2. *Aggiungi server*: posizione Germania o Finlandia, immagine **Ubuntu 24.04**, il tipo x86 più piccolo.
3. Nel riquadro **Cloud config** incolla il testo di `server/produzione/cloud-config.yml` e cambia:
   - `CONSOLE_PASSWORD`: almeno 12 caratteri, solo lettere e numeri (tienila da parte);
   - `DOMINIO`: `api.` più il tuo dominio, per esempio `api.theborg.it`.
4. Crea il server e copia il suo **indirizzo IPv4**.

## 4. Collegare il dominio al server (DNS su Cloudflare)

Nel dominio su Cloudflare: *DNS → Records → Add record*, due volte:

| Tipo | Nome | Indirizzo | Proxy |
|---|---|---|---|
| A | `api` | l'IPv4 del server | **disattivato** (nuvola grigia, "DNS only") |
| A | `console.api` | l'IPv4 del server | **disattivato** |

La nuvola grigia serve perché il certificato HTTPS lo prende il server stesso.

## 5. Prova

1. Dopo 5–10 minuti apri `https://api.tuodominio.it/healthcheck`: se vedi `{}` il server è acceso.
2. Apri `https://tuodominio.it/?amici=prova` su due telefoni: dovete vedervi nella stessa piazza.
3. Console: `https://console.api.tuodominio.it`, utente `admin` e la password scelta.

Se qualcosa non va, scrivi in chat cosa vedi (anche uno screenshot).

## Dopo

- **Repository privato**: quando il sito su Cloudflare funziona, si può rendere privato `laughbot/the-borg`. Prima dillo in chat: il server ha bisogno di una chiave di sola lettura ("deploy key") per continuare ad aggiornarsi.
- **App negli store**: useranno lo stesso server.
- **Pagine legali** (privacy, termini) sul dominio: servono per gli store e per l'accesso con Google e Apple.
