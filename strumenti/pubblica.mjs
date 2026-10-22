// Prepara la cartella pubblica/ con solo i file del gioco da mettere online
// (Cloudflare Pages): il gioco, le icone, il manifest e le immagini in img/
// (per esempio le carte di Belinverse, che il telefono scarica solo quando servono). Il codice sorgente,
// il server e le prove restano fuori, anche quando il repository diventa privato.
//
//   node strumenti/pubblica.mjs
//
// Su Cloudflare Pages: comando di build "node strumenti/pubblica.mjs",
// cartella di output "pubblica".

import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { costruisci } from './costruisci.mjs';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USCITA = 'pubblica';
export const FILE = ['apple-touch-icon.png', 'icona-192.png', 'icona-512.png', 'icona-maskable-512.png', 'manifest.webmanifest'];
export const CARTELLE = ['img'];

// il telefono deve sempre chiedere la pagina nuova (il gioco controlla la versione da solo);
// le icone cambiano raramente
export const INTESTAZIONI = `/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/*.png
  Cache-Control: public, max-age=86400
/img/*
  Cache-Control: public, max-age=86400
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`;

export function pubblica(radice = RADICE) {
  const dest = join(radice, USCITA);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest);
  writeFileSync(join(dest, 'index.html'), costruisci(radice).html);
  for (const f of FILE) {
    if (!existsSync(join(radice, f))) throw new Error('manca ' + f);
    cpSync(join(radice, f), join(dest, f));
  }
  for (const c of CARTELLE) {
    if (!existsSync(join(radice, c))) throw new Error('manca la cartella ' + c);
    cpSync(join(radice, c), join(dest, c), { recursive: true });
  }
  writeFileSync(join(dest, '_headers'), INTESTAZIONI);
  return dest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Gioco pronto in ' + pubblica());
}
