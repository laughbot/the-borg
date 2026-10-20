// Prove della logica della Cripta (src/minigiochi/cripta/bottino.js): livelli, armi, casse, munizioni.
//   node test/cripta.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const memoria = {};
const localStorage = { getItem: k => (k in memoria ? memoria[k] : null), setItem: (k, v) => { memoria[k] = String(v); }, removeItem: k => { delete memoria[k]; } };
const ctx = { window: { B3: {} }, localStorage, Math, JSON, console };
vm.runInNewContext(readFileSync(new URL('../src/minigiochi/cripta/bottino.js', import.meta.url), 'utf8'), ctx);
const D = ctx.window.B3.CriptaDati;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.equal(JSON.stringify(a), JSON.stringify(b), m); n++; };
// numeri casuali ripetibili
const caso = seme => () => { seme = (seme * 16807) % 2147483647; return (seme - 1) / 2147483646; };

// livelli: 3 per sala nelle prime 10, massimo 30, rigiocando non si supera il massimo della sala
eq(D.livMaxSala(0), 3); eq(D.livMaxSala(9), 30); eq(D.livMaxSala(13), 30);
eq(D.dopoSala(1, 0), 3); eq(D.dopoSala(3, 0), 3, 'rigiocando la sala 1 non si va oltre il 3');
eq(D.dopoSala(3, 6), 6); eq(D.dopoSala(29, 9), 30); eq(D.dopoSala(30, 13), 30);
{ let L = 1; for (let i = 0; i < 10; i++) L = D.dopoSala(L, i); eq(L, 30, 'dopo la decima sala si e\' al 30'); }
eq(D.livAtteso(0), 1); eq(D.livAtteso(10), 30);
ok(D.scalaSala(10).hp > D.scalaSala(0).hp, 'i nemici crescono sala dopo sala');

// salvataggio nuovo: pistola e fucile a raffica, due granate, scorta di munizioni
const S = D.nuovo();
eq(S.armi.map(a => a.k), ['lucciola', 'tridente']); eq(S.scelta.length, 2); eq(S.granate.length, 2); eq(S.livello, 1);
D.riempiZaino(S); eq(S.zaino, { p: 360, s: 36, h: 9 }); eq(S.scorta, { p: 180, s: 18, h: 3 });

// statistiche: livello e pezzi
const st1 = D.statistiche(S); eq(st1.vita, 100); eq(st1.res, 1); eq(st1.salti, 1);
S.livello = 30; const st30 = D.statistiche(S); ok(st30.vita > 180 && st30.res < 0.75 && st30.danno > 2, JSON.stringify(st30));
S.pezzi.push({ u: 'e9', s: 'scarpe', r: 4, x: 'cometa' }); S.equip.scarpe = 'e9'; const stS = D.statistiche(S); ok(stS.poteri.volo === 1, 'Passi di Cometa: volo');
S.pezzi.push({ u: 'e10', s: 'scarpe', r: 4, x: 'rondine' }); S.equip.scarpe = 'e10'; eq(D.statistiche(S).salti, 2, 'Ali di Rondine: doppio salto');
S.pezzi.push({ u: 'e11', s: 'scarpe', r: 2, set: 'viandante' }); S.equip.scarpe = 'e11'; eq(D.statistiche(S).salti, 2, 'Viandante epiche: doppio salto');
S.pezzi.push({ u: 'e12', s: 'scarpe', r: 2, set: 'sentinella' }); S.equip.scarpe = 'e12'; eq(D.statistiche(S).salti, 1, 'Sentinella: niente doppio salto');
// vecchi salvataggi: i pezzi senza set diventano del Portatore, gli stellari senza chiave prendono quella di base
{ const V = D.pulisci({ pezzi: [{ u: 'e1', s: 'casco', r: 2 }, { u: 'e2', s: 'scarpe', r: 4 }] }); eq(V.pezzi[0].set, 'portatore'); eq(V.pezzi[1].x, 'cometa'); }
// nomi
eq(D.nomePezzo({ s: 'casco', r: 2, set: 'sentinella' }), 'Casco della Sentinella'); eq(D.nomePezzo({ s: 'scarpe', r: 4, x: 'rondine' }), 'Ali di Rondine');

// armi: al massimo una stellare in mano
S.armi.push({ u: 'a8', k: 'cuoreCometa', r: 4 }, { u: 'a9', k: 'ultimaLanterna', r: 4 });
eq(D.equipaggia(S, 'a8', 0), null); ok(D.equipaggia(S, 'a9', 1) !== null, 'due stellari: no'); eq(S.scelta[0], 'a8');
eq(D.equipaggia(S, 'a1', 1), null); eq(S.scelta, ['a8', 'a1']);
eq(D.equipaggia(S, 'a8', 1), null); eq(S.scelta, ['a1', 'a8'], 'stessa arma nell\'altro posto: si scambiano');

// munizioni: acquisto, massimi, regali
const P = D.nuovo(); let soldi = 30; const spendi = q => (soldi >= q ? ((soldi -= q), true) : false);
eq(D.compra(P, 'h', spendi), null); eq(P.scorta.h, 14); eq(soldi, 5); ok(D.compra(P, 'h', spendi) !== null, 'senza soldi non si compra');
P.scorta.p = 890; soldi = 100; ok(D.compra(P, 'p', spendi) !== null, 'scorta piena');
D.aggiungiMun(P, 's', 1000); eq(P.zaino.s, 36); eq(P.scorta.s, 90, 'oltre i massimi si perde');
ok(D.cadutaMun('schiavo', false, caso(7)).every(([t, q]) => D.TIPI_MUN.includes(t) && q > 0));
eq(D.cadutaMun('x', true).map(c => c[0]).sort(), ['h', 'p', 's']);

