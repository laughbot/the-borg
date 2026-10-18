// Ricostruisce index.html (il gioco pubblicato) dai file sorgente di src/.
//
//   node strumenti/costruisci.mjs              scrive index.html
//   node strumenti/costruisci.mjs --controlla  non scrive niente: esce con errore
//                                              se index.html non e' aggiornato
//
// Il modello e' src/pagina.html: ogni @@include(percorso)@@ viene sostituito con
// il contenuto del file indicato (percorso dalla cartella principale del progetto),
// togliendo l'ultimo "a capo" del file. Niente librerie esterne: basta Node.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODELLO = 'src/pagina.html';
const USCITA = 'index.html';

export function costruisci(radice = RADICE) {
  const modello = readFileSync(join(radice, MODELLO), 'utf8');
  const usati = [];
  const html = modello.replace(/@@include\(([^)]+)\)@@/g, (_, percorso) => {
    const file = join(radice, percorso);
    if (!existsSync(file)) throw new Error(`${MODELLO}: manca il file ${percorso}`);
    usati.push(percorso);
    const testo = readFileSync(file, 'utf8');
    return testo.endsWith('\n') ? testo.slice(0, -1) : testo;
  });
  return { html, usati };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { html, usati } = costruisci();
  const dest = join(RADICE, USCITA);
  if (process.argv.includes('--controlla')) {
    const attuale = existsSync(dest) ? readFileSync(dest, 'utf8') : '';
    if (attuale !== html) {
      console.error(`${USCITA} non corrisponde ai sorgenti: esegui "node strumenti/costruisci.mjs"`);
      process.exit(1);
    }
    console.log(`ok  ${USCITA} e' aggiornato (${usati.length} file)`);
  } else {
    writeFileSync(dest, html);
    console.log(`${USCITA} costruito da ${usati.length} file (${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB)`);
  }
}
