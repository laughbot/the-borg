/* =====================================================================
   La Cripta del Re senza Luce: PROGRESSI E BOTTINO (solo logica, niente grafica)
   Livelli del personaggio, sale superate, armi ed equipaggiamento con rarita',
   munizioni (scorta nel borgo e zaino in Cripta), granate, casse e medagliette.
   Tutto passa da qui (B3.CriptaDati): quando arrivera' il server bastera' spostare
   queste funzioni li', senza toccare il gioco. Le regole sono in CRIPTA-DEL-RE.md.
   ===================================================================== */
(function () {
  'use strict';
  const B = (typeof window !== 'undefined' && window.B3) || (globalThis.B3 = globalThis.B3 || {});

  /* ---------- numeri del gioco ---------- */
  const NUM_SALE = 14;
  const LIV_MAX = 30, LIV_PER_SALA = 3, SALE_CON_LIVELLI = 10;
  // rarita' (come in Destiny, piu' una nostra): il colore e quanto pesa sul danno e sulle statistiche
  const RARITA = [
    { k: 'comune', nome: 'Comune', col: '#c9c4b8', danno: 1.00 },
    { k: 'rara', nome: 'Rara', col: '#5b9cf0', danno: 1.06 },
    { k: 'epica', nome: 'Epica', col: '#b06af0', danno: 1.12 },
    { k: 'leggendaria', nome: 'Leggendaria', col: '#e2b24f', danno: 1.20 },
    { k: 'stellare', nome: 'Stellare', col: '#7fe8ff', danno: 1.20 }
  ];
  // probabilita' di ogni rarita' per oggetto (in percento): cassa normale e cassa del boss
  const PROB = { normale: [50, 30, 14, 5, 1], boss: [25, 35, 25, 12, 3] };
  const PIETA = 12;                                   // dopo 12 casse senza leggendaria la prossima e' almeno leggendaria
  const DOPPIONE = [2, 5, 12, 30, 80];                // Starlight per un oggetto gia' posseduto, per rarita'
  // munizioni: primarie (bianche), speciali (verdi), pesanti (viola)
  const MUN = {
    p: { nome: 'Primarie', col: '#efe7d2', scorta: 900, zaino: 360, pacco: 60, prezzo: 10 },
    s: { nome: 'Speciali', col: '#7fe08a', scorta: 90, zaino: 36, pacco: 6, prezzo: 15 },
    h: { nome: 'Pesanti', col: '#b98cff', scorta: 24, zaino: 9, pacco: 2, prezzo: 25 }
  };
  const TIPI_MUN = ['p', 's', 'h'];
  const GRANATE_MAX = 2;

  /* ---------- armi ----------
     Le statistiche sono quelle di comandi-fps.js (cd, raffica, cap, tRic, dispersione, rinculo, zoom).
     mun: tipo di munizioni (null = infinite). pallini: colpi per sparo (fucile a pompa). esplode: raggio e danno.
     base: le hanno tutti; bottino: si trovano solo nelle casse; stellare: una sola equipaggiata. */
  const ARMI = {
    lucciola: { nome: 'Lucciola', tipo: 'pistola', mun: null, base: 1, mod: 'pistola', cd: 0.24, dmg: 15, disp: 0.006, dispMira: 0.0015, rinc: 0.022, assist: 1, bocca: -0.42, lampo: 0.05, cap: 12, tRic: 1.1, zoom: 1.25,
      desc: 'Pistola di base: colpi infiniti, poco danno. Non resti mai a mani vuote.' },
    tridente: { nome: 'Tridente', tipo: 'fucile a raffica', mun: 'p', base: 1, mod: 'tridente', cd: 0.075, raffica: 3, pausa: 0.36, dmg: 19, disp: 0.002, dispMira: 0.0005, rinc: 0.014, assist: 1, bocca: -0.62, lampo: 0.06, cap: 24, tRic: 1.9, zoom: 1.6,
      desc: 'Fucile a raffica da 3 colpi, preciso a media distanza.' },
    rondine: { nome: 'Rondine', tipo: 'fucile automatico', mun: 'p', mod: 'rondine', cd: 0.11, dmg: 12, disp: 0.008, dispMira: 0.002, rinc: 0.012, assist: 1, bocca: -0.62, lampo: 0.07, cap: 32, tRic: 1.6, zoom: 1.3,
      desc: 'Automatico, facile da usare, buono contro gli Striscianti.' },
    martello: { nome: 'Martello', tipo: 'cannone a mano', mun: 'p', mod: 'martello', cd: 0.7, dmg: 80, disp: 0, dispMira: 0, rinc: 0.07, assist: 1.4, bocca: -0.56, lampo: 0.11, cap: 6, tRic: 2.1, zoom: 1.45,
      desc: 'Pochi colpi molto forti: perfetto per la testa dei Novizi.' },
    sciame: { nome: 'Sciame', tipo: 'mitraglietta', mun: 'p', mod: 'smg', cd: 0.065, dmg: 8, disp: 0.012, dispMira: 0.006, rinc: 0.008, assist: 1.1, bocca: -0.5, lampo: 0.06, cap: 42, tRic: 1.5, zoom: 1.15,
      desc: 'Velocissima da vicino, poco precisa da lontano.' },
    vedetta: { nome: 'Vedetta', tipo: 'fucile da ricognizione', mun: 'p', mod: 'lungo', cd: 0.28, dmg: 34, disp: 0.003, dispMira: 0.0006, rinc: 0.03, assist: 0.9, bocca: -0.78, lampo: 0.07, cap: 16, tRic: 1.9, zoom: 1.9,
      desc: 'Colpo singolo preciso da lontano, con il mirino lungo.' },
    tuono: { nome: 'Tuono', tipo: 'fucile a pompa', mun: 's', mod: 'pompa', cd: 0.85, dmg: 16, pallini: 9, disp: 0.06, dispMira: 0.05, rinc: 0.09, assist: 1.2, bocca: -0.66, lampo: 0.13, cap: 6, tRic: 2.2, zoom: 1.1,
      desc: 'Fucile a pompa: devastante a due passi, inutile da lontano.' },
    ago: { nome: 'Ago di Stella', tipo: 'fucile di precisione', mun: 's', mod: 'cecchino', cd: 1.0, dmg: 240, disp: 0.02, dispMira: 0, rinc: 0.09, assist: 0.6, bocca: -0.9, lampo: 0.09, cap: 4, tRic: 2.4, zoom: 3.6,
      desc: 'Cecchino: usa il mirino. Fa malissimo ai boss.' },
    cometa: { nome: 'Coda di Cometa', tipo: 'lanciagranate', mun: 's', mod: 'lanciagranate', cd: 0.9, dmg: 0, esplode: { r: 4, dmg: 220 }, disp: 0.004, dispMira: 0.002, rinc: 0.08, assist: 1, bocca: -0.6, lampo: 0.12, cap: 4, tRic: 2.3, zoom: 1.3,
      desc: 'Lancia granate che esplodono dove colpiscono.' },
    drago: { nome: 'Drago', tipo: 'lanciarazzi', mun: 'h', mod: 'razzi', cd: 1.2, dmg: 0, esplode: { r: 5.5, dmg: 650 }, disp: 0.003, dispMira: 0.001, rinc: 0.12, assist: 1, bocca: -0.8, lampo: 0.16, cap: 1, tRic: 2.6, zoom: 1.35,
      desc: 'Un razzo alla volta, per i nemici grossi e i boss.' },
    tempesta: { nome: 'Tempesta', tipo: 'mitragliatrice', mun: 'h', mod: 'mitra', cd: 0.085, dmg: 26, disp: 0.014, dispMira: 0.006, rinc: 0.012, assist: 1, bocca: -0.72, lampo: 0.08, cap: 60, tRic: 3.2, zoom: 1.25,
      desc: 'Mitragliatrice pesante: tanti colpi forti per ripulire le ondate.' },
    spada: { nome: 'Lama dell\'Alba', tipo: 'spada', mun: 's', mod: 'spada', spada: { r: 3.8, multi: 3, cono: 0.2 }, cd: 0.55, dmg: 210, disp: 0, dispMira: 0, rinc: 0.01, assist: 1, bocca: -0.6, lampo: 0.01, cap: 8, tRic: 2.0, zoom: 1,
      desc: 'Spada: niente mira, colpisce fino a tre nemici davanti a te. Usa le munizioni speciali come energia (8 fendenti, poi si ricarica). Tieni il mirino per parare: prendi meno danni.' },
    cuoreCometa: { nome: 'Cuore di Cometa', tipo: 'automatico stellare', mun: 'p', mod: 'stellare', stellare: 1, cd: 0.1, dmg: 15, disp: 0.007, dispMira: 0.0018, rinc: 0.012, assist: 1, bocca: -0.62, lampo: 0.08, cap: 36, tRic: 1.5, zoom: 1.35,
      perk: 'scia', desc: 'Stellare. Scia di Stelle: ogni nemico che uccidi rimette 6 colpi nel caricatore e aumenta il danno per 5 secondi (fino a 3 volte).' },
    ultimaLanterna: { nome: 'Ultima Lanterna', tipo: 'lanciarazzi stellare', mun: 'h', mod: 'lanterna', stellare: 1, cd: 0.9, dmg: 0, esplode: { r: 5.5, dmg: 560 }, disp: 0.003, dispMira: 0.001, rinc: 0.11, assist: 1, bocca: -0.78, lampo: 0.16, cap: 2, tRic: 2.4, zoom: 1.35,
      perk: 'luce', desc: 'Stellare. Lanterna Viva: due razzi; dove esplodono lasciano per 4 secondi una pozza di luce che cura i compagni.' }
  };
  const BOTTINO_ARMI = ['rondine', 'martello', 'sciame', 'vedetta', 'tuono', 'ago', 'cometa', 'drago', 'tempesta', 'spada'];
  const STELLARI_ARMI = ['cuoreCometa', 'ultimaLanterna'];

  /* ---------- equipaggiamento: un pezzo per parte ----------
     val: il valore per rarita' (comune ... stellare). Ogni stellare ha un potere tutto suo. */
  const PARTI = ['casco', 'armatura', 'guanti', 'scarpe', 'mantello'];
  const EQUIP = {
    casco: { nome: 'Casco', nomi: ['Elmo di Cuoio', 'Elmo del Minatore', 'Celata Lucente', 'Corona del Portatore', 'Elmo della Cometa'],
      dif: [3, 5, 7, 9, 10], stellare: { k: 'occhio', desc: 'La vita torna a salire dopo 1,5 secondi invece di 3.' } },
    armatura: { nome: 'Armatura', nomi: ['Giaco di Maglia', 'Corazza del Borgo', 'Usbergo di Luce', 'Armatura del Portatore', 'Corazza del Cratere'],
      dif: [5, 7, 9, 12, 13], vita: [5, 10, 15, 20, 20], stellare: { k: 'cratere', desc: 'Sotto il 30% di vita subisci metà dei danni.' } },
    guanti: { nome: 'Guanti', nomi: ['Guanti di Tela', 'Guanti da Scavo', 'Manopole Lucenti', 'Mani del Portatore', 'Guanti delle Scintille'],
      ric: [5, 8, 11, 15, 15], gran: [0, 5, 10, 15, 20], stellare: { k: 'scintille', desc: 'Le granate esplodono due volte.' } },
    scarpe: { nome: 'Scarpe', nomi: ['Stivali di Pelle', 'Stivali del Pozzo', 'Calzari Leggeri', 'Passi del Portatore', 'Passi di Cometa'],
      vel: [2, 4, 6, 8, 8], salto: [0, 0, 1, 1, 1], stellare: { k: 'volo', desc: 'In aria tieni premuto il salto per volare fino a 2,5 secondi.' } },
    mantello: { nome: 'Mantello', nomi: ['Mantello di Lana', 'Mantello del Viandante', 'Mantello di Brace', 'Mantello del Portatore', 'Mantello della Notte Chiara'],
      rientro: [1, 2, 3, 4, 5], stellare: { k: 'notte', desc: 'Quando rientri sei invulnerabile per 3 secondi.' } }
  };

  /* ---------- granate (se ne tengono al massimo 2) ---------- */
  const GRANATE = {
    framm: { nome: 'Frammentazione', r: 0, dmg: 160, raggio: 4.5, col: '#ffb35c', desc: 'Esplosione classica.' },
    stordente: { nome: 'Stordente', r: 1, dmg: 70, raggio: 5, stordisce: 3, col: '#9fd8ff', desc: 'Poco danno, ma ferma i nemici per 3 secondi.' },
    luce: { nome: 'Granata di Luce', r: 2, dmg: 230, raggio: 5.5, col: '#fff1a8', desc: 'Grande esplosione di luce.' }
  };

  /* ---------- livelli ---------- */
  const livMaxSala = i => Math.min(LIV_MAX, LIV_PER_SALA * Math.min(i + 1, SALE_CON_LIVELLI));   // i: sala da 0
  function dopoSala(liv, i) { const m = livMaxSala(i); return liv >= m ? liv : Math.min(m, liv + LIV_PER_SALA); }
  // il livello "giusto" per entrare nella sala i: serve a rendere i nemici piu' forti sala dopo sala
  const livAtteso = i => Math.max(1, Math.min(LIV_MAX, LIV_PER_SALA * i));
  const fattoreLiv = L => 1 + 0.035 * (L - 1);       // danno (e vita dei nemici)
  function scalaSala(i) { const L = livAtteso(i); return { liv: L, hp: fattoreLiv(L), dmg: 1 + 0.03 * (L - 1) }; }

  /* ---------- salvataggio ---------- */
  const CHIAVE = 'theborg.cripta.v3', CHIAVE_PROVA = 'theborg.cripta.prova';
  const ls = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };
  function nuovo() {
    return {
      v: 3, livello: 1, completati: {}, nUid: 3,
      armi: [{ u: 'a1', k: 'lucciola', r: 0 }, { u: 'a2', k: 'tridente', r: 0 }], scelta: ['a2', 'a1'],
      pezzi: [], equip: { casco: null, armatura: null, guanti: null, scarpe: null, mantello: null },
      granate: ['framm', 'framm'],
      scorta: { p: 540, s: 54, h: 12 }, zaino: { p: 0, s: 0, h: 0 },
      medaglie: {}, pieta: 0, casse: 0
    };
  }
  // i vecchi progressi (4 incontri) diventano le sale nuove: Soglia 1, Portale 4, Officiante 6, Bruthak 7
  function migra(S, st) {
    try {
      const v2 = st && st.getItem('theborg.raid.v2'); if (!v2) return S;
      const vecchi = JSON.parse(v2) || {}, mappa = { 0: 0, 1: 3, 2: 5, 3: 6 }; let max = -1;
      Object.keys(vecchi).forEach(k => { if (vecchi[k] && mappa[k] !== undefined) max = Math.max(max, mappa[k]); });
      for (let i = 0; i <= max; i++) { S.completati[i] = 1; S.livello = dopoSala(S.livello, i); }
    } catch (e) { }
    return S;
  }
  function pulisci(r) {
    const S = nuovo(); if (!r || typeof r !== 'object') return S;
    const num = (v, d) => typeof v === 'number' && isFinite(v) ? v : d;
    S.livello = Math.max(1, Math.min(LIV_MAX, num(r.livello, 1) | 0));
    if (r.completati && typeof r.completati === 'object') Object.keys(r.completati).forEach(k => { if (r.completati[k] && +k >= 0 && +k < NUM_SALE) S.completati[+k] = 1; });
    S.nUid = Math.max(3, num(r.nUid, 3) | 0);
    if (Array.isArray(r.armi)) { const a = r.armi.filter(x => x && ARMI[x.k] && typeof x.u === 'string').map(x => ({ u: x.u, k: x.k, r: Math.max(0, Math.min(4, num(x.r, 0) | 0)) })); if (a.length) S.armi = a; }
    ['lucciola', 'tridente'].forEach((k, i) => { if (!S.armi.some(a => a.k === k)) S.armi.unshift({ u: 'a' + (i + 1), k, r: 0 }); });   // le armi di base non si perdono mai
    if (Array.isArray(r.scelta)) S.scelta = r.scelta.filter(u => S.armi.some(a => a.u === u)).slice(0, 2);
    while (S.scelta.length < 2) { const a = S.armi.find(x => !S.scelta.includes(x.u)); if (!a) break; S.scelta.push(a.u); }
    if (Array.isArray(r.pezzi)) S.pezzi = r.pezzi.filter(p => p && EQUIP[p.s] && typeof p.u === 'string').map(p => ({ u: p.u, s: p.s, r: Math.max(0, Math.min(4, num(p.r, 0) | 0)) }));
    if (r.equip && typeof r.equip === 'object') PARTI.forEach(s => { const u = r.equip[s]; S.equip[s] = S.pezzi.some(p => p.u === u && p.s === s) ? u : null; });
    if (Array.isArray(r.granate)) S.granate = r.granate.filter(g => GRANATE[g]).slice(0, GRANATE_MAX);
    TIPI_MUN.forEach(t => { S.scorta[t] = Math.max(0, Math.min(MUN[t].scorta, num(r.scorta && r.scorta[t], S.scorta[t]) | 0)); S.zaino[t] = Math.max(0, Math.min(MUN[t].zaino, num(r.zaino && r.zaino[t], 0) | 0)); });
    if (r.medaglie && typeof r.medaglie === 'object') Object.keys(r.medaglie).forEach(k => { if (r.medaglie[k] && +k >= 0 && +k < NUM_SALE) S.medaglie[+k] = 1; });
    S.pieta = Math.max(0, num(r.pieta, 0) | 0); S.casse = Math.max(0, num(r.casse, 0) | 0);
    return S;
  }
  function carica(prova) {
    const st = ls(); let r = null;
    try { r = st ? JSON.parse(st.getItem(prova ? CHIAVE_PROVA : CHIAVE) || 'null') : null; } catch (e) { r = null; }
    if (r) return pulisci(r);
    const S = nuovo(); return prova ? S : migra(S, st);
  }
  function salva(S, prova) { const st = ls(); if (!st) return; try { st.setItem(prova ? CHIAVE_PROVA : CHIAVE, JSON.stringify(S)); } catch (e) { } }

  /* ---------- statistiche del personaggio ---------- */
  const pezzo = (S, s) => S.pezzi.find(p => p.u === S.equip[s]) || null;
  function statistiche(S) {
    const L = S.livello, st = { liv: L, vita: 100 * (1 + 0.03 * (L - 1)), res: 1 - 0.01 * (L - 1), danno: fattoreLiv(L), vel: 1, ric: 1, gran: 1, rientro: 0, salti: 1, poteri: {} };
    let dif = 0;
    PARTI.forEach(s => {
      const p = pezzo(S, s); if (!p) return; const E = EQUIP[s], r = p.r;
      if (E.dif) dif += E.dif[r]; if (E.vita) st.vita += E.vita[r];
      if (E.ric) st.ric *= 1 - E.ric[r] / 100; if (E.gran) st.gran *= 1 + E.gran[r] / 100;
      if (E.vel) st.vel *= 1 + E.vel[r] / 100; if (E.salto && E.salto[r]) st.salti = 2;
      if (E.rientro) st.rientro += E.rientro[r];
      if (r === 4) st.poteri[E.stellare.k] = 1;
    });
    st.res *= 1 - dif / 100; st.dif = dif; st.vita = Math.round(st.vita);
    return st;
  }
  // un'arma del giocatore: le statistiche di base piu' rarita' e livello
  function armaDi(S, u) { const a = S.armi.find(x => x.u === u); if (!a) return null; return { u: a.u, k: a.k, r: a.r, def: ARMI[a.k], molt: RARITA[a.r].danno * fattoreLiv(S.livello) }; }
  const nomeOggetto = o => o.k ? ARMI[o.k].nome : EQUIP[o.s].nomi[o.r];

  /* ---------- armi in mano: due alla volta, al massimo una stellare ---------- */
  function equipaggia(S, u, posto) {
    const a = S.armi.find(x => x.u === u); if (!a) return 'non hai quell\'arma';
    posto = posto ? 1 : 0; const altro = S.scelta[1 - posto];
    if (altro === u) { S.scelta = [S.scelta[1], S.scelta[0]]; return null; }   // scambia i posti
    if (ARMI[a.k].stellare) { const b = S.armi.find(x => x.u === altro); if (b && ARMI[b.k].stellare) return 'puoi portare una sola arma stellare'; }
    S.scelta[posto] = u; return null;
  }
  function indossa(S, u) {
    const p = S.pezzi.find(x => x.u === u); if (!p) return 'non hai quel pezzo';
    S.equip[p.s] = S.equip[p.s] === u ? null : u; return null;
  }

  /* ---------- munizioni ---------- */
  // ricarica lo zaino dalla scorta (tra una sala e l'altra)
  function riempiZaino(S) { TIPI_MUN.forEach(t => { const n = Math.min(MUN[t].zaino - S.zaino[t], S.scorta[t]); if (n > 0) { S.zaino[t] += n; S.scorta[t] -= n; } }); }
  // aggiunge munizioni: prima nello zaino, quello che avanza nella scorta (oltre i massimi si perde)
  function aggiungiMun(S, t, n) {
    const z = Math.min(MUN[t].zaino - S.zaino[t], n); S.zaino[t] += Math.max(0, z); n -= Math.max(0, z);
    const s = Math.min(MUN[t].scorta - S.scorta[t], n); if (s > 0) S.scorta[t] += s;
  }
  // compra un pacco per la scorta: paga chi chiama (spendi(n) -> true se pagato)
  function compra(S, t, spendi) {
    const M = MUN[t]; if (!M) return 'tipo sconosciuto';
    if (S.scorta[t] + M.pacco > M.scorta) return 'scorta piena';
    if (!spendi(M.prezzo)) return 'Starlight insufficienti';
    S.scorta[t] += M.pacco; return null;
  }
  // munizioni lasciate da un nemico che muore (tipo di nemico, numero casuale 0..1)
  function cadutaMun(tipo, boss, caso) {
    const c = caso || Math.random, out = [];
    if (boss) { out.push(['h', 2], ['s', 6], ['p', 60]); return out; }
    const grosso = tipo === 'cavaliere' || tipo === 'cantore';
    if (c() < (grosso ? 0.9 : 0.55)) out.push(['p', 8 + Math.floor(c() * 7) + (grosso ? 10 : 0)]);
    if (c() < (grosso ? 0.35 : 0.12)) out.push(['s', 2 + Math.floor(c() * 2)]);
    if (grosso && c() < 0.22) out.push(['h', 1 + Math.floor(c() * 2)]);
    return out;
  }

  /* ---------- casse ---------- */
  function tiraRarita(S, boss, caso) {
    const c = caso || Math.random, p = PROB[boss ? 'boss' : 'normale'];
    let r = 0, x = c() * 100; for (let i = 0; i < p.length; i++) { if (x < p[i]) { r = i; break; } x -= p[i]; r = i; }
    if (r < 3 && S.pieta >= PIETA - 1) r = 3;   // pieta': garantita
    return r;
  }
  function nuovoUid(S, pre) { S.nUid++; return pre + S.nUid; }
  // apre la cassa della sala i per questo giocatore: modifica S e dice cosa e' uscito
  // o = { boss, sala, caso, premio(molt) -> Starlight dati, prova }
  function apriCassa(S, o) {
    const c = o.caso || Math.random, boss = !!o.boss, R = { oggetti: [], granate: [], mun: {}, stelle: 0, doppioni: 0, medaglia: false, liv: null };
    S.casse++;
    const n = boss ? 2 : 1; let leg = false;
    for (let k = 0; k < n; k++) {
      const r = tiraRarita(S, boss, c); if (r >= 3) leg = true;
      const arma = c() < 0.55;
      if (arma) {
        const pool = r === 4 ? STELLARI_ARMI : BOTTINO_ARMI, key = pool[Math.floor(c() * pool.length)];
        const gia = S.armi.find(a => a.k === key && a.r >= r);
        if (gia) { R.doppioni += DOPPIONE[r]; R.oggetti.push({ k: key, r, doppione: true }); }
        else { const u = nuovoUid(S, 'a'); S.armi.push({ u, k: key, r }); R.oggetti.push({ u, k: key, r }); }
      } else {
        const s = PARTI[Math.floor(c() * PARTI.length)], gia = S.pezzi.find(p => p.s === s && p.r >= r);
        if (gia) { R.doppioni += DOPPIONE[r]; R.oggetti.push({ s, r, doppione: true }); }
        else { const u = nuovoUid(S, 'e'); S.pezzi.push({ u, s, r }); R.oggetti.push({ u, s, r }); if (!S.equip[s]) S.equip[s] = u; }
      }
    }
    S.pieta = leg ? 0 : S.pieta + 1;
    // granate: con il boss sempre, se no quasi una volta su due (se ne tengono al massimo 2)
    const nG = boss ? 1 + (c() < 0.5 ? 1 : 0) : (c() < 0.45 ? 1 : 0);
    for (let k = 0; k < nG; k++) {
      const x = c(), g = x < 0.6 ? 'framm' : x < 0.88 ? 'stordente' : 'luce'; R.granate.push(g);
      if (S.granate.length < GRANATE_MAX) S.granate.push(g);
      else { const i = S.granate.findIndex(h => GRANATE[h].r < GRANATE[g].r); if (i >= 0) S.granate[i] = g; }   // tieni le migliori
    }
    // tante munizioni
    TIPI_MUN.forEach(t => { const q = Math.round(MUN[t].zaino * (boss ? 0.75 : 0.5)); R.mun[t] = q; aggiungiMun(S, t, q); });
    // Starlight (non in prova) e doppioni
    if (!o.prova) { R.stelle = o.premio ? o.premio(boss ? 1.6 : 1) || 0 : 0; if (R.doppioni && o.dona) o.dona(R.doppioni); }
    // medaglietta della sala
    if (o.sala >= 0 && !S.medaglie[o.sala]) { S.medaglie[o.sala] = 1; R.medaglia = true; }
    return R;
  }

  // sala superata: progressi e livelli. Chi gioca con un amico piu' avanti prende il suo salvataggio.
  function salaFatta(S, i) {
    const prima = S.livello; for (let k = 0; k <= i; k++) S.completati[k] = 1;
    S.livello = dopoSala(S.livello, i);
    return { prima, dopo: S.livello };
  }
  // la prima sala non ancora superata (finite tutte, si ricomincia)
  function partenza(S) { let k = 0; while (k < NUM_SALE && S.completati[k]) k++; return k >= NUM_SALE ? 0 : k; }
  // ricomincia da zero: si perdono le sale superate (livello, armi e bottino restano)
  function azzeraSale(S) { S.completati = {}; }

  // modalita' prova: tutte le armi e i pezzi al massimo, il livello scelto
  function tuttoProva(S, liv) {
    S.livello = Math.max(1, Math.min(LIV_MAX, liv | 0));
    Object.keys(ARMI).forEach(k => { if (!S.armi.some(a => a.k === k && a.r >= (ARMI[k].base ? 0 : 3))) S.armi.push({ u: nuovoUid(S, 'a'), k, r: ARMI[k].stellare ? 4 : ARMI[k].base ? 0 : 3 }); });
    PARTI.forEach(s => [3, 4].forEach(r => { if (!S.pezzi.some(p => p.s === s && p.r === r)) S.pezzi.push({ u: nuovoUid(S, 'e'), s, r }); }));
    S.granate = ['luce', 'stordente'];
    TIPI_MUN.forEach(t => { S.scorta[t] = MUN[t].scorta; S.zaino[t] = MUN[t].zaino; });
  }

  B.CriptaDati = {
    NUM_SALE, LIV_MAX, RARITA, PROB, PIETA, DOPPIONE, MUN, TIPI_MUN, ARMI, BOTTINO_ARMI, STELLARI_ARMI, PARTI, EQUIP, GRANATE, GRANATE_MAX,
    livMaxSala, dopoSala, livAtteso, fattoreLiv, scalaSala,
    nuovo, carica, salva, pulisci, statistiche, armaDi, pezzo, nomeOggetto, equipaggia, indossa,
    riempiZaino, aggiungiMun, compra, cadutaMun, tiraRarita, apriCassa, salaFatta, partenza, azzeraSale, tuttoProva
  };
})();