// casse: un bottino per volta, granate al massimo 2, munizioni, medaglietta, pieta'
{
  const C = D.nuovo(); let premi = 0, doni = 0;
  for (let i = 0; i < 200; i++) {
    const R = D.apriCassa(C, { boss: i % 5 === 4, sala: i % 14, caso: caso(i + 11), premio: m => { premi += m; return 10; }, dona: q => { doni += q; } });
    ok(R.oggetti.length === (i % 5 === 4 ? 2 : 1), 'oggetti per cassa');
    ok(C.granate.length <= 2, 'granate al massimo 2');
    ok(D.TIPI_MUN.every(t => C.zaino[t] <= D.MUN[t].zaino && C.scorta[t] <= D.MUN[t].scorta), 'munizioni nei limiti');
    ok(C.pieta < D.PIETA, 'pieta\': mai piu\' di 11 casse senza leggendaria');
  }
  ok(premi > 0 && doni > 0, 'Starlight dalla cassa e dai doppioni');
  eq(Object.keys(C.medaglie).length, 14, 'una medaglietta per sala');
  ok(C.armi.some(a => a.r === 4) || C.pezzi.some(p => p.r === 4), 'in 200 casse esce almeno una stellare');
  ok(C.pezzi.every(p => p.r === 4 ? D.STELLARI[p.s][p.x] : D.SETS[p.set]), 'ogni pezzo ha un set o uno stellare valido');
  ok(new Set(C.pezzi.filter(p => p.r < 4).map(p => p.set)).size >= 3, 'dalle casse escono set diversi');
  // nessun doppione tenuto: stessa arma con rarita' uguale o minore diventa Starlight
  const visti = {}; C.armi.forEach(a => { const k = a.k + '/' + a.r; ok(!visti[k] || D.ARMI[a.k].base, 'doppione tenuto: ' + k); visti[k] = 1; });
  // in prova niente Starlight
  const R = D.apriCassa(D.nuovo(), { boss: true, sala: 0, prova: true, caso: caso(3), premio: () => { throw new Error('premio in prova'); } }); eq(R.stelle, 0);
}

// sale: chi entra con un amico piu' avanti prende il suo salvataggio; si riparte dalla prima non superata
{
  const G = D.nuovo(); eq(D.partenza(G), 0);
  const r = D.salaFatta(G, 6); eq(r, { prima: 1, dopo: 4 }, 'livello: +3 (sotto il massimo della sala)'); eq(D.partenza(G), 7);
  for (let i = 7; i < 14; i++) D.salaFatta(G, i); eq(D.partenza(G), 0, 'finite tutte si ricomincia');
  D.azzeraSale(G); eq(D.partenza(G), 0); eq(G.livello, 25, 'ricominciando da zero il livello resta');
}

// salvataggio: si rilegge uguale e i dati rovinati vengono ripuliti
{
  const A = D.nuovo(); D.apriCassa(A, { boss: true, sala: 2, caso: caso(5) }); A.livello = 9; D.salva(A);
  const B = D.carica(); eq(B.livello, 9); eq(B.armi.length, A.armi.length); eq(B.medaglie, A.medaglie);
  const sporco = D.pulisci({ livello: 99, armi: [{ u: 'x', k: 'inesistente', r: 2 }], granate: ['framm', 'framm', 'luce', 'boh'], zaino: { p: 1e9 }, scelta: ['zz'] });
  eq(sporco.livello, 30); ok(sporco.armi.some(a => a.k === 'lucciola') && sporco.armi.some(a => a.k === 'tridente'), 'armi di base sempre');
  eq(sporco.granate.length, 2); eq(sporco.zaino.p, 360); eq(sporco.scelta.length, 2);
  // migrazione dai vecchi progressi (4 incontri): Bruthak fatto = sale fino alla 7
  for (const k in memoria) delete memoria[k];
  memoria['theborg.raid.v2'] = JSON.stringify({ 0: 1, 1: 1, 2: 1, 3: 1 });
  const M = D.carica(); eq(D.partenza(M), 7); eq(M.livello, 21);
  // la modalita' prova ha un salvataggio a parte
  const Q = D.carica(true); D.tuttoProva(Q, 30); D.salva(Q, true); eq(D.carica().livello, 21, 'la prova non tocca il salvataggio vero'); eq(D.carica(true).livello, 30);
}

// equipaggiamento addosso: formato per le armature, codice corto per la rete, compagni bot
{
  const S = D.nuovo(); D.tuttoProva(S, 30);
  D.PARTI.forEach(s => { const p = S.pezzi.find(q => q.s === s && q.r === 3 && q.set === 'oracolo'); if (p) D.indossa(S, p.u); });
  const st = S.pezzi.find(q => q.s === 'scarpe' && q.r === 4 && q.x === 'rondine'); D.indossa(S, st.u);
  const v = D.vesteDi(S); eq(v.casco, { r: 3, set: 'oracolo' }); eq(v.scarpe, { r: 4, k: 'rondine' });
  const c = D.codificaVeste(v); eq(c.length, 10, c); eq(D.decodificaVeste(c), v, 'la rete riporta gli stessi pezzi');
  eq(D.decodificaVeste('-'.repeat(5)), {}); eq(D.decodificaVeste(null), {}); ok(typeof D.decodificaVeste('9z9z9z9z9z').casco === 'object', 'codice strano: niente errori');
  for (let i = 0; i < 5; i++) for (let sala = 0; sala < 14; sala++) { const b = D.vesteBot(i, sala); Object.values(b).forEach(e => ok(e.r >= 0 && e.r <= 4)); }
  eq(D.vesteBot(0, 8).mantello, { r: 4, k: 'stendardo' });
}
console.log('ok  cripta (progressi e bottino): ' + n + ' controlli');
