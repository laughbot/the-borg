# Borgopia

Un piccolo borgo 3D da vivere insieme: avatar, casa da arredare, chat, minigiochi e il negozio Laugh Tale Collectibles. Gira nel browser e diventerà un'app per Google Play e App Store.

## Come è fatto il progetto

Il gioco pubblicato è **un solo file**, `index.html`, ma **non si modifica a mano**: si costruisce dai sorgenti in `src/`.

```
src/
  pagina.html          modello della pagina (HTML) con i punti @@include(...)@@
  stile.css            stile dell'interfaccia
  avvio/               primi script: errori sul telefono, schermata Home, orientamento
  borgo/               il mondo: piazza, casa, avatar, interfaccia, coins, missioni, suoni...
  chat/                filtro della chat (parolacce, dati personali, modalità lenta)
  negozi/              Laugh Tale Collectibles e negozio TCG
  minigiochi/          go-kart, paintball, cripta, belinverse, borg-bubble, nascondino, comandi FPS condivisi
  online/              gioco online con gli amici
  librerie/            three.js e PeerJS (codice di terzi, non si tocca)
  dati/                immagini incollate come testo (loghi)
img/belinverse/        immagini delle carte di Belinverse (file a parte: il telefono le scarica solo quando servono)
server/                server di gioco Nakama (vedi server/README.md)
test/                  prove automatiche (node test/filtro.test.mjs, node test/nascondino.test.mjs...)
strumenti/             costruisci.mjs e scomponi.mjs
```

Il client del server (`server/client/nakama-stanza.js`) viene incluso direttamente da lì: c'è una sola copia.

## Lavorare sul gioco

Serve [Node.js](https://nodejs.org) 18 o più recente. Niente da installare.

1. Modifica i file in `src/`.
2. Ricostruisci il gioco:
   ```sh
   node strumenti/costruisci.mjs
   ```
3. Apri `index.html` nel browser e prova.
4. Fai il commit sia dei file in `src/` sia di `index.html`.

Per controllare che `index.html` corrisponda ai sorgenti (lo fa anche GitHub a ogni push):

```sh
node strumenti/costruisci.mjs --controlla
```

## Se arriva un index.html modificato fuori da qui

Se qualcuno ha lavorato su una copia intera di `index.html`, non sovrascrivere quello del progetto: scomponilo in una cartella a parte e confronta i sorgenti.

```sh
node strumenti/scomponi.mjs versione-modificata.html /tmp/confronto
diff -r src /tmp/confronto/src
```

Se `scomponi` trova blocchi `<script>` nuovi che non riconosce, li mette in `src/altro/` e lo segnala: vanno spostati nella cartella giusta e aggiunti all'elenco `BLOCCHI` in `strumenti/scomponi.mjs`.
