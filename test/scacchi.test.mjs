// Prove del motore degli scacchi (src/minigiochi/scacchi/motore.js): regole, notazione, bot ed Elo.
//   node test/scacchi.test.mjs          (aggiungi --lento per le prove perft piu' profonde)
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ctx = { window: {}, Math, JSON, console, Date };
vm.runInNewContext(readFileSync(new URL('../src/minigiochi/scacchi/motore.js', import.meta.url), 'utf8'), ctx);
const S = ctx.window.B3.ScacchiMotore, ELO = ctx.window.B3.ScacchiElo, Pos = S.Posizione;
const lento = process.argv.includes('--lento');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; }; const eq = (a, b, m) => { assert.equal(a, b, m); n++; };
const gioca = (fen, mosse) => { const p = new Pos(fen); mosse.split(' ').filter(Boolean).forEach(t => { const m = p.trovaSan(t); assert.ok(m, 'mossa ' + t + ' non trovata in ' + p.fen()); p.fai(m); }); return p; };

// --- perft: numero di posizioni dopo N mosse (valori noti, controllano tutte le regole) ---
const PERFT = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],             // "kiwipete": arrocchi, en passant, promozioni
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],                                     // en passant che scopre lo scacco
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890]]
];
for (const [fen, attesi] of PERFT) {
  const p = new Pos(fen), max = lento ? attesi.length : Math.min(attesi.length, 3);
  for (let d = 1; d <= max; d++) eq(p.perft(d), attesi[d - 1], 'perft ' + d + ' di ' + fen);
  eq(p.fen(), fen, 'dopo perft la posizione torna com\'era');
}

