// Prepara la cartella pubblica/ con solo i file da mettere online (Cloudflare Pages):
//   /         la home di presentazione (cartella sito/)
//   /gioca/   il gioco, le icone, il manifest e le immagini in img/
//             (per esempio le carte di Belinverse, che il telefono scarica solo quando servono)
// Il codice sorgente, il server e le prove restano fuori, anche quando il repository diventa privato.
// Su GitHub Pages invece resta tutto com'era: il gioco e' index.html nella cartella principale.
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
export const HOME = 'sito';
export const GIOCO = 'gioca';

// il telefono deve sempre chiedere le pagine nuove (il gioco controlla la versione da solo);
// immagini, icone e font cambiano raramente
export const INTESTAZIONI = `/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/gioca/
  Cache-Control: no-cache
/gioca/index.html
  Cache-Control: no-cache
/img/*
  Cache-Control: public, max-age=86400
/font/*
  Cache-Control: public, max-age=604800
/gioca/*.png
  Cache-Control: public, max-age=86400
/gioca/img/*
  Cache-Control: public, max-age=86400
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`;

export function pubblica(radice = RADICE) {
  const dest = join(radice, USCITA);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest);
  // la home
  if (!existsSync(join(radice, HOME, 'index.html'))) throw new Error('manca ' + HOME + '/index.html');
  cpSync(join(radice, HOME), dest, { recursive: true });
  // il gioco
  const gioco = join(dest, GIOCO);
  mkdirSync(gioco);
  writeFileSync(join(gioco, 'index.html'), costruisci(radice).html);
  for (const f of FILE) {
    if (!existsSync(join(radice, f))) throw new Error('manca ' + f);
    cpSync(join(radice, f), join(gioco, f));
  }
  for (const c of CARTELLE) {
    if (!existsSync(join(radice, c))) throw new Error('manca la cartella ' + c);
    cpSync(join(radice, c), join(gioco, c), { recursive: true });
  }
  writeFileSync(join(dest, '_headers'), INTESTAZIONI);
  return dest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('Sito pronto in ' + pubblica() + ' (home in /, gioco in /' + GIOCO + '/)');
}
