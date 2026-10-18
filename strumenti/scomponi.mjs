// Scompone un index.html "tutto in uno" nei file sorgente di src/.
//
//   node strumenti/scomponi.mjs [file.html] [cartella]
//
// Di solito non serve: i sorgenti sono gia' in src/ e index.html si ricostruisce
// con strumenti/costruisci.mjs. Serve quando arriva una versione intera di
// index.html modificata fuori da qui (per esempio dal socio): la si scompone in
// una cartella a parte e si confrontano i file con quelli di src/.
//
//   node strumenti/scomponi.mjs versione-socio.html /tmp/socio
//   diff -r src /tmp/socio/src
//
// Ogni blocco <script>/<style> finisce in un file riconosciuto dal suo contenuto
// (vedi BLOCCHI). Un blocco nuovo che non si riconosce finisce in src/altro/ con
// un avviso: va spostato a mano e aggiunto a BLOCCHI.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// [testo che si trova nelle prime righe del blocco, file di destinazione]
// L'ordine conta solo se due testi possono comparire nello stesso blocco: vince il primo.
export const BLOCCHI = [
  ['App dalla schermata Home: ricorda il codice', 'src/avvio/schermata-home.js'],
  ["BORGO LUME - STILE DELL'INTERFACCIA", 'src/stile.css'],
  ['se qualcosa si rompe sul telefono', 'src/avvio/errori-telefono.js'],
  ['Scripts "build/three.js" and "build/three.min.js" are deprecated', 'src/librerie/three.js'],
  ['BORGO LUME 3D - CONFIGURAZIONE', 'src/borgo/configurazione.js'],
  ['BORGO LUME 3D - BASE:', 'src/borgo/base.js'],
  ['BORGO LUME 3D - AVATAR CHIBI', 'src/borgo/avatar.js'],
  ['BORGO LUME 3D - FOTO:', 'src/borgo/foto-avatar.js'],
  ['THE BORG - OTTIMIZZA:', 'src/borgo/ottimizza.js'],
  ['BORGO LUME 3D - IL MONDO:', 'src/borgo/piazza.js'],
  ['BORGO LUME 3D - LA TUA CASA:', 'src/borgo/casa.js'],
  ['Logo di Laugh Tale Collectibles (data URL)', 'src/dati/logo-laughtale.js'],
  ['THE BORG 3D - LAUGH TALE COLLECTIBLES: insegna', 'src/negozi/laughtale-insegna.js'],
  ['THE BORG 3D - IL NEGOZIO TCG', 'src/negozi/negozio-tcg.js'],
  ['THE BORG 3D - LAUGH TALE COLLECTIBLES (interno)', 'src/negozi/laughtale-interno.js'],
  ['THE BORG 3D - BIBLIOTECA: pannello', 'src/borgo/biblioteca-letture.js'],
  ['THE BORG 3D - LA BIBLIOTECA (interno)', 'src/borgo/biblioteca.js'],
  ['THE BORG 3D - LA SALA GIOCHI', 'src/borgo/sala-giochi.js'],
  ['THE BORG - ORIENTAMENTO:', 'src/avvio/orientamento.js'],
  ['THE BORG - SUONI:', 'src/borgo/suoni.js'],
  ['SCENOGRAFIA DEL GO-KART', 'src/minigiochi/go-kart/scenografia.js'],
  ['IL MODELLO DEL GO-KART', 'src/minigiochi/go-kart/modello.js'],
  ['MINIGIOCO GO-KART', 'src/minigiochi/go-kart/gioco.js'],
  ['THE BORG - COMANDI FPS:', 'src/minigiochi/comandi-fps.js'],
  ['THE BORG - PAINTBALL', 'src/minigiochi/paintball/gioco.js'],
  ['LA CRIPTA DEL RE SENZA LUCE: MODELLI', 'src/minigiochi/cripta/modelli.js'],
  ['La Cripta del Re Senza Luce: ambienti scolpiti', 'src/minigiochi/cripta/ambienti.js'],
  ['La Cripta del Re Senza Luce: creature scolpite', 'src/minigiochi/cripta/creature.js'],
  ['LA CRIPTA DEL RE SENZA LUCE (DEMO)', 'src/minigiochi/cripta/gioco.js'],
  ['THE BORG - FILTRO DELLA CHAT', 'src/chat/filtro.js'],
  ['BORGO LUME 3D - LOGICA DEL GIOCO', 'src/borgo/logica.js'],
  ['THE BORG 3D - COINS, NEGOZIO DI ARREDI', 'src/borgo/coins-arredi.js'],
  ['THE BORG 3D - MOBILI INTERATTIVI', 'src/borgo/mobili-interattivi.js'],
  ['THE BORG 3D - MISSIONI', 'src/borgo/missioni.js'],
  ["THE BORG 3D - ATTIVITA' DELLA PIAZZA", 'src/borgo/attivita-piazza.js'],
  ['window.BELIN_IMG=', 'src/dati/belinverse-immagini.js'],
  ['BELINVERSE 2 (Set 001)', 'src/minigiochi/belinverse/carte.js'],
  ['BELINVERSE 2: il gioco di carte', 'src/minigiochi/belinverse/gioco.js'],
  ['BORGO LUME 3D - PROGRAMMA PRINCIPALE', 'src/borgo/programma-principale.js'],
  ['UI - interfaccia: schermata iniziale', 'src/borgo/interfaccia.js'],
  ['TUTORIAL DEL PRIMO AC', 'src/borgo/tutorial.js'],
  ['THE BORG - ZAINO:', 'src/borgo/zaino.js'],
  // il client del server vive in server/ (lo usa anche il test): niente copie
  ['STANZA AMICI SUL SERVER NAKAMA', 'server/client/nakama-stanza.js'],
  ['ONLINE CON GLI AMICI', 'src/online/amici.js'],
];

