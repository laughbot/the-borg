// Prove delle regole del Fronte della Cometa (src/minigiochi/fronte/regole.js).
//   node test/fronte.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx = { window: {}, Math, JSON, console, Uint8Array, Float32Array, Int32Array, WeakMap, Infinity };
vm.runInNewContext(readFileSync(new URL('../src/minigiochi/fronte/regole.js', import.meta.url), 'utf8'), ctx);
const F = ctx.window.B3.FronteRegole;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.equal(JSON.stringify(a), JSON.stringify(b), m); n++; };

// --- armi e danni ---
for (const [id, a] of Object.entries(F.ARMI)) {
  ok(a.cap > 0 && a.cd > 0 && a.tRic > 0, id + ': caricatore, cadenza e ricarica');
  ok(F.danno(id, 1, false) >= F.danno(id, 500, false), id + ': da lontano non fa piu\' danno');
  ok(F.danno(id, 5, true) > F.danno(id, 5, false), id + ': la testa fa piu\' danno');
  ok(F.danno(id, 5, false, 3) > F.danno(id, 5, false, 0), id + ': leggendaria piu\' forte di comune');
}
ok(F.danno('aquila', 40, false) >= F.VITA, 'il fucile di precisione elimina con un colpo al corpo');
ok(F.danno('falco', 10, false) * 4 >= F.VITA && F.danno('falco', 10, false) * 3 < F.VITA, 'il Falco elimina con 4 colpi da vicino');
ok(F.danno('bufera', 3, false) * F.ARMI.bufera.pallini >= F.VITA, 'la pompa da vicino elimina con un colpo pieno');
eq(F.danno('bufera', 30, false), 0, 'la pompa da lontano non fa niente');
eq(F.danno('niente', 3, false), 0);
F.CLASSI.forEach(c => c.armi.forEach(a => ok(F.ARMI[a], c.nome + ': arma ' + a + ' esiste')));

// --- serie di eliminazioni ---
eq(F.serieNuove(2, 3).map(s => s.id), ['gufo']);
eq(F.serieNuove(4, 8).map(s => s.id), ['pioggia', 'cometa']);
eq(F.serieNuove(8, 9).length, 0);

// --- Scontro a squadre ---
eq(F.limiteScontro(4), 24);
eq(F.esitoScontro([24, 10], 24, 100), 0); eq(F.esitoScontro([3, 24], 24, 100), 1);
eq(F.esitoScontro([5, 5], 24, 0), -1); eq(F.esitoScontro([6, 5], 24, 0), 0); eq(F.esitoScontro([6, 5], 24, 10), null);

// --- Dominio ---
{
  const l = { own: -1, cap: -1, k: 0 };
  let presa = -1; for (let i = 0; i < 200 && presa < 0; i++) presa = F.aggLampione(l, [1, 0], 0.05);
  eq(presa, 0, 'un soldato da solo accende il lampione'); eq(l.own, 0);
  const t1 = (() => { const q = { own: -1, cap: -1, k: 0 }; let i = 0; while (F.aggLampione(q, [1, 0], 0.05) < 0) i++; return i; })();
  const t3 = (() => { const q = { own: -1, cap: -1, k: 0 }; let i = 0; while (F.aggLampione(q, [3, 0], 0.05) < 0) i++; return i; })();
  ok(t3 < t1, 'in tre si accende prima'); ok(t3 >= t1 / 2 - 1, 'ma al massimo il doppio piu\' veloce');
  const c = { own: 0, cap: -1, k: 0 }; for (let i = 0; i < 400; i++) F.aggLampione(c, [2, 2], 0.05); eq(c.own, 0, 'conteso: non cambia');
  const d = { own: 0, cap: -1, k: 0 }; let p2 = -1; for (let i = 0; i < 400 && p2 < 0; i++) p2 = F.aggLampione(d, [0, 1], 0.05); eq(d.own, 1, 'gli avversari lo prendono');
  eq(F.puntiDominio([{ own: 0 }, { own: 0 }, { own: 1 }]), [2, 1]);
  eq(F.esitoDominio([200, 150], 100), 0); eq(F.esitoDominio([99.6, 99.2], 0), -1, "a pari punti interi e\x27 pareggio"); eq(F.esitoDominio([10, 9], 50), null);
}

