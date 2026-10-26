/* =====================================================================
   THE BORG - SCACCHI: il motore (senza grafica).
   Tutte le regole (arrocco, presa en passant, promozione, scacco matto,
   stallo, patta per ripetizione, per 50 mosse e per materiale insufficiente),
   la notazione delle mosse (SAN, es. "Cf3", "exd5", "O-O", "e8=D+") e i bot
   a livelli, con il punteggio Elo (B3.ScacchiElo).
   E' tutto dentro fabbricaScacchi() perche' il gioco possa farlo girare anche
   in un Worker (cosi' mentre il bot pensa lo schermo non si blocca):
   il Worker riceve il testo della funzione (B3.ScacchiMotore.sorgente).
   Prove: node test/scacchi.test.mjs
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3 = window.B3 || {};

  function fabbricaScacchi() {
    'use strict';
    // pezzi: 1 pedone, 2 cavallo, 3 alfiere, 4 torre, 5 donna, 6 re; bianco positivo, nero negativo
    const P = 1, N = 2, BI = 3, R = 4, Q = 5, K = 6;
    const LETTERA = ['', 'p', 'n', 'b', 'r', 'q', 'k'];
    const DA_LETTERA = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
    // caselle 0x88: indice = traversa * 16 + colonna (a1 = 0, h8 = 0x77)
    const sq = (f, r) => r * 16 + f, col = s => s & 7, trav = s => s >> 4, fuori = s => (s & 0x88) !== 0;
    const nome = s => 'abcdefgh'[col(s)] + (trav(s) + 1);
    const daNome = t => sq(t.charCodeAt(0) - 97, t.charCodeAt(1) - 49);
    const D_N = [33, 31, 18, 14, -33, -31, -18, -14], D_B = [17, 15, -17, -15], D_R = [16, -16, 1, -1], D_K = [17, 15, -17, -15, 16, -16, 1, -1];
    const INIZIO = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    /* ---------- chiavi Zobrist (due numeri da 32 bit, sempre gli stessi) ---------- */
    let semeZ = 0x9e3779b9;
    const rz = () => { semeZ ^= semeZ << 13; semeZ ^= semeZ >>> 17; semeZ ^= semeZ << 5; return semeZ >>> 0; };
    const ZP = [], ZT = [rz(), rz()], ZA = [], ZE = [];
    for (let i = 0; i < 13 * 128; i++) ZP.push([rz(), rz()]);
    for (let i = 0; i < 16; i++) ZA.push([rz(), rz()]);
    for (let i = 0; i < 8; i++) ZE.push([rz(), rz()]);
    const zi = (p, s) => ((p + 6) * 128 + s);

    /* ---------- la posizione ---------- */
    function Posizione(fen) {
      this.b = new Int8Array(128); this.turno = 1; this.arr = 0; this.ep = -1; this.cinquanta = 0; this.mossaN = 1;
      this.re = [0, 0]; this.storia = []; this.chiavi = []; this.h1 = 0; this.h2 = 0;
      this.carica(fen || INIZIO);
    }
    const PR = Posizione.prototype;
    PR.carica = function (fen) {
      const t = String(fen).trim().split(/\s+/); this.b.fill(0);
      const righe = (t[0] || '').split('/'); if (righe.length !== 8) throw new Error('FEN non valido');
      for (let r = 0; r < 8; r++) {
        let f = 0;
        for (const c of righe[7 - r]) {
          if (c >= '1' && c <= '8') { f += +c; continue; }
          const p = DA_LETTERA[c.toLowerCase()]; if (!p || f > 7) throw new Error('FEN non valido');
          this.b[sq(f, r)] = c === c.toLowerCase() ? -p : p; if (p === K) this.re[c === c.toLowerCase() ? 1 : 0] = sq(f, r); f++;
        }
      }
      this.turno = t[1] === 'b' ? -1 : 1;
      this.arr = 0; const a = t[2] || '-'; if (a.includes('K')) this.arr |= 1; if (a.includes('Q')) this.arr |= 2; if (a.includes('k')) this.arr |= 4; if (a.includes('q')) this.arr |= 8;
      this.ep = t[3] && t[3] !== '-' ? daNome(t[3]) : -1;
      this.cinquanta = +t[4] || 0; this.mossaN = +t[5] || 1; this.storia = []; this.chiavi = [];
      this.hash(); this.chiavi.push(this.chiave());
    };
    PR.hash = function () {
      let a = 0, c = 0;
      for (let s = 0; s < 128; s++) { if (fuori(s)) { s += 7; continue; } const p = this.b[s]; if (p) { const z = ZP[zi(p, s)]; a ^= z[0]; c ^= z[1]; } }
      if (this.turno < 0) { a ^= ZT[0]; c ^= ZT[1]; }
      a ^= ZA[this.arr][0]; c ^= ZA[this.arr][1];
      if (this.ep >= 0) { a ^= ZE[col(this.ep)][0]; c ^= ZE[col(this.ep)][1]; }
      this.h1 = a >>> 0; this.h2 = c >>> 0;
    };
    PR.chiave = function () { return this.h1 * 1048576 + (this.h2 & 0xfffff); };
    PR.fen = function () {
      let s = '';
      for (let r = 7; r >= 0; r--) {
        let v = 0;
        for (let f = 0; f < 8; f++) { const p = this.b[sq(f, r)]; if (!p) { v++; continue; } if (v) { s += v; v = 0; } const l = LETTERA[Math.abs(p)]; s += p > 0 ? l.toUpperCase() : l; }
        if (v) s += v; if (r) s += '/';
      }
      let a = (this.arr & 1 ? 'K' : '') + (this.arr & 2 ? 'Q' : '') + (this.arr & 4 ? 'k' : '') + (this.arr & 8 ? 'q' : '');
      return s + ' ' + (this.turno > 0 ? 'w' : 'b') + ' ' + (a || '-') + ' ' + (this.ep >= 0 ? nome(this.ep) : '-') + ' ' + this.cinquanta + ' ' + this.mossaN;
    };
    PR.copia = function () { const q = new Posizione(this.fen()); q.chiavi = this.chiavi.slice(); return q; };

    /* ---------- case attaccate ---------- */
    PR.attaccata = function (s, da) {   // da = 1 bianco, -1 nero
      const b = this.b;
      // pedoni
      const pp = da > 0 ? [s - 15, s - 17] : [s + 15, s + 17];
      for (const t of pp) if (!fuori(t) && b[t] === da * P) return true;
      for (const d of D_N) { const t = s + d; if (!fuori(t) && b[t] === da * N) return true; }
      for (const d of D_K) { const t = s + d; if (!fuori(t) && b[t] === da * K) return true; }
      for (const d of D_B) { let t = s + d; while (!fuori(t)) { const p = b[t]; if (p) { if (p === da * BI || p === da * Q) return true; break; } t += d; } }
      for (const d of D_R) { let t = s + d; while (!fuori(t)) { const p = b[t]; if (p) { if (p === da * R || p === da * Q) return true; break; } t += d; } }
      return false;
    };
    PR.inScacco = function (lato) { lato = lato || this.turno; return this.attaccata(this.re[lato > 0 ? 0 : 1], -lato); };

    /* ---------- mosse ---------- */
    // mossa = { da, a, pz (pezzo che muove), cat (pezzo mangiato), pr (promozione, con segno), sp: 0 normale, 1 en passant, 2 arrocco, 3 doppio passo }
    function aggiungi(l, da, a, pz, cat, pr, sp) { l.push({ da, a, pz, cat, pr: pr || 0, sp: sp || 0 }); }
    PR.pseudo = function (soloPrese) {
      const l = [], b = this.b, me = this.turno;
      for (let s = 0; s < 128; s++) {
        if (fuori(s)) { s += 7; continue; }
        const p = b[s]; if (!p || (p > 0) !== (me > 0)) continue;
        const t = p * me;
        if (t === P) {
          const av = s + 16 * me, ult = me > 0 ? 7 : 0, prima = me > 0 ? 1 : 6;
          if (!fuori(av) && !b[av]) {
            if (trav(av) === ult) { for (const x of [Q, R, BI, N]) aggiungi(l, s, av, p, 0, x * me); }
            else if (!soloPrese) { aggiungi(l, s, av, p, 0); const a2 = av + 16 * me; if (trav(s) === prima && !b[a2]) aggiungi(l, s, a2, p, 0, 0, 3); }
          }
          for (const d of [15, 17]) {
            const a = s + d * me; if (fuori(a)) continue;
            const c = b[a];
            if (c && (c > 0) !== (me > 0)) { if (trav(a) === ult) { for (const x of [Q, R, BI, N]) aggiungi(l, s, a, p, c, x * me); } else aggiungi(l, s, a, p, c); }
            else if (a === this.ep) aggiungi(l, s, a, p, -me * P, 0, 1);
          }
          continue;
        }
        const dirs = t === N ? D_N : t === BI ? D_B : t === R ? D_R : D_K, scivola = t === BI || t === R || t === Q;
        for (const d of (t === Q ? D_K : dirs)) {
          let a = s + d;
          while (!fuori(a)) {
            const c = b[a];
            if (c) { if ((c > 0) !== (me > 0)) aggiungi(l, s, a, p, c); break; }
            if (!soloPrese) aggiungi(l, s, a, p, 0);
            if (!scivola) break; a += d;
          }
        }
        if (t === K && !soloPrese) {
          const r0 = me > 0 ? 0 : 0x70, kA = me > 0 ? 1 : 4, qA = me > 0 ? 2 : 8;
          if (s === r0 + 4 && !this.attaccata(s, -me)) {
            if ((this.arr & kA) && !b[r0 + 5] && !b[r0 + 6] && b[r0 + 7] === me * R && !this.attaccata(r0 + 5, -me) && !this.attaccata(r0 + 6, -me)) aggiungi(l, s, r0 + 6, p, 0, 0, 2);
            if ((this.arr & qA) && !b[r0 + 3] && !b[r0 + 2] && !b[r0 + 1] && b[r0] === me * R && !this.attaccata(r0 + 3, -me) && !this.attaccata(r0 + 2, -me)) aggiungi(l, s, r0 + 2, p, 0, 0, 2);
          }
        }
      }
      return l;
    };
    // diritti di arrocco che restano dopo aver toccato una casa
    const TOGLI = new Int8Array(128).fill(15); TOGLI[0] = 13; TOGLI[7] = 14; TOGLI[4] = 12; TOGLI[0x70] = 7; TOGLI[0x77] = 11; TOGLI[0x74] = 3;
    PR.fai = function (m) {
      const b = this.b, me = this.turno;
      this.storia.push({ m, arr: this.arr, ep: this.ep, c5: this.cinquanta, h1: this.h1, h2: this.h2 });
      let a = this.h1, c = this.h2;
      const zx = (p, s) => { const z = ZP[zi(p, s)]; a ^= z[0]; c ^= z[1]; };
      zx(m.pz, m.da); b[m.da] = 0;
      if (m.sp === 1) { const cs = m.a - 16 * me; zx(b[cs], cs); b[cs] = 0; }
      else if (m.cat) zx(m.cat, m.a);
      const arriva = m.pr || m.pz; b[m.a] = arriva; zx(arriva, m.a);
      if (m.sp === 2) { const r0 = me > 0 ? 0 : 0x70, corta = m.a === r0 + 6, rd = corta ? r0 + 7 : r0, ra = corta ? r0 + 5 : r0 + 3; zx(b[rd], rd); b[ra] = b[rd]; b[rd] = 0; zx(b[ra], ra); }
      if (Math.abs(m.pz) === K) this.re[me > 0 ? 0 : 1] = m.a;
      a ^= ZA[this.arr][0]; c ^= ZA[this.arr][1]; this.arr &= TOGLI[m.da] & TOGLI[m.a]; a ^= ZA[this.arr][0]; c ^= ZA[this.arr][1];
      if (this.ep >= 0) { a ^= ZE[col(this.ep)][0]; c ^= ZE[col(this.ep)][1]; }
      this.ep = m.sp === 3 ? m.da + 16 * me : -1;
      if (this.ep >= 0) { a ^= ZE[col(this.ep)][0]; c ^= ZE[col(this.ep)][1]; }
      this.cinquanta = (Math.abs(m.pz) === P || m.cat) ? 0 : this.cinquanta + 1;
      if (me < 0) this.mossaN++;
      this.turno = -me; a ^= ZT[0]; c ^= ZT[1];
      this.h1 = a >>> 0; this.h2 = c >>> 0;
      this.chiavi.push(this.chiave());
    };
    PR.disfa = function () {
      const u = this.storia.pop(); if (!u) return null; const m = u.m, b = this.b;
      this.chiavi.pop();
      this.turno = -this.turno; const me = this.turno;
      if (me < 0) this.mossaN--;
      b[m.da] = m.pz; b[m.a] = 0;
      if (m.sp === 1) b[m.a - 16 * me] = m.cat; else if (m.cat) b[m.a] = m.cat;
      if (m.sp === 2) { const r0 = me > 0 ? 0 : 0x70, corta = m.a === r0 + 6, rd = corta ? r0 + 7 : r0, ra = corta ? r0 + 5 : r0 + 3; b[rd] = b[ra]; b[ra] = 0; }
      if (Math.abs(m.pz) === K) this.re[me > 0 ? 0 : 1] = m.da;
      this.arr = u.arr; this.ep = u.ep; this.cinquanta = u.c5; this.h1 = u.h1; this.h2 = u.h2;
      return m;
    };
    PR.mosse = function (soloPrese) {
      const out = [], me = this.turno;
      for (const m of this.pseudo(soloPrese)) { this.fai(m); if (!this.attaccata(this.re[me > 0 ? 0 : 1], -me)) out.push(m); this.disfa(); }
      return out;
    };
    // mossa in formato "e2e4" / "e7e8q"
    const uci = m => nome(m.da) + nome(m.a) + (m.pr ? LETTERA[Math.abs(m.pr)] : '');
    PR.trovaUci = function (t) { t = String(t || '').toLowerCase(); return this.mosse().find(m => uci(m) === t) || null; };
    PR.giocaUci = function (t) { const m = this.trovaUci(t); if (!m) return null; const s = this.san(m); this.fai(m); return { m, san: s, uci: uci(m) }; };

    /* ---------- notazione SAN ---------- */
    PR.san = function (m) {
      const t = Math.abs(m.pz); let s;
      if (m.sp === 2) s = col(m.a) === 6 ? 'O-O' : 'O-O-O';
      else if (t === P) { s = (m.cat ? 'abcdefgh'[col(m.da)] + 'x' : '') + nome(m.a) + (m.pr ? '=' + LETTERA[Math.abs(m.pr)].toUpperCase() : ''); }
      else {
        s = LETTERA[t].toUpperCase();
        const altre = this.mosse().filter(x => x.a === m.a && x.pz === m.pz && x.da !== m.da);
        if (altre.length) {
          const stessaC = altre.some(x => col(x.da) === col(m.da)), stessaT = altre.some(x => trav(x.da) === trav(m.da));
          s += !stessaC ? 'abcdefgh'[col(m.da)] : !stessaT ? String(trav(m.da) + 1) : nome(m.da);
        }
        s += (m.cat ? 'x' : '') + nome(m.a);
      }
      this.fai(m); const sc = this.inScacco(), nessuna = !this.mosse().length; this.disfa();
      return s + (sc ? (nessuna ? '#' : '+') : '');
    };
    PR.trovaSan = function (t) { const pulito = x => String(x).replace(/[+#!?]/g, '').replace(/0/g, 'O'); t = pulito(t); return this.mosse().find(m => pulito(this.san(m)) === t) || null; };

    /* ---------- fine partita ---------- */
    PR.ripetizioni = function () { const k = this.chiave(); let n = 0; for (let i = this.chiavi.length - 1, lim = Math.max(0, this.chiavi.length - 1 - this.cinquanta); i >= lim; i -= 1) if (this.chiavi[i] === k) n++; return n; };
    PR.materialeInsufficiente = function () {
      const pz = []; for (let s = 0; s < 128; s++) { if (fuori(s)) { s += 7; continue; } const p = this.b[s]; if (p && Math.abs(p) !== K) pz.push([Math.abs(p), (col(s) + trav(s)) & 1]); }
      if (!pz.length) return true;
      if (pz.some(x => x[0] === P || x[0] === R || x[0] === Q)) return false;
      if (pz.length === 1) return true;                                      // re e cavallo, re e alfiere
      return pz.every(x => x[0] === BI) && pz.every(x => x[1] === pz[0][1]);  // solo alfieri tutti su case dello stesso colore
    };
    // { fine: true/false, vince: 1 bianco, -1 nero, 0 patta, motivo }
    PR.stato = function () {
      const l = this.mosse();
      if (!l.length) return this.inScacco() ? { fine: true, vince: -this.turno, motivo: 'matto' } : { fine: true, vince: 0, motivo: 'stallo' };
      if (this.materialeInsufficiente()) return { fine: true, vince: 0, motivo: 'materiale' };
      if (this.cinquanta >= 100) return { fine: true, vince: 0, motivo: 'cinquanta' };
      if (this.ripetizioni() >= 3) return { fine: true, vince: 0, motivo: 'ripetizione' };
      return { fine: false, scacco: this.inScacco(), n: l.length };
    };
    PR.pezzo = function (nomeCasa) { return this.b[daNome(nomeCasa)]; };

    /* ---------- conteggio delle posizioni (per le prove: perft) ---------- */
    PR.perft = function (d) { if (!d) return 1; let n = 0; for (const m of this.mosse()) { this.fai(m); n += d === 1 ? 1 : this.perft(d - 1); this.disfa(); } return n; };

    /* =====================================================================
       IL BOT: ricerca alfa-beta con approfondimento progressivo, quiete sulle
       prese, tabella delle posizioni, mosse killer. Valutazione: materiale e
       tabelle delle case per pezzo (apertura e finale mescolati).
       ===================================================================== */
    const VAL = [0, 100, 320, 330, 500, 900, 0];
    // tabelle dal punto di vista del bianco, riga 0 = ottava traversa (come si scrivono di solito)
    const PST = {
      1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
      2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
      3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
      4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
      5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
      6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
      7: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
    };
    const idxB = s => (7 - trav(s)) * 8 + col(s), idxN = s => trav(s) * 8 + col(s);
    const FASE = [0, 0, 1, 1, 2, 4, 0];
    PR.valuta = function () {   // dal punto di vista di chi muove
      const b = this.b; let mg = 0, eg = 0, fase = 0, alfB = 0, alfN = 0;
      const pedB = new Int8Array(8), pedN = new Int8Array(8);
      for (let s = 0; s < 128; s++) {
        if (fuori(s)) { s += 7; continue; }
        const p = b[s]; if (!p) continue;
        const t = Math.abs(p), i = p > 0 ? idxB(s) : idxN(s), sg = p > 0 ? 1 : -1;
        fase += FASE[t];
        if (t === K) { mg += sg * PST[6][i]; eg += sg * PST[7][i]; continue; }
        const v = VAL[t] + PST[t][i]; mg += sg * v; eg += sg * v;
        if (t === BI) { if (p > 0) alfB++; else alfN++; }
        if (t === P) { if (p > 0) pedB[col(s)]++; else pedN[col(s)]++; }
      }
      // coppia degli alfieri, pedoni doppiati e pedoni passati
      if (alfB >= 2) { mg += 30; eg += 40; } if (alfN >= 2) { mg -= 30; eg -= 40; }
      for (let f = 0; f < 8; f++) { if (pedB[f] > 1) { mg -= 12 * (pedB[f] - 1); eg -= 20 * (pedB[f] - 1); } if (pedN[f] > 1) { mg += 12 * (pedN[f] - 1); eg += 20 * (pedN[f] - 1); } }
      for (let s = 0; s < 128; s++) {
        if (fuori(s)) { s += 7; continue; }
        const p = b[s]; if (Math.abs(p) !== P) continue;
        const f = col(s), r = trav(s), w = p > 0; let passato = true;
        for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1) && passato; ff++)
          for (let rr = w ? r + 1 : r - 1; w ? rr < 7 : rr > 0; rr += w ? 1 : -1) if (b[sq(ff, rr)] === (w ? -P : P)) { passato = false; break; }
        if (passato) { const avanti = w ? r : 7 - r, bonus = [0, 5, 10, 20, 35, 60, 100, 0][avanti]; mg += (w ? 1 : -1) * bonus * 0.5; eg += (w ? 1 : -1) * bonus; }
      }
      fase = Math.min(24, fase);
      const v = (mg * fase + eg * (24 - fase)) / 24;
      return Math.round(v) * this.turno;
    };

    const MATTO = 100000;
    function cerca(pos, opz) {
      opz = opz || {};
      const t0 = Date.now(), limite = opz.tempo || 1000, maxP = opz.profondita || 64;
      const tt = new Map(), killer = [];
      let nodi = 0, stop = false;
      const tempoScaduto = () => { if ((nodi & 1023) === 0 && Date.now() - t0 > limite) stop = true; return stop; };
      const ordine = (m, ttM, ply) => {
        if (ttM && m.da === ttM.da && m.a === ttM.a && m.pr === ttM.pr) return 1e6;
        if (m.cat) return 1e5 + VAL[Math.abs(m.cat)] * 10 - VAL[Math.abs(m.pz)];
        if (m.pr) return 9e4;
        const k = killer[ply]; if (k && ((k[0] && k[0].da === m.da && k[0].a === m.a) || (k[1] && k[1].da === m.da && k[1].a === m.a))) return 8e4;
        return 0;
      };
      function quiete(alfa, beta, ply) {
        nodi++; if (tempoScaduto()) return 0;
        const fermo = pos.valuta(); if (fermo >= beta) return beta; if (fermo > alfa) alfa = fermo;
        if (ply > 40) return alfa;
        const l = pos.pseudo(true); l.sort((a, b) => ordine(b, null, ply) - ordine(a, null, ply));
        const me = pos.turno;
        for (const m of l) {
          if (fermo + VAL[Math.abs(m.cat)] + 200 < alfa && !m.pr) continue;   // presa che non puo' bastare
          pos.fai(m);
          if (pos.attaccata(pos.re[me > 0 ? 0 : 1], -me)) { pos.disfa(); continue; }
          const v = -quiete(-beta, -alfa, ply + 1); pos.disfa();
          if (stop) return 0;
          if (v >= beta) return beta; if (v > alfa) alfa = v;
        }
        return alfa;
      }
      function ab(d, alfa, beta, ply) {
        if (ply && (pos.cinquanta >= 100 || pos.ripetizioni() >= 2)) return 0;
        const scacco = pos.inScacco(); if (scacco) d++;
        if (d <= 0 || ply > 60) return quiete(alfa, beta, ply);
        nodi++; if (tempoScaduto()) return 0;
        const k = pos.chiave(), e = tt.get(k); let ttM = null;
        if (e) { ttM = e.m; if (e.d >= d && ply) { if (e.f === 0) return e.v; if (e.f === 1 && e.v >= beta) return e.v; if (e.f === 2 && e.v <= alfa) return e.v; } }
        const l = pos.pseudo(); l.forEach(m => { m.o = ordine(m, ttM, ply); }); l.sort((a, b) => b.o - a.o);
        const me = pos.turno, a0 = alfa; let migliore = -MATTO * 2, mm = null, legali = 0;
        for (const m of l) {
          pos.fai(m);
          if (pos.attaccata(pos.re[me > 0 ? 0 : 1], -me)) { pos.disfa(); continue; }
          legali++;
          let v;
          if (legali > 1) { v = -ab(d - 1, -alfa - 1, -alfa, ply + 1); if (v > alfa && v < beta && !stop) v = -ab(d - 1, -beta, -alfa, ply + 1); }
          else v = -ab(d - 1, -beta, -alfa, ply + 1);
          pos.disfa();
          if (stop) return 0;
          if (v > migliore) { migliore = v; mm = m; }
          if (v > alfa) alfa = v;
          if (alfa >= beta) { if (!m.cat) { const kk = killer[ply] || (killer[ply] = [null, null]); if (!kk[0] || kk[0].da !== m.da || kk[0].a !== m.a) { kk[1] = kk[0]; kk[0] = m; } } break; }
        }
        if (!legali) return scacco ? -MATTO + ply : 0;
        if (tt.size > 400000) tt.clear();
        tt.set(k, { d, v: migliore, f: migliore <= a0 ? 2 : migliore >= beta ? 1 : 0, m: mm });
        return migliore;
      }
      // radice: punteggio di ogni mossa (serve ai bot deboli per sbagliare "da umani")
      const radice = pos.mosse(); if (!radice.length) return { mossa: null, punteggi: [], profondita: 0, nodi: 0 };
      let punt = radice.map(m => ({ m, v: 0 })), fatta = 0;
      for (let d = 1; d <= maxP; d++) {
        const nuovi = [];
        let alfa = -MATTO * 2;
        for (const x of punt) {
          pos.fai(x.m);
          // tutte le mosse a finestra piena quando servono i punteggi esatti, altrimenti finestra stretta
          const v = opz.tutte ? -ab(d - 1, -MATTO * 2, MATTO * 2, 1) : -ab(d - 1, -MATTO * 2, -alfa, 1);
          pos.disfa();
          if (stop) break;
          nuovi.push({ m: x.m, v }); if (v > alfa) alfa = v;
        }
        if (stop && fatta) break;
        if (stop) { punt = nuovi.concat(punt.filter(x => !nuovi.some(y => y.m === x.m))); fatta = d; break; }
        nuovi.sort((a, b) => b.v - a.v); punt = nuovi; fatta = d;
        if (Math.abs(punt[0].v) > MATTO - 100) break;   // matto trovato
        if (Date.now() - t0 > limite * 0.55) break;      // la prossima profondita' non farebbe in tempo
      }
      return { mossa: punt[0].m, valore: punt[0].v, punteggi: punt, profondita: fatta, nodi };
    }

    /* ---------- i livelli dei bot ----------
       elo = forza indicativa (da tarare con le prove vere); p = profondita'; ms = tempo per pensare;
       rumore = quanto sbaglia a giudicare le mosse (in centesimi di pedone); caso = probabilita' di una mossa a caso */
    const BOT = [
      { id: 'pulcino', nome: 'Pallino il Pulcino', ico: '🐣', elo: 250, p: 1, ms: 200, rumore: 450, caso: 0.35, bio: 'Ha appena imparato come si muovono i pezzi. Più o meno.' },
      { id: 'scoiattolo', nome: 'Rametto lo Scoiattolo', ico: '🐿️', elo: 450, p: 1, ms: 200, rumore: 260, caso: 0.15, bio: 'Corre dappertutto con i pezzi, ma a volte si dimentica di difenderli.' },
      { id: 'nonna', nome: 'Nonna Ortensia', ico: '👵', elo: 650, p: 2, ms: 300, rumore: 150, caso: 0.07, bio: 'Gioca da sessant\'anni sulla panchina della fontana. Lenta ma furba.' },
      { id: 'lampionaio', nome: 'Brillo il Lampionaio', ico: '🏮', elo: 850, p: 2, ms: 400, rumore: 80, caso: 0.03, bio: 'Accende i lampioni e le partite. Attento alle forchette.' },
      { id: 'fata', nome: 'Fata Mirella', ico: '🧚', elo: 1050, p: 3, ms: 500, rumore: 45, caso: 0.01, bio: 'Vede due mosse avanti e ti fa credere che sia magia.' },
      { id: 'capitano', nome: 'Capitan Ancora', ico: '⚓', elo: 1250, p: 3, ms: 700, rumore: 22, caso: 0, bio: 'Attacca sempre a tutta vela. Se ti difendi bene, affonda.' },
      { id: 'gufo', nome: 'Gufo Sapiente', ico: '🦉', elo: 1450, p: 4, ms: 1200, rumore: 10, caso: 0, bio: 'Ha letto tutti i libri di scacchi della Biblioteca. Due volte.' },
      { id: 'torre', nome: 'Torre Nera', ico: '♜', elo: 1650, p: 6, ms: 2200, rumore: 4, caso: 0, bio: 'Non parla mai. Non sbaglia quasi mai.' },
      { id: 'maestro', nome: 'Il Gran Maestro della Cometa', ico: '☄️', elo: 1850, p: 64, ms: 3500, rumore: 0, caso: 0, bio: 'Il campione del borgo. Batterlo è una leggenda.' }
    ];
    // generatore casuale con seme (le prove danno sempre lo stesso risultato)
    function casuale(seme) { let s = (Math.imul((seme >>> 0) ^ 0x5bd1e995, 0x9e3779b1) >>> 0) || 1; const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; for (let i = 0; i < 6; i++) r(); return r; }
    function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    // fen + mosse giocate (per le ripetizioni) -> mossa del bot in formato uci
    function mossaBot(fen, mosseUci, livello, seme, opz) {
      const bot = BOT[Math.max(0, Math.min(BOT.length - 1, livello | 0))], r = casuale(seme || Date.now());
      const pos = new Posizione(fen); (mosseUci || []).forEach(u => pos.giocaUci(u));
      const legali = pos.mosse(); if (!legali.length) return null;
      if (legali.length === 1) return uci(legali[0]);
      const apertura = pos.storia.length < 8;
      if (bot.caso && r() < bot.caso) {
        // mossa "a caso", ma quando puo' mangiare qualcosa spesso lo fa (come un principiante)
        const prese = legali.filter(m => m.cat); const l = prese.length && r() < 0.5 ? prese : legali;
        return uci(l[Math.floor(r() * l.length)]);
      }
      const rumore = bot.rumore || (apertura ? 12 : 0);   // anche il campione varia un po' le aperture
      // con il rumore servono i punteggi esatti di tutte le mosse (finestra piena); senza, basta la migliore
      const ris = cerca(pos, { tempo: (opz && opz.ms) || bot.ms, profondita: bot.p, tutte: rumore > 0 });
      if (!rumore) return uci(ris.mossa);
      let best = null, bv = -Infinity;
      ris.punteggi.forEach(x => { const matto = Math.abs(x.v) > MATTO - 1000; const v = x.v + (matto && bot.rumore < 100 ? 0 : gauss(r) * rumore); if (v > bv) { bv = v; best = x.m; } });
      return uci(best || ris.mossa);
    }

    return { Posizione, INIZIO, BOT, MATTO, cerca, mossaBot, uci, nome, daNome, casuale };
  }

  /* ---------- punti Elo e livelli ---------- */
  const ELO = {
    iniziale: 800,
    // K: quanto si muove il punteggio a ogni partita (di piu' nelle prime 20, quando non si sa ancora quanto sei forte)
    k(partite, elo) { return partite < 20 ? 40 : elo >= 2000 ? 16 : 24; },
    atteso(a, b) { return 1 / (1 + Math.pow(10, (b - a) / 400)); },
    // risultato: 1 vittoria, 0.5 patta, 0 sconfitta -> variazione (arrotondata, mai sotto 100 in tutto)
    variazione(mio, avv, risultato, partite) { const d = Math.round(ELO.k(partite, mio) * (risultato - ELO.atteso(mio, avv))); return Math.max(100 - mio, d); },
    LIVELLI: [
      { min: 0, nome: 'Pedone', ico: '♟' },
      { min: 700, nome: 'Cavallo', ico: '♞' },
      { min: 1000, nome: 'Alfiere', ico: '♝' },
      { min: 1300, nome: 'Torre', ico: '♜' },
      { min: 1600, nome: 'Regina', ico: '♛' },
      { min: 1900, nome: 'Re', ico: '♚' },
      { min: 2200, nome: 'Gran Maestro del Borgo', ico: '☄️' }
    ],
    livello(elo) { const L = ELO.LIVELLI; let i = 0; while (i + 1 < L.length && elo >= L[i + 1].min) i++; const prossimo = L[i + 1] || null; return { i, nome: L[i].nome, ico: L[i].ico, min: L[i].min, prossimo, quota: prossimo ? Math.max(0, Math.min(1, (elo - L[i].min) / (prossimo.min - L[i].min))) : 1 }; }
  };

  B.fabbricaScacchi = fabbricaScacchi;
  B.ScacchiMotore = fabbricaScacchi();
  B.ScacchiMotore.sorgente = fabbricaScacchi.toString();
  B.ScacchiElo = ELO;
})();