// Immagini incollate dentro l'HTML (attributo src="data:...") portate in file a parte.
const IMMAGINI_HTML = [
  ['id="logo-img"', 'src/dati/logo-schermata.txt'],
];

const DIM_INTESTAZIONE = 600;

function riconosci(corpo) {
  const testa = corpo.slice(0, DIM_INTESTAZIONE);
  for (const [segno, file] of BLOCCHI) if (testa.includes(segno)) return file;
  // la libreria di PeerJS e' minificata: si riconosce anche piu' avanti
  if (corpo.includes('peerjs') && corpo.length > 50000 && corpo.trimStart().startsWith('(()=>')) return 'src/librerie/peerjs.js';
  return null;
}

export function scomponi(html) {
  const file = new Map();          // percorso -> contenuto
  const avvisi = [];
  let modello = '';
  let pos = 0, nAltro = 0;
  const re = /<(script|style)([^>]*)>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(html))) {
    modello += html.slice(pos, m.index) + `<${m[1]}${m[2]}>`;
    const corpo = m[3];
    const testa = corpo.match(/^\s*/)[0];
    const coda = corpo.slice(testa.length).match(/\s*$/)[0];
    const centro = corpo.slice(testa.length, corpo.length - coda.length);
    let dest = riconosci(corpo);
    if (!dest) {
      dest = `src/altro/blocco-${String(++nAltro).padStart(2, '0')}.${m[1] === 'style' ? 'css' : 'js'}`;
      avvisi.push(`blocco non riconosciuto (riga ${html.slice(0, m.index).split('\n').length}) -> ${dest}`);
    }
    if (file.has(dest)) {
      avvisi.push(`due blocchi diversi riconosciuti come ${dest}: il secondo va in src/altro/`);
      dest = `src/altro/blocco-${String(++nAltro).padStart(2, '0')}.js`;
    }
    file.set(dest, centro + '\n');
    modello += testa + `@@include(${dest})@@` + coda + `</${m[1]}>`;
    pos = m.index + m[0].length;
  }
  modello += html.slice(pos);

  // immagini incollate nell'HTML
  for (const [segno, dest] of IMMAGINI_HTML) {
    const i = modello.indexOf(segno);
    if (i < 0) continue;
    const inizioTag = modello.lastIndexOf('<', i);
    const fineTag = modello.indexOf('>', i);
    const tag = modello.slice(inizioTag, fineTag + 1);
    const ms = tag.match(/src="(data:[^"]*)"/);
    if (!ms) continue;
    file.set(dest, ms[1] + '\n');
    modello = modello.slice(0, inizioTag) + tag.replace(ms[1], `@@include(${dest})@@`) + modello.slice(fineTag + 1);
  }

  file.set('src/pagina.html', modello);
  return { file, avvisi };
}

// uso da riga di comando
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const origine = resolve(process.argv[2] || join(RADICE, 'index.html'));
  const cartella = resolve(process.argv[3] || RADICE);
  const { file, avvisi } = scomponi(readFileSync(origine, 'utf8'));
  for (const [percorso, contenuto] of file) {
    const dest = join(cartella, percorso);
    mkdirSync(dirname(dest), { recursive: true });
    if (percorso.startsWith('server/') && existsSync(dest) && readFileSync(dest, 'utf8').trimEnd() !== contenuto.trimEnd())
      avvisi.push(`${percorso}: la copia nell'HTML e' diversa da quella del server, la sovrascrivo`);
    writeFileSync(dest, contenuto);
  }
  for (const a of avvisi) console.warn('ATTENZIONE: ' + a);
  console.log(`${file.size} file scritti in ${cartella}`);
}
