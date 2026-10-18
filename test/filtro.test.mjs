// Prova del filtro della chat (src/chat/filtro.js).
//   node test/filtro.test.mjs
// Se aggiungi parole agli elenchi, aggiungi qui anche un esempio: cosi' si vede
// subito se una parola nuova blocca per sbaglio frasi normali.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx = {};
vm.runInNewContext(readFileSync(new URL('../src/chat/filtro.js', import.meta.url), 'utf8'), ctx);
const F = ctx.FiltroChat;
let n = 0;
const passa = (t, atteso) => { const r = F.controlla(t); assert.ok(r.ok, `doveva passare: "${t}" (${r.livello})`); if (atteso !== undefined) assert.equal(r.testo, atteso, `"${t}"`); n++; };
const coperto = t => { const r = F.controlla(t); assert.ok(r.ok && r.livello === 'lieve' && r.testo.includes('*'), `doveva coprire: "${t}" -> ${JSON.stringify(r)}`); n++; return r.testo; };
const grave = t => { const r = F.controlla(t); assert.ok(!r.ok && r.livello === 'grave', `doveva bloccare (grave): "${t}" -> ${JSON.stringify(r)}`); n++; };
const privato = t => { const r = F.controlla(t); assert.ok(!r.ok && r.livello === 'privato', `doveva bloccare (dati personali): "${t}" -> ${JSON.stringify(r)}`); n++; };

// frasi normali: devono passare senza modifiche
[
  'Ciao a tutti!', 'Ci vediamo in piazza alle 5', 'Vado via tra 5 minuti', 'Chi gioca a scopa?', 'Che figata questo borgo',
  'Ho fatto 12500 punti a paintball', 'Ti ammazzo a paintball ahah', 'Sono eccitato per il torneo', 'Il torneo e il 25/10 alle 15',
  'Andiamo al corso di Belinverse?', 'Ho comprato un mazzo da Laugh Tale', 'www.laughtalecollectibles.it ha le bustine nuove',
  'Il calcolo era sbagliato', 'Ho preso tre zoccoli nel negozio', 'Bel mazzo! 2v2 a paintball?', 'Vieni alla fontana', 'Pacifica e tranquilla la piazza',
  'Gioco a Montenegro', 'Ci sono 3 giri nella gara di kart', 'Ok, va bene.', 'Penelope è online', 'Domani alle 21:30 si gioca', 'Torneo il 12/10/2026 14:30', 'Giochi a tiktok?', 'Ho 14 anni', 'Ho visto un video su youtube',
].forEach(t => passa(t, t));

// correzioni anti-spam
passa('ciaoooooooooo', 'ciaooo');
passa('CIAO A TUTTI COME STATE', 'Ciao a tutti come state');
passa('   ciao    a   tutti  ', 'ciao a tutti');

// parolacce: si coprono, il messaggio parte
assert.equal(coperto('che cazzo fai'), 'che ***** fai');
coperto('sei uno stronzo'); coperto('STRONZAAAA'); coperto('m3rd4'); coperto('c a z z o'); coperto('c.a.z.z.o'); coperto('vaffanculo');
coperto('porco dio'); coperto('diocane'); coperto('seiuncoglione'); coperto('fuck you'); coperto('Che cazzata');

// gravi: il messaggio non parte
grave('sei un negro'); grave('frocio'); grave('kys'); grave('vai a suicidati'); grave('guarda un porno'); grave('facciamo sesso');
grave('mandami nudes'); grave('heil hitler'); grave('ti stupro'); grave('pompino');

// dati personali: il messaggio non parte
privato('il mio numero è 333 123 4567'); privato('3331234567'); privato('+39 333 1234567'); privato('scrivimi a mario.rossi@gmail.com');
privato('mario chiocciola gmail punto com'); privato('vai su https://sito-strano.ru'); privato('entra in discord.gg/abc'); privato('www.esempio.com');
privato('abito in via Roma 12'); privato('piazza Garibaldi, 3'); privato('aggiungimi su insta'); privato('il mio snap è luca_2009');
privato('tiktok @luca.rossi'); privato('dove abiti?'); privato('mandami una foto'); privato('ci vediamo dal vivo?'); privato('che scuola fai');
privato('dammi il numero'); privato('ci sentiamo su whatsapp'); privato('ci vediamo in via Garibaldi 7');

// messaggi ricevuti dagli altri
assert.equal(F.ricevuto('che cazzo'), 'che *****');
assert.equal(F.ricevuto('3331234567'), null);
assert.equal(F.ricevuto('frocio'), null);
assert.equal(F.ricevuto('ciao'), 'ciao');
n += 4;

// nickname
['Luffy99', 'Zoro_3', 'Penelope', 'Montenegro', 'Cazzaniga', 'Scopa_Pro', 'Calcolo', 'Figaro'].forEach(x => { assert.ok(F.nickOk(x), 'nick buono: ' + x); n++; });
['Cazzone99', 'Merdoso', 'Stronzo_1', 'xXfrocioXx', 'PornoStar', 'Culo', 'DioCane', 'Fuck_you'].forEach(x => { assert.ok(!F.nickOk(x), 'nick da bloccare: ' + x); n++; });

// modalita' lenta
{
  const L = F.creaLimitatore();
  let t = 0;
  const invia = (testo, dopo) => { t += dopo; const no = L.prova(testo, t); if (!no) L.registra(testo, t); return no; };
  assert.equal(invia('uno', 1000), null);
  assert.match(invia('due', 100), /un messaggio alla volta/);
  assert.equal(invia('due', 1000), null);
  assert.match(invia('uno', 1000), /già scritto/);
  assert.equal(invia('tre', 1000), null);
  assert.equal(invia('quattro', 1000), null);
  assert.equal(invia('cinque', 1000), null);
  assert.match(invia('sei', 1000), /modalità lenta/i);
  assert.match(invia('sei', 2000), /aspetta \d+ secondi/);
  assert.equal(invia('sei', 9000), null);
  n += 10;
}

console.log(`ok  filtro della chat: ${n} controlli`);