// --- Il Sigillo ---
eq([0, 1, 2, 3, 4, 5, 6].map(F.attaccaNelRound), [0, 0, 0, 1, 1, 1, 0]);
eq(F.esitoSigillo({ attVivi: 2, difVivi: 2, piazzato: true, esploso: true, tempo: 0 }), 'att');
eq(F.esitoSigillo({ attVivi: 2, difVivi: 2, piazzato: true, spento: true, tempo: 0 }), 'dif');
eq(F.esitoSigillo({ attVivi: 0, difVivi: 2, piazzato: false, tempo: 20 }), 'dif');
eq(F.esitoSigillo({ attVivi: 0, difVivi: 2, piazzato: true, tempo: 20 }), null, 'piazzato e attaccanti fuori: si aspetta la miccia');
eq(F.esitoSigillo({ attVivi: 2, difVivi: 0, piazzato: false, tempo: 20 }), 'att');
eq(F.esitoSigillo({ attVivi: 2, difVivi: 2, piazzato: false, tempo: 0 }), 'dif');
eq(F.esitoSigillo({ attVivi: 2, difVivi: 2, piazzato: true, tempo: 0 }), null, 'col sigillo piazzato il tempo del round non conta');
eq(F.fineSigillo([4, 2]), 0); eq(F.fineSigillo([3, 3]), null);

// --- mappe delle squadre ---
for (const id of F.ELENCO_MAPPE) {
  const mp = F.MAPPE[id], L = F.strutture(mp), g = F.griglia(mp, 1, 0.5);
  ok(L.length > 20, id + ': abbastanza strutture');
  // simmetrica: ogni struttura ha la sua gemella ribaltata
  L.forEach(s => ok(L.some(q => q.tipo === s.tipo && Math.abs(q.x + s.x) < 1e-6 && Math.abs(q.z + s.z) < 1e-6), id + ': ' + s.tipo + ' ha la gemella'));
  for (const team of [0, 1]) {
    const r = F.rinascite(mp, team); ok(r.length >= 6, id + ': almeno 6 punti di rinascita per la squadra ' + team);
    r.forEach(p => ok(team ? p.x > 0 : p.x < 0, id + ': si nasce dal proprio lato'));
  }
  const a = F.rinascite(mp, 0)[0], b = F.rinascite(mp, 1)[0];
  const via = F.percorso(g, a, b); ok(via && via.length > 1, id + ': si va da una base all\'altra');
  via.forEach(p => ok(F.liberoIn(L, mp.AX, mp.AZ, p.x, p.z, 0.3), id + ': il percorso non entra nei muri'));
  mp.lampioni.forEach((l, i) => ok(F.percorso(g, a, { x: l.x + 1.5, z: l.z }), id + ': lampione ' + i + ' raggiungibile'));
  mp.siti.forEach(s => { ok(F.liberoIn(L, mp.AX, mp.AZ, s.x, s.z, 0.6), id + ': sito ' + s.id + ' libero'); ok(F.percorso(g, a, s), id + ': sito ' + s.id + ' raggiungibile'); ok(s.x > 0, id + ': i siti sono dal lato di chi difende'); });
  // il lampione centrale e' alla stessa distanza dalle due basi
  const m = mp.lampioni[1]; ok(Math.abs(Math.hypot(m.x - a.x, m.z - a.z) - Math.hypot(m.x - b.x, m.z - b.z)) < 6, id + ': il lampione centrale e\' giusto per tutti');
}

// --- colpi ---
{
  const muro = [{ t: 'b', x: 5, z: 0, w: 1, d: 4, h: 2, x0: 4.5, x1: 5.5, z0: -2, z1: 2 }];
  const o = { x: 0, y: 1.4, z: 0 }, verso = F.direzione(Math.PI / 2, 0);   // guarda verso +x
  ok(Math.abs(F.ostacolo(muro, o, verso, 50) - 4.5) < 1e-6, 'il muro e\' a 4,5 metri');
  eq(F.ostacolo(muro, { x: 0, y: 2.5, z: 0 }, verso, 50), 50, 'sopra il muro si passa');
  const nemico = { x: 8, y: 0, z: 0, alt: 1.8 }, scoperto = { x: 3, y: 0, z: 0, alt: 1.8 };
  eq(F.colpo(muro, o, verso, 50, [nemico]).chi, null, 'dietro il muro non si colpisce');
  eq(F.colpo(muro, o, verso, 50, [nemico, scoperto]).chi, scoperto, 'si colpisce quello scoperto');
  ok(F.colpo([], { x: 0, y: 1.6, z: 0 }, verso, 50, [nemico]).testa, 'all\'altezza degli occhi si prende la testa');
  ok(!F.colpo([], { x: 0, y: 0.9, z: 0 }, verso, 50, [nemico]).testa, 'piu\' in basso si prende il corpo');
  eq(F.colpo([], { x: 0, y: 1.6, z: 0 }, verso, 50, [{ x: 8, y: 0, z: 0, alt: 0.6 }]).chi, null, 'chi e\' a terra non si prende in piedi dritti');
  const botte = [{ t: 'c', x: 4, z: 0, r: 0.5, h: 1.1, x0: 3.5, x1: 4.5, z0: -0.5, z1: 0.5 }];
  ok(F.ostacolo(botte, { x: 0, y: 0.8, z: 0 }, verso, 50) < 4, 'la botte ferma i colpi bassi');
  eq(F.ostacolo(botte, { x: 0, y: 1.4, z: 0 }, verso, 50), 50, 'sopra la botte si spara');
  ok(F.ostacolo(botte, { x: 4, y: 3, z: 0 }, { x: 0, y: -1, z: 0 }, 10) <= 1.91, 'dall\'alto si colpisce il coperchio');
  ok(F.vista(muro, { x: 0, y: 2.5, z: 0 }, { x: 8, y: 2.5, z: 0 }) && !F.vista(muro, { x: 0, y: 1.4, z: 0 }, { x: 8, y: 1.4, z: 0 }), 'vista sopra e dietro il muro');
}