// --- FEN ---
eq(new Pos().fen(), S.INIZIO);
{ const p = gioca(S.INIZIO, 'e4'); eq(p.fen(), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'); }
{ const p = gioca(S.INIZIO, 'e4 c5 Nf3'); eq(p.fen(), 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'); }

// --- matto, stallo e patte ---
{ const p = gioca(S.INIZIO, 'f3 e5 g4 Qh4#'); const s = p.stato(); ok(s.fine && s.motivo === 'matto' && s.vince === -1, 'matto del barbiere al contrario'); }
{ const p = gioca(S.INIZIO, 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#'); const s = p.stato(); ok(s.fine && s.vince === 1, 'matto del barbiere'); }
{ const p = new Pos('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'); const s = p.stato(); ok(s.fine && s.motivo === 'stallo' && s.vince === 0, 'stallo'); }
{ const p = new Pos('8/8/4k3/8/8/3K4/8/8 w - - 0 1'); eq(p.stato().motivo, 'materiale', 're contro re'); }
{ const p = new Pos('8/8/4k3/8/8/3K1N2/8/8 w - - 0 1'); eq(p.stato().motivo, 'materiale', 're e cavallo'); }
{ const p = new Pos('8/8/4k3/8/8/3K1R2/8/8 w - - 0 1'); ok(!p.stato().fine, 're e torre possono vincere'); }
{ const p = new Pos('8/8/2b1k3/8/8/3K1B2/8/8 w - - 0 1'); eq(p.stato().motivo, 'materiale', 'alfieri sullo stesso colore'); }
{ const p = new Pos('8/8/3bk3/8/8/3K1B2/8/8 w - - 0 1'); ok(!p.stato().fine, 'alfieri su colori diversi: si puo\' ancora giocare'); }
{ const p = gioca(S.INIZIO, 'Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1'); ok(!p.stato().fine, 'due volte non basta'); p.fai(p.trovaSan('Ng8')); eq(p.stato().motivo, 'ripetizione', 'tre volte la stessa posizione'); }
{ const p = new Pos('8/8/4k3/8/8/3K4/7R/8 w - - 99 80'); p.fai(p.trovaSan('Rh3')); eq(p.stato().motivo, 'cinquanta', '50 mosse senza prese ne\' pedoni'); }

// --- notazione ---
{ const p = new Pos('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); const l = p.mosse().map(m => p.san(m)); ok(l.includes('O-O') && l.includes('O-O-O'), 'arrocchi'); }
{ const p = new Pos('1k6/8/8/8/8/7K/8/R6R w - - 0 1'); const l = p.mosse().map(m => p.san(m).replace(/[+#]/, '')); ok(l.includes('Rab1') && l.includes('Rhb1'), 'torri distinte dalla colonna'); }
{ const p = new Pos('7k/8/8/R7/8/8/8/R5K1 w - - 0 1'); const l = p.mosse().map(m => p.san(m)); ok(l.includes('R5a3') && l.includes('R1a3'), 'torri distinte dalla traversa: ' + l.filter(x => x.includes('a3'))); }
{ const p = new Pos('3r3k/2P5/8/8/8/8/8/6K1 w - - 0 1'); const l = p.mosse().map(m => p.san(m)); ok(l.includes('cxd8=Q+') && l.includes('c8=N') && l.includes('cxd8=Q+'), 'promozioni: ' + l); }
{ const p = gioca(S.INIZIO, 'e4 d5 e5 f5'); const m = p.trovaSan('exf6'); ok(m && m.sp === 1, 'presa en passant'); p.fai(m); eq(p.pezzo('f5'), 0, 'il pedone mangiato sparisce'); p.disfa(); eq(p.pezzo('f5'), -1, 'e torna con disfa'); }
{ const p = new Pos(); eq(p.giocaUci('e2e4').san, 'e4'); eq(p.giocaUci('e7e5').san, 'e5'); eq(p.giocaUci('e1e3'), null, 'mossa illegale rifiutata'); }
{ const p = new Pos('4k3/8/8/8/8/8/4r3/R3K2R w KQ - 0 1'); ok(!p.mosse().some(m => m.sp === 2), 'niente arrocco sotto scacco'); }
{ const p = new Pos('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1'); const l = p.mosse().map(m => p.san(m)); ok(!l.includes('O-O') && l.includes('O-O-O'), 'niente arrocco attraverso una casa attaccata'); }

// --- bot ---
{ // matto in una: i bot forti lo vedono sempre
  for (const liv of [4, 5, 6, 7, 8]) { const u = S.mossaBot('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', [], liv, 7); eq(u, 'a1a8', 'il bot ' + liv + ' trova Ta8#'); }
}
{ // il bot piu' forte non lascia la donna in presa
  const u = S.mossaBot('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 1', [], 8, 3);
  const p = new Pos('rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 1'); p.giocaUci(u);
  ok(!p.mosse().some(m => m.cat === -5), 'la donna non resta in presa (mossa ' + u + ')');
}
{ // mangia un pezzo regalato
  const u = S.mossaBot('rnbqkb1r/pppppppp/8/8/4n3/3P4/PPP1PPPP/RNBQKBNR w KQkq - 0 1', [], 6, 11); eq(u, 'd3e4', 'il Gufo mangia il cavallo');
}
{ // tutti i livelli rispondono con una mossa legale, anche in apertura e con le ripetizioni
  for (let liv = 0; liv < S.BOT.length; liv++) for (const seme of [1, 2]) {
    const u = S.mossaBot(S.INIZIO, ['e2e4', 'e7e5', 'g1f3'], liv, seme, { ms: 100 }); const p = new Pos(); ['e2e4', 'e7e5', 'g1f3'].forEach(x => p.giocaUci(x)); ok(p.trovaUci(u), 'livello ' + liv + ' mossa legale ' + u);
  }
  eq(S.mossaBot('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', [], 3, 1), null, 'nessuna mossa nello stallo');
}
{ // i bot deboli perdono contro quelli forti (prova breve: 2 partite)
  let vinteForte = 0;
  for (const seme of [5, 9]) {
    const p = new Pos(), storia = []; let s = p.stato();
    for (let ply = 0; ply < 160 && !s.fine; ply++) { const liv = (ply % 2 === 0) === (seme === 5) ? 7 : 0; const u = S.mossaBot(S.INIZIO, storia, liv, seme * 100 + ply, { ms: 150 }); storia.push(u); p.giocaUci(u); s = p.stato(); }
    const forteBianco = seme === 5; if (s.fine && s.vince === (forteBianco ? 1 : -1)) vinteForte++;
  }
  ok(vinteForte === 2, 'Torre Nera batte Pallino (' + vinteForte + '/2)');
}
{ // il motore non lascia la posizione cambiata
  const p = new Pos('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), f = p.fen(); S.cerca(p, { tempo: 300 }); eq(p.fen(), f);
}
// il testo del motore ricostruisce un motore uguale (serve al Worker)
{ const f = new Function('return (' + S.sorgente + ')()')(); eq(new f.Posizione().perft(2), 400, 'motore ricostruito dal testo'); }

// --- Elo ---
eq(ELO.atteso(1200, 1200), 0.5);
eq(ELO.variazione(800, 800, 1, 0), 20, 'prime partite: K 40');
eq(ELO.variazione(800, 800, 0, 0), -20);
eq(ELO.variazione(1500, 1500, 1, 30), 12, 'dopo 20 partite: K 24');
eq(ELO.variazione(2100, 2100, 1, 50), 8, 'sopra 2000: K 16');
ok(ELO.variazione(1200, 400, 1, 30) <= 1, 'battere uno molto piu\' debole vale quasi niente');
ok(ELO.variazione(400, 1200, 1, 30) >= 23, 'battere uno molto piu\' forte vale tanto');
eq(ELO.variazione(105, 105, 0, 30), -5, 'non si scende sotto 100');
eq(ELO.variazione(1000, 1000, 0.5, 30), 0, 'patta tra pari');
eq(ELO.livello(800).nome, 'Cavallo'); eq(ELO.livello(650).nome, 'Pedone'); eq(ELO.livello(2500).nome, 'Gran Maestro del Borgo'); eq(ELO.livello(2500).quota, 1);
eq(ELO.livello(850).quota, 0.5, 'a meta\' strada verso l\'Alfiere');

console.log('ok  ' + n + ' prove degli scacchi');
