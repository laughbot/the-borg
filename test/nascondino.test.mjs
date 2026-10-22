// Prove delle regole del Nascondino Trasformista (src/minigiochi/nascondino/regole.js).
//   node test/nascondino.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx = { window: {}, Math, JSON, console };
vm.runInNewContext(readFileSync(new URL('../src/minigiochi/nascondino/regole.js', import.meta.url), 'utf8'), ctx);
const N = ctx.window.B3.NascondinoRegole;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.equal(JSON.stringify(a), JSON.stringify(b), m); n++; };

// stesso seme = stesso cortile (online tutti i telefoni vedono gli stessi oggetti)
const a = N.disponi(1234), b = N.disponi(1234), c = N.disponi(99);
eq(a, b, 'stesso seme, stessa disposizione');
ok(JSON.stringify(a) !== JSON.stringify(c), 'seme diverso, cortile diverso');
ok(a.length >= 50, 'almeno 50 oggetti nel cortile (sono ' + a.length + ')');

// nessun oggetto dentro le costruzioni o fuori dal cortile, nessuno sopra un altro
for (const s of [1, 2, 3, 77, 4242, 99999]) {
  const l = N.disponi(s);
  l.forEach(o => ok(N.libero(o.x, o.z, N.FORME[o.f].r), 'oggetto ' + o.i + ' libero (seme ' + s + ')'));
  for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
    const p = l[i], q = l[j];
    ok(Math.hypot(p.x - q.x, p.z - q.z) > N.FORME[p.f].r + N.FORME[q.f].r, 'oggetti ' + i + ' e ' + j + ' non si toccano');
  }
  ok(new Set(l.map(o => o.f)).size >= 6, 'almeno 6 forme diverse in giro (seme ' + s + ')');
}
// in mezzo alla fontana non si sta
ok(!N.libero(0, 0, 0.3)); ok(!N.libero(N.AX + 1, 0, 0.3)); ok(N.libero(-4, 3, 0.3));

// quanti cercatori
eq([2, 3, 4, 5, 7, 8, 10].map(N.quantiCercatori), [1, 1, 1, 2, 2, 3, 3]);

// ruoli: uguali su tutti i telefoni (non importa l'ordine degli id), giusto numero di cercatori
const ids = ['zz', 'aa', 'mm', 'bb', 'qq', 'cc'];
const r1 = N.ruoli(ids, 555), r2 = N.ruoli(ids.slice().reverse(), 555);
eq(r1, r2, 'stessi ruoli in qualsiasi ordine');
eq(Object.values(r1).filter(v => v === 1).length, 2, 'con 6 giocatori 2 cercatori');
{ const visti = new Set(); for (let s = 1; s < 60; s++) Object.entries(N.ruoli(ids, s)).forEach(([k, v]) => { if (v) visti.add(k); }); eq(visti.size, ids.length, 'prima o poi tutti fanno il cercatore'); }

// chi vince
eq(N.esito(0, 50), 'cercatori'); eq(N.esito(2, 0), 'nascosti'); eq(N.esito(1, 12), null); eq(N.esito(0, 0), 'cercatori', 'trovati tutti all\'ultimo secondo: vincono i cercatori');

// premi: chi resiste prende di piu' di chi viene trovato subito, online un po' di piu'
ok(N.premio({ eraNascosto: true, trovato: false }) > N.premio({ eraNascosto: true, trovato: true, resistito: 0.9 }));
ok(N.premio({ eraNascosto: true, trovato: true, resistito: 0.9 }) > N.premio({ eraNascosto: true, trovato: true, resistito: 0.1 }));
ok(N.premio({ vinto: true }) > N.premio({ vinto: false }));
eq(N.premio({ vinto: true, online: true }), 1.56);
ok(N.premio({ eraNascosto: true, trovato: true, resistito: 0 }) >= 0.6);

// cosa tocca il cercatore
const io = { x: 0, z: 0, yaw: 0 };   // guarda verso +z
const davanti = { x: 0, z: 1.5, r: 0.4, k: 'davanti' }, dietro = { x: 0, z: -1.2, r: 0.4, k: 'dietro' }, lontano = { x: 0, z: 6, r: 0.4, k: 'lontano' }, attaccato = { x: -0.3, z: -0.5, r: 0.4, k: 'attaccato' };
eq(N.bersaglio(io, [dietro, davanti, lontano]).k, 'davanti', 'tocca quello davanti');
eq(N.bersaglio(io, [lontano]), null, 'troppo lontano');
eq(N.bersaglio(io, [dietro]), null, 'alle spalle non tocca');
eq(N.bersaglio(io, [attaccato]).k, 'attaccato', 'se ci sei addosso lo tocchi anche dietro');
eq(N.bersaglio({ x: 0, z: 0, yaw: Math.PI / 2 }, [davanti, { x: 1.4, z: 0.1, r: 0.4, k: 'destra' }]).k, 'destra', 'segue la direzione in cui guardi');

console.log('Nascondino: ' + n + ' prove superate');