// --- Ultima Luce ---
{
  const v1 = F.mappaUltima(4242), v2 = F.mappaUltima(4242), v3 = F.mappaUltima(7);
  eq(v1.lista.map(s => [s.tipo, s.x, s.z]), v2.lista.map(s => [s.tipo, s.x, s.z]), 'stesso seme, stessa valle');
  ok(JSON.stringify(v1.lista.map(s => s.x)) !== JSON.stringify(v3.lista.map(s => s.x)), 'seme diverso, valle diversa');
  ok(v1.villaggi.length >= 5, 'almeno 5 villaggi (sono ' + v1.villaggi.length + ')');
  ok(v1.lista.filter(s => s.tipo === 'casa' || s.tipo === 'torre').length >= 20, 'abbastanza case');
  for (let i = 0; i < v1.lista.length; i++) for (let j = i + 1; j < v1.lista.length; j++) {
    const a = v1.lista[i], b = v1.lista[j];
    ok(a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0 || (a.t === 'c' && b.t === 'c' && Math.hypot(a.x - b.x, a.z - b.z) >= a.r + b.r), 'strutture ' + i + ' e ' + j + ' non si sovrappongono');
  }
  const bot = F.bottinoUltima(v1); ok(bot.length >= 60, 'abbastanza bottino (' + bot.length + ')');
  bot.forEach(o => ok(F.liberoIn(v1.lista, v1.AX, v1.AZ, o.x, o.z, 0.5), 'bottino ' + o.id + ' raggiungibile'));
  ok(bot.some(o => o.tipo === 'arma' && o.rar === 3), 'c\'e\' almeno un\'arma leggendaria');
  eq(F.bottinoUltima(v1), F.bottinoUltima(v2), 'stesso seme, stesso bottino');
  const p = F.partenzeUltima(v1, 16); eq(p.length, 16, '16 punti di partenza');
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) ok(Math.hypot(p[i].x - p[j].x, p[i].z - p[j].z) > 13, 'partenze lontane tra loro');
  const C = F.cerchiZona(v1); eq(C.length, F.ULTIMA.fasi.length + 1);
  for (let i = 1; i < C.length; i++) ok(Math.hypot(C[i].x - C[i - 1].x, C[i].z - C[i - 1].z) + C[i].r <= C[i - 1].r + 1e-6, 'cerchio ' + i + ' dentro il precedente');
  const z0 = F.zona(C, 0), zMezzo = F.zona(C, F.ULTIMA.fasi[0].attesa + F.ULTIMA.fasi[0].chiude / 2), zFine = F.zona(C, 10000);
  eq(z0.r, F.ULTIMA.r0); ok(zMezzo.chiude && zMezzo.r < C[0].r && zMezzo.r > C[1].r, 'la zona si stringe piano'); eq(zFine.r, 0);
  ok(F.zona(C, 400).danno > F.zona(C, 10).danno, 'piu\' avanti il buio fa piu\' male');
  const g = F.griglia(v1, 1.5, 0.5); ok(F.percorso(g, p[0], p[1], 120000), 'nella valle si trova la strada');
}

// --- grado e premi ---
eq(F.grado(0).nome, 'Recluta'); eq(F.grado(1000).nome, 'Soldato'); eq(F.grado(1e9).nome, 'Generale della Cometa');
ok(F.grado(500).k > 0.4 && F.grado(500).k < 0.6);
ok(F.premio({ modo: 'scontro', vinto: true }) > F.premio({ modo: 'scontro', pareggio: true }));
ok(F.premio({ modo: 'scontro', pareggio: true }) > F.premio({ modo: 'scontro' }));
eq(F.premio({ modo: 'ultima', posto: 1, giocatori: 16 }), 1.6);
ok(F.premio({ modo: 'ultima', posto: 3 }) > F.premio({ modo: 'ultima', posto: 7 }));
ok(F.premio({ modo: 'ultima', posto: 16 }) >= 0.6);
eq(F.premio({ modo: 'dominio', vinto: true, online: true }), 1.68);

console.log('Fronte della Cometa: ' + n + ' prove superate');
