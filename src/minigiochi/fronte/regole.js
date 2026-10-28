/* =====================================================================
   THE BORG - FRONTE DELLA COMETA: le regole (senza grafica).
   Sparatutto a squadre in prima persona nello spirito dei grandi sparatutto
   militari, con un'identita' nostra: la Milizia della Cometa contro i
   Predoni del Cratere. Qui ci sono armi, classi, modalita', mappe, percorsi
   dei bot, colpi, punteggi, la zona di Ultima Luce e i premi.
   E' tutto qui perche' si possa provare da solo (test/fronte.test.mjs) e
   perche' online tutti i telefoni vedano la stessa mappa (stesso seme).
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3 = window.B3 || {};
  const PI = Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* numeri casuali ripetibili: stesso seme, stessa sequenza (anche su telefoni diversi) */
  function caso(seme) {
    let a = (seme >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------- le due squadre ---------- */
  const SQUADRE = [
    { nome: 'Milizia della Cometa', corto: 'Milizia', colore: '#3f8cff', scuro: '#1d3f7a', giacca: 5 },
    { nome: 'Predoni del Cratere', corto: 'Predoni', colore: '#ff5a4a', scuro: '#7a2018', giacca: 7 }
  ];

  /* ---------- armi ----------
     Per i comandi condivisi (comandi-fps.js): cd (secondi tra un colpo e l'altro), cap (caricatore), ris (scorta),
     tRic (ricarica), disp/dispMira (dispersione dal fianco e col mirino), rinc (rinculo), zoom.
     Danno: pieno fino a 'vicino' metri, poi scende fino a 'min' a 'lontano' metri. pallini > 1 = pompa. vel = velocita' del soldato. */
  const ARMI = {
    falco: { nome: 'Falco', tipo: 'Fucile d\'assalto', danno: 26, min: 18, vicino: 28, lontano: 60, cd: 0.1, cap: 30, ris: 150, tRic: 2.0, disp: 0.032, dispMira: 0.006, rinc: 0.016, zoom: 1.5, vel: 1, suono: 'medio' },
    vespa: { nome: 'Vespa', tipo: 'Mitraglietta', danno: 22, min: 12, vicino: 12, lontano: 32, cd: 0.068, cap: 32, ris: 160, tRic: 1.7, disp: 0.042, dispMira: 0.014, rinc: 0.012, zoom: 1.3, vel: 1.08, suono: 'leggero' },
    bufera: { nome: 'Bufera', tipo: 'Fucile a pompa', danno: 17, min: 0, vicino: 7, lontano: 18, pallini: 8, cono: 0.075, cd: 0.85, cap: 6, ris: 36, tRic: 2.6, disp: 0.03, dispMira: 0.02, rinc: 0.06, zoom: 1.2, vel: 1, suono: 'pompa' },
    aquila: { nome: 'Aquila', tipo: 'Fucile di precisione', danno: 105, min: 90, vicino: 80, lontano: 200, cd: 1.25, cap: 5, ris: 25, tRic: 2.8, disp: 0.12, dispMira: 0, rinc: 0.09, zoom: 4, vel: 0.9, suono: 'pesante' },
    tuono: { nome: 'Tuono', tipo: 'Mitragliatrice', danno: 27, min: 20, vicino: 30, lontano: 70, cd: 0.092, cap: 75, ris: 150, tRic: 4.4, disp: 0.045, dispMira: 0.012, rinc: 0.014, zoom: 1.4, vel: 0.88, suono: 'pesante' },
    saetta: { nome: 'Saetta', tipo: 'Fucile a raffica', danno: 31, min: 22, vicino: 32, lontano: 70, raffica: 3, cd: 0.058, pausa: 0.32, cap: 24, ris: 120, tRic: 2.1, disp: 0.026, dispMira: 0.004, rinc: 0.014, zoom: 1.6, vel: 1, suono: 'medio' },
    grillo: { nome: 'Grillo', tipo: 'Pistola', danno: 31, min: 18, vicino: 12, lontano: 35, cd: 0.17, cap: 12, ris: 60, tRic: 1.3, disp: 0.03, dispMira: 0.01, rinc: 0.03, zoom: 1.25, vel: 1.05, suono: 'leggero' }
  };
  const TESTA = 1.5;            // moltiplicatore del colpo alla testa
  const VITA = 100, RIGENERA = { attesa: 4, vel: 30 };   // la vita torna dopo 4 secondi senza colpi
  const CALCIO = { danno: 100, gittata: 1.7, attesa: 1.0 };   // colpo col calcio dell'arma: elimina da vicino

  /* danno di un colpo (di un pallino per la pompa) a una certa distanza */
  function danno(id, dist, testa, rar) {
    const a = ARMI[id]; if (!a) return 0;
    let d = a.danno;
    if (dist > a.vicino) d = dist >= a.lontano ? a.min : a.danno + (a.min - a.danno) * (dist - a.vicino) / (a.lontano - a.vicino);
    d *= (testa ? TESTA : 1) * (RARITA[rar || 0] || RARITA[0]).k;
    return Math.max(0, Math.round(d));
  }

  /* ---------- classi (equipaggiamento di partenza) ---------- */
  const CLASSI = [
    { id: 'assalto', nome: 'Assaltatore', armi: ['falco', 'grillo'], desc: 'Fucile d\'assalto: va bene a ogni distanza' },
    { id: 'incursore', nome: 'Incursore', armi: ['vespa', 'grillo'], desc: 'Mitraglietta e passo svelto: da vicino' },
    { id: 'guastatore', nome: 'Guastatore', armi: ['bufera', 'grillo'], desc: 'Fucile a pompa: nei vicoli e dietro gli angoli' },
    { id: 'tiratore', nome: 'Tiratore', armi: ['aquila', 'grillo'], desc: 'Fucile di precisione: un colpo, un avversario' },
    { id: 'mitragliere', nome: 'Mitragliere', armi: ['tuono', 'grillo'], desc: 'Caricatore enorme, passo pesante' },
    { id: 'raffica', nome: 'Pattugliatore', armi: ['saetta', 'grillo'], desc: 'Raffiche da tre colpi, precise da lontano' }
  ];

  /* rarita' delle armi trovate in Ultima Luce (stessi colori della Cripta) */
  const RARITA = [
    { nome: 'comune', colore: '#d8d8d8', k: 1 },
    { nome: 'rara', colore: '#4aa3ff', k: 1.07 },
    { nome: 'epica', colore: '#b066ff', k: 1.14 },
    { nome: 'leggendaria', colore: '#ffb02e', k: 1.22 }
  ];

  /* ---------- serie di eliminazioni (senza morire) ---------- */
  const SERIE = [
    { n: 3, id: 'gufo', nome: 'Gufo Spia', desc: 'per 25 secondi vedi gli avversari sulla mappa' },
    { n: 5, id: 'pioggia', nome: 'Pioggia di Stelle', desc: 'stelle cadenti dove ci sono piu\' avversari' },
    { n: 8, id: 'cometa', nome: 'Cometa', desc: 'una cometa colpisce tutta la zona degli avversari' }
  ];
  const serieNuove = (prima, dopo) => SERIE.filter(s => prima < s.n && dopo >= s.n);

  /* ---------- modalita' ---------- */
  const MODALITA = {
    scontro: { id: 'scontro', nome: 'Scontro a squadre', corto: 'Scontro', icona: '⚔️', desc: 'Due squadre, vince chi arriva prima al numero di eliminazioni.', tempo: 300, rinascita: 3, squadre: true },
    dominio: { id: 'dominio', nome: 'Dominio dei Lampioni', corto: 'Dominio', icona: '🏮', desc: 'Accendi i tre lampioni con il colore della tua squadra e tienili: ogni lampione acceso fa punti.', tempo: 360, rinascita: 4, limite: 200, squadre: true },
    sigillo: { id: 'sigillo', nome: 'Il Sigillo', corto: 'Sigillo', icona: '💠', desc: 'Una vita per round. Chi attacca piazza il Sigillo della Cometa in A o B, chi difende lo spegne.', tempo: 100, rinascita: 0, vinti: 4, cambio: 3, squadre: true },
    ultima: { id: 'ultima', nome: 'Ultima Luce', corto: 'Ultima Luce', icona: '🌠', desc: 'Tutti contro tutti in una valle enorme. Raccogli armi e corazze, resta nella luce: il buio del Re si stringe.', giocatori: 16, squadre: false }
  };
  const ORDINE = ['scontro', 'dominio', 'sigillo', 'ultima'];
  const limiteScontro = n => n * 6;                       // 4 contro 4 = 24 eliminazioni

  /* Scontro: 0 o 1 = squadra vincitrice, -1 = pareggio, null = si continua */
  function esitoScontro(punti, limite, tempo) {
    if (punti[0] >= limite || punti[1] >= limite) return punti[0] >= limite && punti[1] >= limite ? -1 : punti[0] >= limite ? 0 : 1;
    if (tempo <= 0) return punti[0] === punti[1] ? -1 : punti[0] > punti[1] ? 0 : 1;
    return null;
  }

  /* ---------- Dominio dei Lampioni ----------
     Ogni lampione: { own: squadra che lo tiene (-1 nessuna), cap: chi lo sta prendendo (-1), k: avanzamento 0..1 }.
     dentro = [n squadra 0, n squadra 1] vicini al lampione. Con tutte e due le squadre si blocca;
     con una sola sale (piu' veloce con piu' soldati, al massimo il doppio). Restituisce la squadra che l'ha appena acceso, o -1. */
  const DOMINIO = { raggio: 4, tempo: 6, punti: 1, conquista: 5 };
  function aggLampione(l, dentro, dt) {
    const a = dentro[0] > 0, b = dentro[1] > 0;
    if (a && b) return -1;                                       // conteso: fermo
    if (!a && !b) { l.k = Math.max(0, l.k - dt / (DOMINIO.tempo * 2)); if (l.k === 0) l.cap = -1; return -1; }
    const T = a ? 0 : 1, n = dentro[T];
    if (l.own === T) { l.k = Math.max(0, l.k - dt / DOMINIO.tempo); if (l.k === 0) l.cap = -1; return -1; }
    if (l.cap !== T) { l.cap = T; l.k = 0; }
    l.k += dt / DOMINIO.tempo * Math.min(2, 1 + 0.5 * (n - 1));
    if (l.k >= 1) { l.own = T; l.cap = -1; l.k = 0; return T; }
    return -1;
  }
  /* punti al secondo: uno per ogni lampione acceso */
  const puntiDominio = lampioni => [0, 1].map(t => lampioni.filter(l => l.own === t).length * DOMINIO.punti);
  function esitoDominio(punti, tempo) {
    const L = MODALITA.dominio.limite;
    if (punti[0] >= L || punti[1] >= L) return punti[0] === punti[1] ? -1 : punti[0] > punti[1] ? 0 : 1;
    if (tempo <= 0) return Math.floor(punti[0]) === Math.floor(punti[1]) ? -1 : punti[0] > punti[1] ? 0 : 1;
    return null;
  }

  /* ---------- Il Sigillo (cerca e distruggi) ---------- */
  const SIGILLO = { piazza: 3, spegni: 5, miccia: 35, raggio: 2.2, esplosione: 9 };
  /* chi attacca in un round (0-based): le squadre si scambiano dopo MODALITA.sigillo.cambio round */
  const attaccaNelRound = r => (Math.floor(r / MODALITA.sigillo.cambio) % 2);
  /* o = { attVivi, difVivi, piazzato, esploso, spento, tempo }: 'att', 'dif' o null */
  function esitoSigillo(o) {
    if (o.esploso) return 'att';
    if (o.spento) return 'dif';
    if (o.difVivi <= 0) return 'att';
    if (!o.piazzato && o.attVivi <= 0) return 'dif';
    if (!o.piazzato && o.tempo <= 0) return 'dif';
    return null;
  }
  const fineSigillo = vinti => vinti[0] >= MODALITA.sigillo.vinti ? 0 : vinti[1] >= MODALITA.sigillo.vinti ? 1 : null;

  /* ---------- le mappe delle modalita' a squadre ----------
     Strutture: b = rettangolo (centro x,z, larghezza w, profondita' d, altezza h), c = cilindro (raggio r, altezza h).
     Ogni mappa e' descritta per meta' (lato ovest) e ribaltata intorno al centro: cosi' e' uguale per le due squadre.
     sim: false = sta al centro e non si ribalta. La squadra 0 parte a ovest, la 1 a est. */
  const MAPPE = {
    borgo: {
      id: 'borgo', nome: 'Borgo Vecchio', desc: 'Vicoli, case di pietra e un campanile', AX: 30, AZ: 20, cielo: ['#7fb6e8', '#f6dcb8'], terra: '#b9a582', erba: '#7fa35c',
      meta: [
        { t: 'b', tipo: 'casa', x: -22, z: -14.5, w: 8, d: 6, h: 5.5 },
        { t: 'b', tipo: 'casa', x: -22, z: 14, w: 7, d: 7, h: 5 },
        { t: 'b', tipo: 'casa', x: -11.5, z: -16, w: 6, d: 5, h: 4.6 },
        { t: 'b', tipo: 'casa', x: -10, z: 15.5, w: 8, d: 5, h: 5 },
        { t: 'b', tipo: 'torre', x: -15, z: 2, w: 3.2, d: 3.2, h: 10 },
        { t: 'b', tipo: 'muro', x: -16, z: -6.5, w: 6, d: 0.6, h: 2.6 },
        { t: 'b', tipo: 'muro', x: -5.5, z: 8.5, w: 0.6, d: 6, h: 2.6 },
        { t: 'b', tipo: 'muretto', x: -24.5, z: 4, w: 0.6, d: 5, h: 1.0 },
        { t: 'b', tipo: 'muretto', x: -8, z: -4, w: 4, d: 0.6, h: 1.0 },
        { t: 'b', tipo: 'carro', x: -19, z: 8.5, w: 3.2, d: 1.6, h: 1.6 },
        { t: 'b', tipo: 'bancarella', x: -5, z: -11.5, w: 3, d: 1.6, h: 2.4 },
        { t: 'b', tipo: 'cassa', x: -12, z: -8.5, w: 1.4, d: 1.4, h: 1.2 },
        { t: 'b', tipo: 'cassa', x: -27, z: -6, w: 1.4, d: 1.4, h: 1.2 },
        { t: 'b', tipo: 'casse', x: -27, z: 9, w: 1.6, d: 1.6, h: 2.2 },
        { t: 'b', tipo: 'casse', x: -9, z: 2.5, w: 1.6, d: 1.6, h: 2.2 },
        { t: 'c', tipo: 'botte', x: -20, z: -2.5, r: 0.5, h: 1.1 },
        { t: 'c', tipo: 'botte', x: -3.5, z: 4, r: 0.5, h: 1.1 },
        { t: 'c', tipo: 'albero', x: -27, z: -17.5, r: 0.45, h: 6 },
        { t: 'c', tipo: 'albero', x: -15.5, z: 10, r: 0.45, h: 6 },
        { t: 'b', tipo: 'muretto', x: -3.6, z: 0, w: 0.6, d: 3.4, h: 1.0 },
        { t: 'c', tipo: 'lampione', x: 0, z: 0, r: 0.22, h: 4.2, sim: false },
        { t: 'b', tipo: 'muretto', x: 0, z: -12, w: 4, d: 0.6, h: 1.0, sim: false },
        { t: 'b', tipo: 'muretto', x: 0, z: 12, w: 4, d: 0.6, h: 1.0, sim: false }
      ],
      lampioni: [{ x: -19, z: 2 }, { x: 0, z: 0 }, { x: 19, z: -2 }],
      siti: [{ id: 'A', x: 15.5, z: -11.5 }, { id: 'B', x: 17, z: 10 }]
    },
    cava: {
      id: 'cava', nome: 'Cava della Cometa', desc: 'Rocce, binari e il frammento della cometa', AX: 30, AZ: 20, cielo: ['#e8a273', '#ffe4c2'], terra: '#c7a07a', erba: '#a7835c',
      meta: [
        { t: 'c', tipo: 'roccia', x: -20, z: -10, r: 2.2, h: 3.2 },
        { t: 'c', tipo: 'roccia', x: -13, z: 7, r: 1.8, h: 2.4 },
        { t: 'c', tipo: 'roccia', x: -6, z: -13, r: 2.6, h: 4.2 },
        { t: 'c', tipo: 'roccia', x: -25, z: 13, r: 1.4, h: 1.2 },
        { t: 'c', tipo: 'roccia', x: -9, z: 15.5, r: 2.0, h: 3.0 },
        { t: 'b', tipo: 'capanno', x: -19, z: 15.5, w: 6, d: 4, h: 3.6 },
        { t: 'b', tipo: 'silo', x: -10.5, z: -3, w: 2.6, d: 2.6, h: 7 },
        { t: 'b', tipo: 'carrello', x: -7.5, z: 5, w: 1.2, d: 2.0, h: 1.3 },
        { t: 'b', tipo: 'carrello', x: -26, z: -2.5, w: 1.2, d: 2.0, h: 1.3 },
        { t: 'b', tipo: 'impalcatura', x: -3.5, z: -7, w: 4, d: 0.8, h: 3 },
        { t: 'c', tipo: 'cristallo', x: -13, z: -16, r: 0.7, h: 2.2 },
        { t: 'c', tipo: 'cristallo', x: -16, z: -1, r: 0.6, h: 1.8 },
        { t: 'b', tipo: 'sacchi', x: -22, z: 2.5, w: 0.8, d: 4, h: 1.0 },
        { t: 'b', tipo: 'sacchi', x: -4, z: 11.5, w: 4, d: 0.8, h: 1.0 },
        { t: 'b', tipo: 'cassa', x: -16, z: -6.5, w: 1.4, d: 1.4, h: 1.2 },
        { t: 'b', tipo: 'casse', x: -27.5, z: 7, w: 1.6, d: 1.6, h: 2.2 },
        { t: 'c', tipo: 'frammento', x: 0, z: 0, r: 2.2, h: 1.5, sim: false }
      ],
      lampioni: [{ x: -18, z: -4 }, { x: 0, z: 7 }, { x: 18, z: 4 }],
      siti: [{ id: 'A', x: 17, z: -11 }, { id: 'B', x: 15, z: 9 }]
    }
  };
  const ELENCO_MAPPE = ['borgo', 'cava'];
  // dove si nasce: ogni squadra sul suo lato, file di punti dietro le coperture
  function rinascite(mp, team) {
    const s = team ? 1 : -1, out = [];
    for (let i = 0; i < 8; i++) out.push({ x: s * (mp.AX - 2.5 - (i % 2) * 1.6), z: (i - 3.5) * 3.2 * s, yaw: s < 0 ? PI / 2 : -PI / 2 });
    return out.filter(p => liberoIn(strutture(mp), mp.AX, mp.AZ, p.x, p.z, 0.6));
  }
  /* tutte le strutture di una mappa (meta' + ribaltata). Memorizzate. */
  const cacheS = new WeakMap();
  function strutture(mp) {
    if (mp.lista) return mp.lista;
    if (cacheS.has(mp)) return cacheS.get(mp);
    const out = [];
    mp.meta.forEach(s => { out.push(Object.assign({}, s)); if (s.sim !== false) out.push(Object.assign({}, s, { x: -s.x, z: -s.z })); });
    out.forEach((s, i) => { s.i = i; limiti(s); });
    cacheS.set(mp, out); return out;
  }
  function limiti(s) {
    if (s.t === 'b') { s.x0 = s.x - s.w / 2; s.x1 = s.x + s.w / 2; s.z0 = s.z - s.d / 2; s.z1 = s.z + s.d / 2; }
    else { s.x0 = s.x - s.r; s.x1 = s.x + s.r; s.z0 = s.z - s.r; s.z1 = s.z + s.r; }
    return s;
  }

  /* ---------- Ultima Luce: la valle, il bottino e la zona ---------- */
  const ULTIMA = { A: 75, fasi: [
    { attesa: 50, chiude: 40, r: 48, danno: 2 },
    { attesa: 40, chiude: 35, r: 30, danno: 4 },
    { attesa: 35, chiude: 30, r: 17, danno: 7 },
    { attesa: 30, chiude: 25, r: 8, danno: 11 },
    { attesa: 20, chiude: 25, r: 0, danno: 16 }
  ], r0: 106, corazza: 100 };
  function mappaUltima(seme) {
    const R = caso(seme ^ 0x2f6b9e1d), A = ULTIMA.A, out = [], villaggi = [];
    // si aggiunge solo se non tocca niente (con un po' di spazio per passare)
    const prova = (s, gap) => {
      const c = limiti(Object.assign({ i: out.length }, s));
      if (c.x0 < -A + 1 || c.x1 > A - 1 || c.z0 < -A + 1 || c.z1 > A - 1) return null;
      for (const q of out) {
        if (c.x1 + gap <= q.x0 || q.x1 + gap <= c.x0 || c.z1 + gap <= q.z0 || q.z1 + gap <= c.z0) continue;
        if (c.t === 'b' && q.t === 'b') return null;
        if (c.t === 'c' && q.t === 'c') { if (Math.hypot(c.x - q.x, c.z - q.z) < c.r + q.r + gap) return null; continue; }
        const box = c.t === 'b' ? c : q, cer = c.t === 'b' ? q : c; if (distBox(box, cer.x, cer.z) < cer.r + gap) return null;
      }
      out.push(c); return c;
    };
    const f1 = v => +v.toFixed(1);
    // villaggi lontani tra loro
    for (let g = 0; g < 400 && villaggi.length < 7; g++) {
      const x = (R() * 2 - 1) * (A - 16), z = (R() * 2 - 1) * (A - 16);
      if (villaggi.every(v => Math.hypot(v.x - x, v.z - z) > 34)) villaggi.push({ x: f1(x), z: f1(z), nome: NOMI_VILLAGGI[villaggi.length] });
    }
    villaggi.forEach(v => {
      const n = 4 + Math.floor(R() * 3), giro = R() * PI * 2;
      for (let i = 0; i < n; i++) {
        const a = giro + i / n * PI * 2 + (R() - 0.5) * 0.4, d = 8 + R() * 4, w = 5 + Math.round(R() * 3), dd = 5 + Math.round(R() * 3);
        prova({ t: 'b', tipo: R() < 0.2 ? 'torre' : 'casa', x: f1(v.x + Math.cos(a) * d), z: f1(v.z + Math.sin(a) * d), w, d: dd, h: 4 + Math.round(R() * 2) }, 2.2);
      }
      for (let i = 0; i < 7; i++) {
        const a = R() * PI * 2, d = 2 + R() * 13, x = f1(v.x + Math.cos(a) * d), z = f1(v.z + Math.sin(a) * d), k = R();
        if (k < 0.35) prova({ t: 'b', tipo: 'cassa', x, z, w: 1.4, d: 1.4, h: 1.2 }, 1.4);
        else if (k < 0.6) prova({ t: 'c', tipo: 'botte', x, z, r: 0.5, h: 1.1 }, 1.4);
        else if (k < 0.8) { const lungo = R() < 0.5; prova({ t: 'b', tipo: 'muretto', x, z, w: lungo ? 4 : 0.6, d: lungo ? 0.6 : 4, h: 1.0 }, 1.4); }
        else prova({ t: 'b', tipo: 'carro', x, z, w: 3.2, d: 1.6, h: 1.6 }, 1.4);
      }
    });
    // boschi e rocce fuori dai villaggi
    for (let i = 0, g = 0; i < 110 && g < 2000; g++) {
      const x = f1((R() * 2 - 1) * (A - 3)), z = f1((R() * 2 - 1) * (A - 3));
      if (villaggi.some(v => Math.hypot(v.x - x, v.z - z) < 15)) continue;
      const roccia = R() < 0.22, r = roccia ? +(0.8 + R() * 1.8).toFixed(2) : 0.45, h = roccia ? +(0.9 + R() * 2.6).toFixed(1) : 6 + Math.round(R() * 3);
      if (prova({ t: 'c', tipo: roccia ? 'roccia' : 'albero', x, z, r, h }, 1.2)) i++;
    }
    return { id: 'ultima', nome: 'Valle della Cometa', AX: A, AZ: A, cielo: ['#6a8fd0', '#ffd7a8'], terra: '#9db36a', erba: '#86a85a', lista: out, villaggi, seme };
  }
  const NOMI_VILLAGGI = ['Pietralunga', 'Borgo Lucciola', 'Mulino Basso', 'Campo dei Gufi', 'Fonte Chiara', 'Rocca Spenta', 'Le Casette'];
  const distBox = (s, x, z) => { const cx = clamp(x, s.x0, s.x1), cz = clamp(z, s.z0, s.z1); return Math.hypot(x - cx, z - cz); };

  /* bottino sparso nella valle: soprattutto nei villaggi, qualcosa nei boschi */
  const ARMI_BOTTINO = ['falco', 'vespa', 'bufera', 'aquila', 'tuono', 'saetta', 'grillo'];
  function bottinoUltima(mp) {
    const R = caso(mp.seme ^ 0x7a3c11), out = [], lista = mp.lista;
    const pezzo = (x, z) => {
      const k = R(); let o;
      if (k < 0.5) { const r = R(), rar = r < 0.5 ? 0 : r < 0.8 ? 1 : r < 0.95 ? 2 : 3; o = { tipo: 'arma', arma: ARMI_BOTTINO[Math.floor(R() * ARMI_BOTTINO.length)], rar }; }
      else if (k < 0.72) o = { tipo: 'corazza', n: R() < 0.7 ? 50 : 100 };
      else if (k < 0.9) o = { tipo: 'fiala', n: 50 };
      else o = { tipo: 'granata', n: 1 };
      o.id = out.length; o.x = +x.toFixed(1); o.z = +z.toFixed(1); out.push(o);
    };
    const ok = (x, z) => liberoIn(lista, mp.AX, mp.AZ, x, z, 0.7) && out.every(o => Math.hypot(o.x - x, o.z - z) > 1.6);
    mp.villaggi.forEach(v => { for (let i = 0, g = 0; i < 14 && g < 200; g++) { const a = R() * PI * 2, d = R() * 16, x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d; if (ok(x, z)) { pezzo(x, z); i++; } } });
    for (let i = 0, g = 0; i < 40 && g < 800; g++) { const x = (R() * 2 - 1) * (mp.AX - 4), z = (R() * 2 - 1) * (mp.AZ - 4); if (ok(x, z)) { pezzo(x, z); i++; } }
    return out;
  }
  /* punti di partenza in Ultima Luce: sparsi, lontani tra loro */
  function partenzeUltima(mp, n, seme) {
    const R = caso((seme || mp.seme) ^ 0x51ed27), out = [];
    for (let g = 0; g < 4000 && out.length < n; g++) {
      const x = (R() * 2 - 1) * (mp.AX - 8), z = (R() * 2 - 1) * (mp.AZ - 8);
      const dmin = g < 2500 ? 26 : 14;
      if (liberoIn(mp.lista, mp.AX, mp.AZ, x, z, 0.8) && out.every(p => Math.hypot(p.x - x, p.z - z) > dmin)) out.push({ x: +x.toFixed(1), z: +z.toFixed(1), yaw: +(R() * PI * 2).toFixed(2) });
    }
    return out;
  }
  /* i cerchi della zona: ognuno dentro il precedente (stesso seme = stessa zona per tutti) */
  function cerchiZona(mp) {
    const R = caso(mp.seme ^ 0x1b873593), out = [{ x: 0, z: 0, r: ULTIMA.r0 }];
    ULTIMA.fasi.forEach(f => {
      const p = out[out.length - 1], spazio = Math.max(0, p.r - f.r), a = R() * PI * 2, d = R() * spazio * 0.8;
      let x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      x = clamp(x, -mp.AX + f.r * 0.5, mp.AX - f.r * 0.5); z = clamp(z, -mp.AZ + f.r * 0.5, mp.AZ - f.r * 0.5);
      if (Math.hypot(x - p.x, z - p.z) > spazio) { x = p.x; z = p.z; }
      out.push({ x: +x.toFixed(2), z: +z.toFixed(2), r: f.r });
    });
    return out;
  }
  /* la zona al tempo t (secondi dall'inizio): { x, z, r, fase, prossima: {x,z,r}, tra (secondi al prossimo cambio), chiude, danno } */
  function zona(cerchi, t) {
    let t0 = 0;
    for (let i = 0; i < ULTIMA.fasi.length; i++) {
      const f = ULTIMA.fasi[i], a = cerchi[i], b = cerchi[i + 1];
      if (t < t0 + f.attesa) return { x: a.x, z: a.z, r: a.r, fase: i, prossima: b, tra: t0 + f.attesa - t, chiude: false, danno: i ? ULTIMA.fasi[i - 1].danno : 1 };
      t0 += f.attesa;
      if (t < t0 + f.chiude) { const k = (t - t0) / f.chiude; return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, r: a.r + (b.r - a.r) * k, fase: i, prossima: b, tra: t0 + f.chiude - t, chiude: true, danno: f.danno }; }
      t0 += f.chiude;
    }
    const u = cerchi[cerchi.length - 1]; return { x: u.x, z: u.z, r: u.r, fase: ULTIMA.fasi.length, prossima: u, tra: 0, chiude: false, danno: ULTIMA.fasi[ULTIMA.fasi.length - 1].danno };
  }
  const fuoriZona = (z, x, y) => Math.hypot(x - z.x, y - z.z) > z.r;

  /* ---------- spazio libero e movimento ---------- */
  function liberoIn(lista, AX, AZ, x, z, r) {
    if (Math.abs(x) > AX - r || Math.abs(z) > AZ - r) return false;
    for (let i = 0; i < lista.length; i++) {
      const s = lista[i]; if (x < s.x0 - r || x > s.x1 + r || z < s.z0 - r || z > s.z1 + r) continue;
      if (s.t === 'b') { if (distBox(s, x, z) < r) return false; }
      else if ((x - s.x) * (x - s.x) + (z - s.z) * (z - s.z) < (r + s.r) * (r + s.r)) return false;
    }
    return true;
  }

  /* ---------- colpi: raggio contro strutture e soldati ----------
     o = origine {x,y,z}, d = direzione normalizzata {x,y,z}. Restituisce la distanza del primo ostacolo (o max). */
  function raggioBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    let tmin = -Infinity, tmax = Infinity;
    const asse = (o, d, a, b) => {
      if (Math.abs(d) < 1e-9) return o >= a && o <= b;
      let t1 = (a - o) / d, t2 = (b - o) / d; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; }
      if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; return tmin <= tmax;
    };
    if (!asse(ox, dx, x0, x1) || !asse(oy, dy, y0, y1) || !asse(oz, dz, z0, z1)) return Infinity;
    if (tmax < 0) return Infinity;
    return tmin >= 0 ? tmin : 0;
  }
  function raggioCil(ox, oy, oz, dx, dy, dz, cx, cz, r, h) {
    let best = Infinity;
    const px = ox - cx, pz = oz - cz, a = dx * dx + dz * dz, b = 2 * (px * dx + pz * dz), c = px * px + pz * pz - r * r;
    if (c <= 0 && oy >= 0 && oy <= h) return 0;
    if (a > 1e-9) { const D = b * b - 4 * a * c; if (D >= 0) { const t = (-b - Math.sqrt(D)) / (2 * a); if (t >= 0) { const y = oy + dy * t; if (y >= 0 && y <= h) best = t; } } }
    if (Math.abs(dy) > 1e-9) { const t = (h - oy) / dy; if (t >= 0 && t < best) { const x = px + dx * t, z = pz + dz * t; if (x * x + z * z <= r * r) best = t; } }
    return best;
  }
  function ostacolo(lista, o, d, max) {
    let best = max;
    const ex = o.x + d.x * max, ez = o.z + d.z * max, bx0 = Math.min(o.x, ex), bx1 = Math.max(o.x, ex), bz0 = Math.min(o.z, ez), bz1 = Math.max(o.z, ez);
    for (let i = 0; i < lista.length; i++) {
      const s = lista[i]; if (s.x1 < bx0 || s.x0 > bx1 || s.z1 < bz0 || s.z0 > bz1) continue;
      const t = s.t === 'b' ? raggioBox(o.x, o.y, o.z, d.x, d.y, d.z, s.x0, 0, s.z0, s.x1, s.h, s.z1) : raggioCil(o.x, o.y, o.z, d.x, d.y, d.z, s.x, s.z, s.r, s.h);
      if (t < best) best = t;
    }
    return best;
  }
  /* sagoma di un soldato: corpo e testa (alt = altezza: in piedi 1.8, accovacciato 1.3, a terra 0.6) */
  const SAGOMA = { r: 0.34, testa: 0.38 };
  function colpisceSoldato(o, d, s, max) {
    const alt = s.alt || 1.8, rr = SAGOMA.r, rt = SAGOMA.testa;
    const tc = raggioBox(o.x, o.y, o.z, d.x, d.y, d.z, s.x - rr, (s.y || 0), s.z - rr, s.x + rr, (s.y || 0) + alt - rt, s.z + rr);
    const tt = raggioBox(o.x, o.y, o.z, d.x, d.y, d.z, s.x - 0.24, (s.y || 0) + alt - rt, s.z - 0.24, s.x + 0.24, (s.y || 0) + alt, s.z + 0.24);
    const t = Math.min(tc, tt); if (t > max) return null;
    return { t, testa: tt <= tc };
  }
  /* il colpo: il primo soldato prima di un muro. soldati = [{x,y,z,alt,...}] (escluso chi spara) */
  function colpo(lista, o, d, max, soldati) {
    const muro = ostacolo(lista, o, d, max); let best = null;
    for (const s of soldati) { const c = colpisceSoldato(o, d, s, muro); if (c && (!best || c.t < best.t)) best = { t: c.t, testa: c.testa, chi: s }; }
    return best || { t: muro, chi: null, muro: muro < max };
  }
  /* si vedono? (dagli occhi di a al petto/testa di b) */
  function vista(lista, a, b) {
    const o = { x: a.x, y: a.y, z: a.z }, dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
    if (L < 0.01) return true;
    return ostacolo(lista, o, { x: dx / L, y: dy / L, z: dz / L }, L) >= L - 0.05;
  }
  const direzione = (yaw, pitch) => ({ x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) });

  /* ---------- percorsi dei bot (griglia e A*) ---------- */
  function griglia(mp, passo, r) {
    passo = passo || 1; r = r === undefined ? 0.5 : r;
    const lista = strutture(mp), W = Math.floor(2 * mp.AX / passo), H = Math.floor(2 * mp.AZ / passo), b = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = -mp.AX + (i + 0.5) * passo, z = -mp.AZ + (j + 0.5) * passo; b[j * W + i] = liberoIn(lista, mp.AX, mp.AZ, x, z, r) ? 0 : 1; }
    return { W, H, passo, AX: mp.AX, AZ: mp.AZ, b };
  }
  const cella = (g, x, z) => [clamp(Math.floor((x + g.AX) / g.passo), 0, g.W - 1), clamp(Math.floor((z + g.AZ) / g.passo), 0, g.H - 1)];
  const centro = (g, i, j) => ({ x: -g.AX + (i + 0.5) * g.passo, z: -g.AZ + (j + 0.5) * g.passo });
  const bloccata = (g, i, j) => i < 0 || j < 0 || i >= g.W || j >= g.H || g.b[j * g.W + i] === 1;
  // cella libera piu' vicina (se il punto e' dentro un ostacolo)
  function liberaVicina(g, i, j) {
    if (!bloccata(g, i, j)) return [i, j];
    for (let k = 1; k < 12; k++) for (let a = -k; a <= k; a++) for (const [x, y] of [[i + a, j - k], [i + a, j + k], [i - k, j + a], [i + k, j + a]]) if (!bloccata(g, x, y)) return [x, y];
    return null;
  }
  function percorso(g, da, a, maxNodi) {
    const s0 = liberaVicina(g, ...cella(g, da.x, da.z)), s1 = liberaVicina(g, ...cella(g, a.x, a.z)); if (!s0 || !s1) return null;
    const W = g.W, N = W * g.H, st = s0[1] * W + s0[0], fi = s1[1] * W + s1[0];
    if (st === fi) return [{ x: a.x, z: a.z }];
    const gs = new Float32Array(N).fill(Infinity), da0 = new Int32Array(N).fill(-1), chiuso = new Uint8Array(N);
    const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; const q = heap[p]; heap[p] = heap[i]; heap[i] = q; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; const q = heap[m]; heap[m] = heap[i]; heap[i] = q; i = m; } } return top; };
    const hx = s1[0], hz = s1[1], h = k => { const dx = Math.abs(k % W - hx), dz = Math.abs(((k / W) | 0) - hz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    gs[st] = 0; push(st, h(st)); let nodi = 0, trovato = false;
    while (heap.length) {
      const [, k] = pop(); if (chiuso[k]) continue; chiuso[k] = 1;
      if (k === fi) { trovato = true; break; }
      if (++nodi > (maxNodi || 60000)) break;
      const i = k % W, j = (k / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (bloccata(g, ni, nj)) continue;
        if (di && dj && (bloccata(g, i + di, j) || bloccata(g, i, j + dj))) continue;   // niente angoli tagliati
        const nk = nj * W + ni, c = gs[k] + (di && dj ? 1.414 : 1); if (c < gs[nk]) { gs[nk] = c; da0[nk] = k; push(nk, c + h(nk)); }
      }
    }
    if (!trovato) return null;
    const celle = []; for (let k = fi; k !== -1; k = da0[k]) celle.push(k); celle.reverse();
    // si tengono solo i punti dove cambia direzione, saltando quelli in linea retta libera
    const pt = celle.map(k => centro(g, k % W, (k / W) | 0)); pt[pt.length - 1] = { x: a.x, z: a.z };
    const out = []; let cur = 0;
    while (cur < pt.length - 1) { let nx = pt.length - 1; while (nx > cur + 1 && !lineaLibera(g, pt[cur], pt[nx])) nx--; out.push(pt[nx]); cur = nx; }
    return out;
  }
  function lineaLibera(g, a, b) {
    const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / (g.passo * 0.45)));
    for (let k = 1; k < n; k++) { const x = a.x + (b.x - a.x) * k / n, z = a.z + (b.z - a.z) * k / n, [i, j] = cella(g, x, z); if (bloccata(g, i, j)) return false; }
    return true;
  }

  /* ---------- grado del giocatore (punti esperienza) ---------- */
  const XP = { elimina: 100, testa: 25, assist: 40, conquista: 150, piazza: 200, spegni: 200, vittoria: 500, partita: 200, posto: 60 };
  const GRADI = [
    ['Recluta', 0], ['Soldato', 1000], ['Caporale', 3000], ['Sergente', 6500], ['Maresciallo', 11000], ['Tenente', 17000],
    ['Capitano', 25000], ['Maggiore', 35000], ['Colonnello', 48000], ['Generale della Cometa', 65000]
  ];
  function grado(xp) {
    let i = 0; while (i + 1 < GRADI.length && xp >= GRADI[i + 1][1]) i++;
    const prossimo = GRADI[i + 1] ? GRADI[i + 1][1] : null;
    return { n: i + 1, nome: GRADI[i][0], xp, da: GRADI[i][1], a: prossimo, k: prossimo ? (xp - GRADI[i][1]) / (prossimo - GRADI[i][1]) : 1 };
  }

  /* ---------- premio in Starlight (per B.Eco.premioGioco) ----------
     o = { modo, vinto, pareggio, posto, giocatori, online }: da 0.6 (partecipazione) a 1.6 (vittoria in Ultima Luce) */
  function premio(o) {
    let k;
    if (o.modo === 'ultima') { const n = o.giocatori || 16, p = o.posto || n; k = p === 1 ? 1.6 : p <= 3 ? 1.2 : p <= n / 2 ? 0.9 : 0.6; }
    else k = o.vinto ? 1.4 : o.pareggio ? 0.9 : 0.6;
    return +(k * (o.online ? 1.2 : 1)).toFixed(2);
  }

  /* ---------- bot: livelli ---------- */
  const LIVELLI = [
    { nome: 'Recluta', reaz: 0.75, err: 0.075, segue: 3.5, vel: 0.82, vista: 34, fuoco: 0.55 },
    { nome: 'Veterano', reaz: 0.42, err: 0.045, segue: 6, vel: 0.92, vista: 45, fuoco: 0.75 },
    { nome: 'Élite', reaz: 0.24, err: 0.026, segue: 9, vel: 1, vista: 60, fuoco: 0.95 }
  ];

  B.FronteRegole = {
    caso, SQUADRE, ARMI, TESTA, VITA, RIGENERA, CALCIO, danno, CLASSI, RARITA, SERIE, serieNuove,
    MODALITA, ORDINE, limiteScontro, esitoScontro, DOMINIO, aggLampione, puntiDominio, esitoDominio,
    SIGILLO, attaccaNelRound, esitoSigillo, fineSigillo,
    MAPPE, ELENCO_MAPPE, rinascite, strutture, ULTIMA, mappaUltima, bottinoUltima, partenzeUltima, cerchiZona, zona, fuoriZona,
    liberoIn, ostacolo, colpisceSoldato, colpo, vista, direzione, SAGOMA, griglia, cella, percorso, lineaLibera,
    XP, GRADI, grado, premio, LIVELLI
  };
})();
