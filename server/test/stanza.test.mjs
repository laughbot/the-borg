// Prova del server: tre giocatori finti entrano nella stessa stanza amici e si vedono.
//   cd server && docker compose up -d && node test/stanza.test.mjs [host:porta]
// Usa lo stesso client del gioco (client/nakama-stanza.js).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const SERVER = process.argv[2] || '127.0.0.1:7350';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: () => { } };
const CLIENT = readFileSync(new URL('../client/nakama-stanza.js', import.meta.url), 'utf8');
new Function(CLIENT)();

// la copia dentro index.html deve essere identica al client
assert.ok(readFileSync(new URL('../../index.html', import.meta.url), 'utf8').includes(CLIENT.trimEnd()), 'index.html ha una copia diversa di client/nakama-stanza.js');
console.log('ok  index.html contiene il client aggiornato');

const aspetta = (cond, ms = 8000) => new Promise((ok, ko) => {
  const t0 = Date.now(), i = setInterval(() => { if (cond()) { clearInterval(i); ok(); } else if (Date.now() - t0 > ms) { clearInterval(i); ko(new Error('tempo scaduto')); } }, 50);
});
function giocatore(nick, codice) {
  const visti = new Map(), usciti = [];
  const r = window.B3.stanzaNakama(codice, SERVER, { dispositivo: 'test-' + nick + '-' + Date.now() });
  r.onPeers(ch => { ch.joined.concat(ch.updated).forEach(p => visti.set(p.peer, p.presence)); ch.left.forEach(p => { visti.delete(p.peer); usciti.push(p.peer); }); });
  r.presence({ v: 1, nick, x: 1, z: 2 });
  return { r, visti, usciti, nick };
}
const nickVisti = g => [...g.visti.values()].map(p => p.nick).sort();

const codice = 'prova' + Math.floor(Math.random() * 1e6);
const anna = giocatore('Anna', codice), bea = giocatore('Bea', codice), altro = giocatore('Carlo', codice + 'x');
await aspetta(() => anna.visti.size === 1 && bea.visti.size === 1);
assert.deepEqual(nickVisti(anna), ['Bea']);
assert.deepEqual(nickVisti(bea), ['Anna']);
assert.equal(anna.r.stato().matchId, bea.r.stato().matchId, 'stesso codice, stessa stanza');
console.log('ok  stesso codice: Anna e Bea si vedono nella stessa stanza');

await new Promise(r => setTimeout(r, 400));
assert.equal(altro.visti.size, 0);
assert.notEqual(altro.r.stato().matchId, anna.r.stato().matchId);
console.log('ok  codice diverso: Carlo e\' in un\'altra stanza e non vede nessuno');

// movimento e chat con accenti ed emoji arrivano agli altri
anna.r.presence({ x: 7.5, msg: { n: 1, t: 'Ciao Bea, è bello qui 😀' } });
await aspetta(() => { const p = [...bea.visti.values()][0]; return p && p.x === 7.5; });
assert.equal([...bea.visti.values()][0].msg.t, 'Ciao Bea, è bello qui 😀');
console.log('ok  posizione e chat (accenti ed emoji) arrivano');

// chi arriva dopo riceve subito tutti
const dario = giocatore('Dario', codice);
await aspetta(() => dario.visti.size === 2 && anna.visti.size === 2);
assert.deepEqual(nickVisti(dario), ['Anna', 'Bea']);
console.log('ok  chi entra dopo vede subito chi c\'e\' gia\'');

// presenza grande ma valida (casa piena di mobili, annunci, messaggi): passa
bea.r.presence({ x: 3, casa: 'm'.repeat(6000) });
await aspetta(() => anna.visti.get(bea.r.stato().mioId).x === 3);
// troppo grande: non parte, e la connessione resta su
bea.r.presence({ x: 9, casa: 'm'.repeat(9000) });
await new Promise(r => setTimeout(r, 600));
assert.equal(anna.visti.get(bea.r.stato().mioId).x, 3);
assert.equal(bea.r.stato().aperto, true);
bea.r.presence({ casa: null, x: 4 });
await aspetta(() => anna.visti.get(bea.r.stato().mioId).x === 4);
console.log('ok  presenze fino a 8 KB passano, oltre non partono e la connessione resta');

// chi esce sparisce per gli altri
const idBea = bea.r.stato().mioId;
bea.r.chiudi();
await aspetta(() => anna.usciti.includes(idBea) && dario.usciti.includes(idBea));
assert.deepEqual(nickVisti(anna), ['Dario']);
console.log('ok  chi esce sparisce per gli altri');

[anna, altro, dario].forEach(g => g.r.chiudi());
console.log('tutto ok');
setTimeout(() => process.exit(0), 200);
