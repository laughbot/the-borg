/* =====================================================================
   THE BORG 3D - ATTIVITA' DELLA PIAZZA
   - Laghetto da pesca (lato est): sgabelli sulla riva e sul pontile, pesci da collezionare,
     secchio da vendere alla Pescheria del mercatino, Trofeo di pesca a 8 specie
   - Ruota panoramica (angolo nord-est): si sale dalla pedana, un giro completo e si scende
   - Mercatino (fascia nord, davanti ai negozi): 4 banchi degli abitanti. Ognuno compra e
     vende la sua merce: pesci alla Pescheria, mobili e luci ai loro banchi, carte di
     Belinverse 2 al banco Belinverse TCG (prezzo secondo la rarita')
   Il mondo chiama B.costruisciAttivita(ctx) mentre costruisce la piazza; main.js chiama
   B.Attivita.init(app). Tutti i numeri di bilanciamento sono in B.ATTIVITA_CFG.
   DIMOSTRATIVO: gli abitanti sono simulati e i dati restano su questo dispositivo.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, PI = Math.PI, rnd = B.rnd;
  const G = () => window.Gioco;
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* ---------- TABELLA DI BILANCIAMENTO E POSIZIONI ---------- */
  const CF = B.ATTIVITA_CFG = {
    lago: { x: 38, z: 32, rx: 8.5, rz: 6.5 },
    pontile: { x: 38, z0: 33.6, z1: 41.2, w: 1.8, h: 0.28 },
    ruota: { x: 34, z: 3, R: 8, hub: 11.0, cabine: 8, giro: 40, appeso: 2.75 },
    mercato: { z: 5, xs: [-13.5, -6.5, 6.5, 13.5] },
    pesca: { tettoPescheria: Math.round(B.Eco.quota('piazza') * 0.8),   // la piazza ha la sua quota dell'economia (B.ECONOMIA)
            attesa: [2.2, 6.5], finestra: 1.15, trofeo: 8 },
    usato: { quota: 0.55, prezzoEsclusivi: 400 },          // i banchi ti ricomprano i mobili liberi al 55% del negozio
    carte: { C: 8, R: 25, SR: 70, alt: 1000, tetto: Math.round(B.Eco.quota('piazza') * 0.8) },  // banco Belinverse TCG: coins per carta (pacchetto 150 = 6 carte) e massimo al giorno
    annunci: { max: 10, consigliato: 2 }                     // carte in vendita agli amici: quante e prezzo proposto (x valore del banco; Alternative a 1000)
  };
  const RAR = {
    comune:      { nome: 'Comune',      col: '#cfd8dc', peso: 52,  zona: 0.34, vel: 0.9 },
    noncomune:   { nome: 'Non comune',  col: '#8fd18a', peso: 24,  zona: 0.26, vel: 1.15 },
    raro:        { nome: 'Raro',        col: '#6fb4f0', peso: 11,  zona: 0.19, vel: 1.45 },
    epico:       { nome: 'Epico',       col: '#c58bd6', peso: 4,   zona: 0.14, vel: 1.75 },
    leggendario: { nome: 'Leggendario', col: '#f2c76e', peso: 1.2, zona: 0.11, vel: 2.1 },
    rottame:     { nome: 'Curiosità',   col: '#b39a84', peso: 5,   zona: 0.42, vel: 0.7 }
  };
  // quando: null sempre, 'giorno', 'sera' (tramonto o notte), 'notte'
  const SPECIE = [
    { id: 'carpa',     nome: 'Carpa dorata',      rar: 'comune',      col: '#e8a33a', col2: '#f7d98a', motivo: 'scaglie', dim: [20, 45],  prezzo: 6 },
    { id: 'gatto',     nome: 'Pesce gatto',       rar: 'comune',      col: '#6b5a4a', col2: '#c9b79c', motivo: 'baffi',   dim: [25, 60],  prezzo: 7 },
    { id: 'persico',   nome: 'Persico sole',      rar: 'comune',      col: '#4f9a6a', col2: '#f2b544', motivo: 'strisce', dim: [10, 22],  prezzo: 5, forma: 'tondo' },
    { id: 'alborella', nome: 'Alborella',         rar: 'comune',      col: '#9fb3c8', col2: '#ffffff', motivo: 'liscio',  dim: [8, 15],   prezzo: 4 },
    { id: 'trota',     nome: 'Trota arcobaleno',  rar: 'noncomune',   col: '#8aa37a', col2: '#f08fb4', motivo: 'macchie', dim: [25, 55],  prezzo: 15 },
    { id: 'luccio',    nome: 'Luccio',            rar: 'noncomune',   col: '#5e7a3a', col2: '#d9e0a0', motivo: 'macchie', dim: [40, 90],  prezzo: 18, forma: 'lungo' },
    { id: 'koi',       nome: 'Koi bianca e rossa', rar: 'noncomune',  col: '#fbf3ea', col2: '#e0473c', motivo: 'koi',     dim: [30, 60],  prezzo: 20 },
    { id: 'koiblu',    nome: 'Koi drago',         rar: 'raro',        col: '#2f5bd6', col2: '#9fd8ff', motivo: 'koi',     dim: [40, 70],  prezzo: 40 },
    { id: 'lanterna',  nome: 'Pesce lanterna',    rar: 'raro',        col: '#2a2f5c', col2: '#ffe36a', motivo: 'luce',    dim: [10, 20],  prezzo: 45, forma: 'tondo', quando: 'notte' },
    { id: 'anguilla',  nome: 'Anguilla di luna',  rar: 'raro',        col: '#c9c3e6', col2: '#7a6fb8', motivo: 'liscio',  dim: [50, 110], prezzo: 40, forma: 'anguilla', quando: 'sera' },
    { id: 'petalo',    nome: 'Pesce petalo',      rar: 'epico',       col: '#f8bcd4', col2: '#ee8fb6', motivo: 'petali',  dim: [15, 30],  prezzo: 90, quando: 'giorno' },
    { id: 're',        nome: 'Re del Laghetto',   rar: 'leggendario', col: '#f2c76e', col2: '#c8553d', motivo: 'corona',  dim: [90, 150], prezzo: 260 },
    { id: 'stivale',   nome: 'Vecchio stivale',   rar: 'rottame',     col: '#6b4326', col2: '#3a2216', motivo: 'stivale', dim: [28, 34],  prezzo: 1, forma: 'stivale', curiosita: true }
  ];
  const QUANDO = { giorno: 'Solo di giorno', sera: 'Solo al tramonto e di notte', notte: 'Solo di notte' };
  const VENDITORI_FRASI = ['Ciao {nick}! Dai un\'occhiata!', 'Oggi ho delle belle cose', 'Prezzi da amici!', 'Benvenuto al mercatino!'];

  /* ---------- salvataggio ---------- */
  const CH = 'borg_piazza_v1';
  const S = { pesci: {}, secchio: {}, vend: { g: '', c: 0 }, vendC: { g: '', c: 0 }, annunci: [], nAnn: 0, banco: [], merc: { g: '', presi: [] }, trofeo: 0, giri: 0 };
  try { const r = JSON.parse(localStorage.getItem(CH) || 'null'); if (r) Object.assign(S, r); } catch (e) { /* ok */ }
  const salva = () => { try { localStorage.setItem(CH, JSON.stringify(S)); } catch (e) { /* ok */ } };
  const oggi = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function seme(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; }; }
  const toast = t => { const g = G(); if (g) g.emetti('toast', t); };
  const missione = (ev, n) => { if (B.Miss) B.Miss.ev(ev, n); };
  const atmo = () => (G() && G().stato.atmosfera) || 'giorno';

  let app = null;                                   // B.app (main.js)
  const W = {};                                     // riferimenti costruiti nel mondo

  /* =====================================================================
     COSTRUZIONE (chiamata da mondo3d.js)
     ===================================================================== */
  B.costruisciAttivita = function (ctx) {
    W.ctx = ctx;
    costruisciLago(ctx);
    costruisciRuota(ctx);
    costruisciMercato(ctx);
    // voci per la mappa grande (solo nome e ingombro, niente trasparenza)
    ctx.edifici.push({ g: null, x: CF.lago.x, z: CF.lago.z, w: CF.lago.rx * 2, d: CF.lago.rz * 2, nome: 'Laghetto', mappa: 'acqua' });
    ctx.edifici.push({ g: null, x: CF.ruota.x, z: CF.ruota.z, w: 11, d: 3.6, nome: 'Ruota panoramica' });
    ctx.edifici.push({ g: null, x: 0, z: CF.mercato.z + 0.2, w: 33, d: 1.8, nome: 'Mercatino', mappa: 'banchi' });
  };

  /* altezza del suolo (il pontile e' un po' rialzato); null = decide la piazza */
  function altezza(x, z) {
    const P = CF.pontile;
    if (Math.abs(x - P.x) <= P.w / 2 + 0.05 && z >= P.z0 - 0.4 && z <= P.z1) return z > P.z1 - 0.7 ? P.h * (P.z1 - z) / 0.7 : P.h;
    return null;
  }

  /* trave tra due punti (box allungato) */
  const vY = new T.Vector3(0, 1, 0);
  function trave(g, a, b, s, col, lb) {
    const d = new T.Vector3().subVectors(b, a), L = d.length();
    const m = mesh(new T.BoxGeometry(s, L, s), M(col), { lb: lb === undefined ? 0.015 : lb });
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(vY, d.normalize()); g.add(m); return m;
  }
  function insegna(testo, h, o) {
    o = o || {}; const [c0, x0] = B.tela(8, 8); x0.font = 'bold 64px Georgia, serif';
    const w = Math.ceil(x0.measureText(testo).width) + 90, [cv, x] = B.tela(w, 128);
    B.rr(x, 4, 4, w - 8, 120, 22); x.fillStyle = o.fondo || '#6a3f27'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#3a2216'; x.stroke();
    x.strokeStyle = 'rgba(242,199,110,0.85)'; x.lineWidth = 3; B.rr(x, 16, 16, w - 32, 96, 12); x.stroke();
    x.font = 'bold 64px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 8; x.strokeStyle = '#2b180f'; x.strokeText(testo, w / 2, 68); x.fillStyle = o.colore || '#f6d27a'; x.fillText(testo, w / 2, 68);
    const m = new T.Mesh(new T.PlaneGeometry(h * w / 128, h), new T.MeshBasicMaterial({ map: B.tex(cv), transparent: true, side: T.DoubleSide }));
    return m;
  }

  /* ---------- LAGHETTO ---------- */
  function costruisciLago(ctx) {
    const L = CF.lago, P = CF.pontile, sc = ctx.scene, gm = M('#fff').gradientMap;
    const g = new T.Group(); g.position.set(L.x, 0, L.z); sc.add(g); W.gLago = g;
    const ellisse = (sx, sz, col, y, extra) => {
      const m = new T.Mesh(new T.CircleGeometry(1, 56), new T.MeshToonMaterial(Object.assign({ color: new T.Color(col), gradientMap: gm, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, extra || {})));
      m.rotation.x = -PI / 2; m.scale.set(sx, sz, 1); m.position.y = y; m.receiveShadow = true; g.add(m); return m;
    };
    ellisse(L.rx + 2.1, L.rz + 2.1, '#9cc77a', 0.012);                // prato attorno
    ellisse(L.rx + 1.2, L.rz + 1.2, '#d9c8a2', 0.016);                // sabbia della riva
    const acqua = ellisse(L.rx + 0.15, L.rz + 0.15, '#4fa8d6', 0.05, { emissive: new T.Color('#1f7fb3'), emissiveIntensity: 0.35 });
    const fondo = ellisse(L.rx * 0.62, L.rz * 0.62, '#3a8cc0', 0.055, { emissive: new T.Color('#1a6a9c'), emissiveIntensity: 0.3 });
    ctx.anim.push(t => { acqua.material.emissiveIntensity = 0.33 + Math.sin(t * 1.3) * 0.06; fondo.material.emissiveIntensity = 0.28 + Math.sin(t * 1.3 + 1) * 0.05; });
    W.acquaY = 0.06;

    // sassi della riva (tutti in una sola mesh)
    const sassi = [], NS = 64;
    for (let i = 0; i < NS; i++) {
      const a = i / NS * PI * 2 + rnd(-0.02, 0.02), x = Math.cos(a) * (L.rx + 0.35), z = Math.sin(a) * (L.rz + 0.35);
      if (z > 0 && Math.abs(x) < P.w / 2 + 0.5) continue;           // varco per il pontile
      sassi.push([x, z, rnd(0.28, 0.5)]);
    }
    const IS = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), M('#fff'), sassi.length), mt = new T.Matrix4(), cc = new T.Color(), q = new T.Quaternion(), e = new T.Euler();
    const pal = ['#b3a29b', '#9d8f96', '#c4b5ab', '#8f8189', '#a89a8e'];
    sassi.forEach((s, i) => { e.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); q.setFromEuler(e); mt.compose(new T.Vector3(s[0], s[2] * 0.35, s[1]), q, new T.Vector3(s[2] * 1.2, s[2] * 0.55, s[2])); IS.setMatrixAt(i, mt); cc.set(pal[i % pal.length]); IS.setColorAt(i, cc); });
    IS.castShadow = true; IS.receiveShadow = true; g.add(IS);

    // canne palustri a ciuffi (gambi + pennacchi)
    const ciuffi = [-2.55, -2.2, -1.2, -0.9, 0.55, 0.85, 2.0, 2.75].map(a => [Math.cos(a) * (L.rx - 0.4), Math.sin(a) * (L.rz - 0.4)]);
    const gambi = [], cime = [];
    ciuffi.forEach(c => { for (let k = 0; k < 7; k++) { const x = c[0] + rnd(-0.45, 0.45), z = c[1] + rnd(-0.45, 0.45), h = rnd(0.8, 1.5); gambi.push([x, z, h]); if (k % 2 === 0) cime.push([x, z, h]); } });
    const IG = new T.InstancedMesh(new T.CylinderGeometry(0.025, 0.035, 1, 5), M('#6a9a4a'), gambi.length);
    gambi.forEach((s, i) => { e.set(rnd(-0.12, 0.12), 0, rnd(-0.12, 0.12)); q.setFromEuler(e); mt.compose(new T.Vector3(s[0], s[2] / 2, s[1]), q, new T.Vector3(1, s[2], 1)); IG.setMatrixAt(i, mt); });
    g.add(IG);
    const IC = new T.InstancedMesh(new T.CapsuleGeometry(0.06, 0.22, 3, 6), M('#7a4a2a'), cime.length);
    cime.forEach((s, i) => { mt.makeTranslation(s[0], s[2] + 0.05, s[1]); IC.setMatrixAt(i, mt); });
    g.add(IC);

    // ninfee con qualche fiore
    [[-3.2, -2.1, 0.55], [-4.6, 1.4, 0.45], [2.4, -3.2, 0.6], [4.8, 0.6, 0.5], [1.2, 2.6, 0.42], [-1.6, 3.3, 0.5], [5.9, -2.2, 0.4]].forEach((n, i) => {
      const f = new T.Mesh(new T.CircleGeometry(n[2], 18, 0.35, PI * 2 - 0.5), M('#5fae5a')); f.rotation.x = -PI / 2; f.rotation.z = rnd(0, 6); f.position.set(n[0], 0.075, n[1]); g.add(f);
      if (i % 2 === 0) { const fi = mesh(new T.IcosahedronGeometry(0.13, 1), M('#f8bcd4'), { x: n[0] + 0.1, y: 0.14, z: n[1], l: 0.012 }); fi.scale.y = 0.7; g.add(fi); }
      const k = i; ctx.anim.push(t => { f.position.y = 0.075 + Math.sin(t * 1.1 + k) * 0.008; });
    });

    // ombre di pesci che nuotano
    const ombre = [];
    for (let i = 0; i < 5; i++) {
      const o = new T.Mesh(new T.CircleGeometry(1, 12), new T.MeshBasicMaterial({ color: 0x1d5a7a, transparent: true, opacity: 0.45, depthWrite: false }));
      o.rotation.x = -PI / 2; o.scale.set(0.42, 0.15, 1); o.position.y = 0.068; g.add(o); ombre.push({ o, r: rnd(0.25, 0.75), v: rnd(0.12, 0.3) * (i % 2 ? 1 : -1), f: rnd(0, 6) });
    }
    ctx.anim.push(t => ombre.forEach(s => {
      const a = s.f + t * s.v, x = Math.cos(a) * L.rx * s.r, z = Math.sin(a) * L.rz * s.r * 0.9;
      s.o.position.x = x; s.o.position.z = z; s.o.rotation.z = -(a + (s.v > 0 ? PI / 2 : -PI / 2));
    }));

    // cerchi nell'acqua (riciclati)
    const cerchi = [];
    for (let i = 0; i < 5; i++) { const r = new T.Mesh(new T.RingGeometry(0.85, 1, 28), new T.MeshBasicMaterial({ color: 0xe8f7ff, transparent: true, opacity: 0, depthWrite: false })); r.rotation.x = -PI / 2; r.position.y = 0.07; g.add(r); cerchi.push({ m: r, t: 9 }); }
    W.onda = (x, z, forza) => { const c = cerchi.reduce((a, b) => (a.t > b.t ? a : b)); c.t = 0; c.f = forza || 1; c.m.position.x = x - L.x; c.m.position.z = z - L.z; };
    let prossima = 1;
    ctx.anim.push((t, dt) => {
      prossima -= dt; if (prossima <= 0) { prossima = rnd(0.8, 2.2); const a = rnd(0, 6), r = rnd(0.1, 0.8); W.onda(L.x + Math.cos(a) * L.rx * r, L.z + Math.sin(a) * L.rz * r, 0.6); }
      cerchi.forEach(c => { c.t += dt; const u = c.t / 1.6; if (u > 1) { c.m.material.opacity = 0; return; } const s = (0.15 + u * 0.9) * (c.f || 1); c.m.scale.set(s, s, 1); c.m.material.opacity = (1 - u) * 0.65; });
    });

    // pontile di legno
    const gp = new T.Group(); gp.position.set(P.x - L.x, 0, 0); g.add(gp);
    const lun = P.z1 - P.z0 - 0.7, zc = P.z0 - L.z + lun / 2;
    for (let i = 0; i < Math.round(lun / 0.42); i++) gp.add(mesh(new T.BoxGeometry(P.w, 0.07, 0.38), M(i % 3 === 1 ? '#9a6a42' : '#a9774c'), { y: P.h - 0.035, z: P.z0 - L.z + 0.21 + i * 0.42, lb: 0.01 }));
    const rampa = mesh(new T.BoxGeometry(P.w, 0.12, 0.74), M('#a9774c'), { y: P.h / 2 - 0.02, z: P.z1 - L.z - 0.36, lb: 0.01 }); rampa.rotation.x = 0.36; gp.add(rampa);
    [[-1, 0], [1, 0], [-1, 1], [1, 1], [-1, 2], [1, 2]].forEach(c => gp.add(mesh(new T.CylinderGeometry(0.09, 0.1, 0.9, 8), M('#6b4326'), { x: c[0] * (P.w / 2 - 0.05), y: P.h - 0.35, z: P.z0 - L.z + 0.2 + c[1] * (lun - 0.4) / 2, l: 0.012 })));
    gp.add(mesh(new T.CylinderGeometry(0.06, 0.07, 1.5, 8), M('#6b4326'), { x: -(P.w / 2 - 0.08), y: P.h + 0.72, z: P.z0 - L.z + 0.12, l: 0.012 }));
    gp.add(mesh(new T.BoxGeometry(0.34, 0.05, 0.06), M('#6b4326'), { x: -(P.w / 2 - 0.22), y: P.h + 1.45, z: P.z0 - L.z + 0.12 }));
    const lanternaP = new T.Mesh(new T.BoxGeometry(0.2, 0.28, 0.2), B.Mluce('#ffc062', 1)); lanternaP.position.set(-(P.w / 2 - 0.34), P.h + 1.26, P.z0 - L.z + 0.12); gp.add(lanternaP);

    // insegna
    const cart = new T.Group(); cart.position.set(L.x - 8.6, 0, L.z + 7.6); cart.rotation.y = 0.5; sc.add(cart);
    cart.add(mesh(new T.CylinderGeometry(0.08, 0.1, 2.0, 8), M('#5c3822'), { y: 1.0, l: 0.012 }));
    const ins = insegna('Laghetto', 0.55); ins.position.set(0, 1.75, 0.1); cart.add(ins);
    ctx.ostacoli.push({ t: 'c', x: cart.position.x, z: cart.position.z, r: 0.2 });
    ctx.toccabili.push({ obj: ins, testo: 'Il Laghetto: siediti su uno sgabello e premi "Pesca". I pesci si vendono alla Pescheria del mercatino.' });

    // lampioni e panchina
    ctx.lampione(L.x - 9.8, L.z + 4.2, false); ctx.lampione(L.x + 7.6, L.z - 6.6, false);
    ctx.panchina(L.x + 5.6, L.z + 8.4, PI);

    // il laghetto blocca il passaggio, tranne il pontile
    const RX = L.rx + 0.75, RZ = L.rz + 0.75;
    ctx.ostacoli.push({ t: 'f', x0: L.x - RX, x1: L.x + RX, z0: L.z - RZ, z1: L.z + RZ, blocca(x, z, r) {
      const dx = (x - L.x) / (RX + r), dz = (z - L.z) / (RZ + r); if (dx * dx + dz * dz >= 1) return false;
      return !(Math.abs(x - P.x) <= P.w / 2 - r + 0.12 && z >= P.z0 + 0.25);
    } });

    // posti per pescare: sul pontile e sulla riva (sgabello + secchio)
    const posti = [{ x: P.x, z: P.z0 + 0.55, y: P.h, yaw: PI }];
    [PI, -1.25, 0.2].forEach(a => { const x = L.x + Math.cos(a) * (L.rx + 1.45), z = L.z + Math.sin(a) * (L.rz + 1.45); posti.push({ x, z, y: 0, yaw: Math.atan2(L.x - x, L.z - z) }); });
    W.posti = posti.map((p, i) => {
      const gs = new T.Group(); gs.position.set(p.x, p.y, p.z); gs.rotation.y = p.yaw; sc.add(gs);
      gs.add(mesh(new T.CylinderGeometry(0.26, 0.24, 0.07, 14), M('#b07a48'), { y: 0.42, l: 0.012 }));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => { const lg = mesh(new T.CylinderGeometry(0.03, 0.035, 0.42, 6), M('#6b4326'), { x: c[0] * 0.15, y: 0.21, z: c[1] * 0.15 }); lg.rotation.z = c[0] * 0.12; lg.rotation.x = -c[1] * 0.12; gs.add(lg); });
      const sec = new T.Group(); sec.position.set(-0.55, 0, -0.1); gs.add(sec);
      sec.add(mesh(new T.CylinderGeometry(0.17, 0.13, 0.3, 12, 1, true), M('#7fa3b8', { side: T.DoubleSide }), { y: 0.15, l: 0.012 }));
      sec.add(mesh(new T.CylinderGeometry(0.13, 0.13, 0.02, 12), M('#3f7fa0'), { y: 0.22 }));
      const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
      const sedile = { x: p.x, z: p.z, y: p.y + 0.4, yaw: p.yaw, esci: { x: p.x - sy * 1.0, z: p.z - cy * 1.0 }, pesca: i };
      const lancio = { x: p.x + sy * 3.3, z: p.z + cy * 3.3 };
      const porta = { id: 'pesca-' + i, nome: 'Pesca', testo: '🎣 Pesca', x: p.x - sy * 0.25, z: p.z - cy * 0.25, r: 1.2, fn: () => Pesca.inizia(i) };
      ctx.porte.push(porta);
      return { sedile, lancio, porta };
    });
    // posti degli abitanti che pescano (in piedi, senza sgabello)
    W.postiNpc = [2.3, -0.6].map(a => { const x = L.x + Math.cos(a) * (L.rx + 1.3), z = L.z + Math.sin(a) * (L.rz + 1.3), yaw = Math.atan2(L.x - x, L.z - z); return { x, z, yaw, lancio: { x: x + Math.sin(yaw) * 3.1, z: z + Math.cos(yaw) * 3.1 } }; });
  }

  /* ---------- RUOTA PANORAMICA ---------- */
  function costruisciRuota(ctx) {
    const R = CF.ruota, sc = ctx.scene;
    const g = new T.Group(); g.position.set(R.x, 0, R.z); sc.add(g); W.gRuota = g;
    const ferro = '#e9e2f0', ferroS = '#b9aac8', V = (x, y, z) => new T.Vector3(x, y, z);
    // basamento in pietra e piedi
    g.add(mesh(new T.BoxGeometry(12.4, 0.3, 3.8), M('#b3a29b'), { y: 0.15, lb: 0.02 }));
    g.add(mesh(new T.BoxGeometry(12.6, 0.06, 4.0), M('#cdbfb8'), { y: 0.31, lb: 0.015 }));
    // cavalletti (due "A" ai lati della ruota)
    [-1, 1].forEach(s => {
      const zz = s * 1.25;
      trave(g, V(-5.4, 0.3, zz * 1.5), V(0, R.hub, zz), 0.32, ferro); trave(g, V(5.4, 0.3, zz * 1.5), V(0, R.hub, zz), 0.32, ferro);
      trave(g, V(-3.6, 4.0, zz * 1.36), V(3.6, 4.0, zz * 1.36), 0.2, ferroS); trave(g, V(-1.9, 7.6, zz * 1.18), V(1.9, 7.6, zz * 1.18), 0.18, ferroS);
      trave(g, V(-3.6, 4.0, zz * 1.36), V(1.9, 7.6, zz * 1.18), 0.12, ferroS); trave(g, V(3.6, 4.0, zz * 1.36), V(-1.9, 7.6, zz * 1.18), 0.12, ferroS);
      [-5.4, 5.4].forEach(x => g.add(mesh(new T.BoxGeometry(0.8, 0.4, 0.8), M('#8f8189'), { x, y: 0.5, z: zz * 1.5, lb: 0.015 })));
    });
    const asse = mesh(new T.CylinderGeometry(0.32, 0.32, 3.0, 16), M('#7a6f8a'), { y: R.hub, l: 0.02 }); asse.rotation.x = PI / 2; g.add(asse);

    // la ruota che gira
    const ruota = new T.Group(); ruota.position.y = R.hub; g.add(ruota); W.ruota = ruota;
    [-0.55, 0.55].forEach(z => {
      const c = mesh(new T.TorusGeometry(R.R, 0.13, 8, 72), M(ferro), { z, l: 0.02 }); ruota.add(c);
      const c2 = mesh(new T.TorusGeometry(R.R * 0.5, 0.08, 6, 48), M(ferroS), { z, l: 0.015 }); ruota.add(c2);
    });
    const NR = 16, IR = new T.InstancedMesh(new T.BoxGeometry(0.09, 1, 0.09), M(ferroS), NR * 2), mt = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
    for (let i = 0; i < NR * 2; i++) { const a = (i % NR) / NR * PI * 2, z = i < NR ? -0.55 : 0.55; e.set(0, 0, a - PI / 2); q.setFromEuler(e); mt.compose(V(Math.cos(a) * R.R / 2, Math.sin(a) * R.R / 2, z), q, V(1, R.R, 1)); IR.setMatrixAt(i, mt); }
    ruota.add(IR);
    const mozzo = mesh(new T.CylinderGeometry(0.85, 0.85, 1.4, 20), M('#f2c76e'), { l: 0.02 }); mozzo.rotation.x = PI / 2; ruota.add(mozzo);
    [-0.72, 0.72].forEach(z => { const st = mesh(new T.CylinderGeometry(0.55, 0.55, 0.06, 6), M('#e0675c'), { z }); st.rotation.x = PI / 2; ruota.add(st); });
    // lampadine sul bordo: due serie che si alternano la sera
    const NL = 48, lamp = [B.Mluce('#ffd77a', 1), B.Mluce('#ff9ac4', 1)], serie = [0, 1].map(k => new T.InstancedMesh(new T.SphereGeometry(0.11, 6, 5), lamp[k], NL));
    for (let i = 0; i < NL * 2; i++) { const a = i / (NL * 2) * PI * 2, k = i % 2, j = (i - k) / 2; mt.makeTranslation(Math.cos(a) * (R.R + 0.18), Math.sin(a) * (R.R + 0.18), -0.68); serie[k].setMatrixAt(j, mt); }
    serie.forEach(s => { s.castShadow = false; ruota.add(s); const s2 = s.clone(); s2.position.z = 1.36; ruota.add(s2); s.userData.copia = s2; });
    // supporti delle cabine
    const IP = new T.InstancedMesh(new T.CylinderGeometry(0.09, 0.09, 1.3, 8), M(ferro), R.cabine);
    for (let i = 0; i < R.cabine; i++) { const a = i / R.cabine * PI * 2; e.set(PI / 2, 0, 0); q.setFromEuler(e); mt.compose(V(Math.cos(a) * R.R, Math.sin(a) * R.R, 0), q, V(1, 1, 1)); IP.setMatrixAt(i, mt); }
    ruota.add(IP);

    // cabine (restano sempre dritte)
    const colori = ['#e0675c', '#f2c76e', '#4f8ab8', '#8fc46a', '#c58bd6', '#f08fb4', '#58c4ea', '#ffb35c'];
    W.cabine = [];
    for (let i = 0; i < R.cabine; i++) {
      const c = new T.Group(); g.add(c); const col = colori[i % colori.length], dy = -R.appeso;
      c.add(mesh(new T.CylinderGeometry(0.06, 0.06, 0.5, 6), M(ferro), { y: -0.2 }));
      c.add(mesh(new T.BoxGeometry(2.0, 0.12, 1.7), M('#efe6d8'), { y: dy, lb: 0.015 }));
      c.add(mesh(new T.BoxGeometry(2.0, 0.62, 0.08), M(col), { y: dy + 0.37, z: -0.81, lb: 0.012 }));
      [-1, 1].forEach(s => c.add(mesh(new T.BoxGeometry(0.08, 0.62, 1.7), M(col), { x: s * 0.96, y: dy + 0.37, lb: 0.012 })));
      c.add(mesh(new T.BoxGeometry(2.0, 0.3, 0.08), M(col), { y: dy + 0.21, z: 0.81, lb: 0.012 }));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => c.add(mesh(new T.CylinderGeometry(0.045, 0.045, 1.7, 6), M(ferro), { x: p[0] * 0.94, y: dy + 1.45, z: p[1] * 0.79 })));
      const tetto = mesh(new T.ConeGeometry(1.45, 0.55, 4), M(col), { y: dy + 2.55, l: 0.015 }); tetto.rotation.y = PI / 4; tetto.scale.z = 0.85; c.add(tetto);
      c.add(mesh(new T.SphereGeometry(0.1, 8, 6), M('#f2c76e'), { y: dy + 2.88 }));
      c.add(mesh(new T.BoxGeometry(1.5, 0.1, 0.5), M('#a96f44'), { y: dy + 0.36, z: -0.45, lb: 0.01 }));
      c.add(mesh(new T.BoxGeometry(1.5, 0.45, 0.08), M('#a96f44'), { y: dy + 0.6, z: -0.7, lb: 0.01 }));
      W.cabine.push({ g: c, i });
    }
    W.angoloRuota = 0;

    // pedana d'imbarco, biglietteria e insegna
    g.add(mesh(new T.BoxGeometry(3.2, 0.22, 1.1), M('#a9774c'), { y: 0.42, z: 1.35, lb: 0.012 }));
    const big = new T.Group(); big.position.set(4.6, 0, 3.6); g.add(big);
    big.add(mesh(new T.BoxGeometry(1.6, 1.6, 1.3), M('#f6e8cc'), { y: 0.8, lb: 0.02 }));
    big.add(mesh(new T.BoxGeometry(1.0, 0.6, 0.06), M('#5a4670'), { y: 1.05, z: 0.66 }));
    big.add(mesh(new T.BoxGeometry(1.2, 0.08, 0.35), M('#a96f44'), { y: 0.72, z: 0.78, lb: 0.01 }));
    const tb = new T.Mesh(new T.ConeGeometry(1.25, 0.7, 4), new T.MeshToonMaterial({ map: B.texRighe('#e0675c', '#fbf3dc', 8), gradientMap: M('#fff').gradientMap })); tb.position.y = 1.95; tb.rotation.y = PI / 4; tb.castShadow = true; big.add(tb);
    const ins = insegna('Ruota panoramica', 0.62); ins.position.set(-3.8, 2.4, 2.05); g.add(ins);
    g.add(mesh(new T.CylinderGeometry(0.07, 0.08, 2.1, 8), M('#5c3822'), { x: -3.8, y: 1.05, z: 1.95, l: 0.012 }));
    ctx.ostacoli.push({ t: 'b', x0: R.x - 6.3, x1: R.x + 6.3, z0: R.z - 2.0, z1: R.z + 1.95 });
    ctx.ostacoli.push({ t: 'b', x0: R.x + 4.6 - 0.85, x1: R.x + 4.6 + 0.85, z0: R.z + 3.6 - 0.7, z1: R.z + 3.6 + 0.7 });
    ctx.ostacoli.push({ t: 'c', x: R.x - 3.8, z: R.z + 1.95, r: 0.15 });
    const proxy = new T.Mesh(new T.BoxGeometry(17, 19, 2.5), new T.MeshBasicMaterial()); proxy.visible = false; proxy.position.set(0, 9.5, 0); g.add(proxy);
    ctx.toccabili.push({ obj: proxy, testo: 'Ruota panoramica: avvicinati alla pedana e premi "Sali". Un giro completo per vedere tutto il borgo dall\'alto.' });
    W.portaRuota = { id: 'ruota', nome: 'Ruota panoramica', testo: '🎡 Sali sulla ruota', x: R.x, z: R.z + 2.85, r: 1.5, fn: () => Ruota.sali() };
    ctx.porte.push(W.portaRuota);
    ctx.anim.push((t, dt) => Ruota.frame(t, dt));
    // marquee serale
    W.serie = serie;
  }

  /* ---------- MERCATINO ---------- */
  const BANCHI = [
    { tema: 'pesce',   nome: 'Pescheria',          a: '#4f8ab8', b: '#fbf3dc' },
    { tema: 'usato',   nome: 'Mobili usati',       a: '#c8553d', b: '#f6e8cc' },
    { tema: 'luci',    nome: 'Luci e decorazioni', a: '#7a2fd6', b: '#f4ead6' },
    { tema: 'carte',   nome: 'Belinverse TCG',     a: '#1f3a78', b: '#f2c76e' }
  ];
  function costruisciMercato(ctx) {
    const MZ = CF.mercato.z, sc = ctx.scene, gm = M('#fff').gradientMap;
    W.banchi = [];
    CF.mercato.xs.forEach((x, i) => {
      const d = BANCHI[i], g = new T.Group(); g.position.set(x, 0, MZ); sc.add(g);
      g.add(mesh(new T.BoxGeometry(3.0, 0.88, 0.9), M('#a96f44'), { y: 0.44, z: 0.4, lb: 0.015 }));
      g.add(mesh(new T.BoxGeometry(3.12, 0.08, 1.02), M('#c98f5a'), { y: 0.92, z: 0.4, lb: 0.012 }));
      for (let k = 0; k < 4; k++) g.add(mesh(new T.BoxGeometry(0.66, 0.62, 0.04), M(k % 2 ? d.b : d.a), { x: -1.08 + k * 0.72, y: 0.44, z: 0.87 }));
      [[-1, -0.6, 2.95], [1, -0.6, 2.95], [-1, 0.9, 2.55], [1, 0.9, 2.55]].forEach(p => g.add(mesh(new T.BoxGeometry(0.1, p[2], 0.1), M('#6b4326'), { x: p[0] * 1.48, y: p[2] / 2, z: p[1], lb: 0.01 })));
      const tenda = new T.Mesh(new T.BoxGeometry(3.4, 0.06, 1.95), new T.MeshToonMaterial({ map: B.texRighe(d.a, d.b, 8), gradientMap: gm }));
      tenda.position.set(0, 2.8, 0.16); tenda.rotation.x = 0.26; tenda.castShadow = true; g.add(tenda);
      const fest = new T.Mesh(new T.PlaneGeometry(3.4, 0.34), new T.MeshBasicMaterial({ map: B.texFestone(d.a, d.b, 10), transparent: true, alphaTest: 0.4, side: T.DoubleSide }));
      fest.position.set(0, 2.39, 1.12); g.add(fest);
      const ins = insegna(d.nome, 0.5, d.tema === 'carte' ? { fondo: '#1f2f5e' } : null); ins.position.set(0, 3.32, 0.2); ins.rotation.x = -0.1; g.add(ins);
      // casse ai lati
      g.add(mesh(new T.BoxGeometry(0.6, 0.45, 0.6), M('#8a5a35'), { x: 1.95, y: 0.225, z: 0.2, lb: 0.012 }));
      if (i % 2) g.add(mesh(new T.BoxGeometry(0.5, 0.38, 0.5), M('#9a6a42'), { x: -1.9, y: 0.19, z: -0.2, lb: 0.012 }));
      const merce = new T.Group(); merce.userData.vivo = true; merce.position.set(0, 0.96, 0.4); g.add(merce);
      ctx.ostacoli.push({ t: 'b', x0: x - 1.75, x1: x + 1.75, z0: MZ - 0.75, z1: MZ + 0.95 });
      if (i % 2) ctx.ostacoli.push({ t: 'c', x: x - 1.9, z: MZ - 0.2, r: 0.3 }); ctx.ostacoli.push({ t: 'c', x: x + 1.95, z: MZ + 0.2, r: 0.35 });
      const porta = { id: 'banco-' + i, nome: d.nome, testo: (d.tema === 'carte' ? '🃏 ' : d.tema === 'pesce' ? '🐟 ' : '🛒 ') + d.nome, x, z: MZ + 1.95, r: 1.35, fn: () => Mercato.apri(i) };
      ctx.porte.push(porta);
      W.banchi.push({ g, merce, x, z: MZ, d, venditore: { x, z: MZ - 1.15, yaw: 0 } });
    });
    // arco d'ingresso al centro con l'insegna
    const ga = new T.Group(); ga.position.set(0, 0, MZ + 0.4); sc.add(ga);
    [-1, 1].forEach(s => { ga.add(mesh(new T.CylinderGeometry(0.13, 0.16, 3.6, 10), M('#6b4326'), { x: s * 1.2, y: 1.8, l: 0.015 })); ctx.ostacoli.push({ t: 'c', x: s * 1.2, z: MZ + 0.4, r: 0.18 }); });
    ga.add(mesh(new T.BoxGeometry(2.9, 0.2, 0.3), M('#8a5a35'), { y: 3.55, lb: 0.012 }));
    const ia = insegna('Mercatino', 0.62, { colore: '#ffe9c4' }); ia.position.set(0, 3.98, 0.17); ga.add(ia);
    // fili di lampadine tra i banchi
    const punti = [-17.2].concat(CF.mercato.xs.map(x => x), [17.2]);
    const lampM = B.Mluce('#ffd77a', 1), lampM2 = B.Mluce('#ff9ac4', 1), cavo = M('#2c2431');
    for (let k = 0; k < punti.length - 1; k++) {
      const a = punti[k], b = punti[k + 1], n = 7;
      for (let j = 0; j <= n; j++) {
        const u = j / n, x = a + (b - a) * u, y = 3.0 - Math.sin(u * PI) * 0.45;
        if (j > 0 && j < n) { const bl = new T.Mesh(new T.SphereGeometry(0.08, 6, 5), j % 2 ? lampM : lampM2); bl.position.set(x, y - 0.1, MZ - 0.55); sc.add(bl); }
      }
      const curva = new T.CatmullRomCurve3([new T.Vector3(a, 3.0, MZ - 0.55), new T.Vector3((a + b) / 2, 2.55, MZ - 0.55), new T.Vector3(b, 3.0, MZ - 0.55)]);
      sc.add(new T.Mesh(new T.TubeGeometry(curva, 12, 0.015, 4), cavo));
    }
    ctx.toccabili.push({ obj: ia, testo: 'Mercatino: ogni banco compra e vende la sua merce. Pesci alla Pescheria, mobili e luci ai loro banchi, carte di Belinverse al banco Belinverse TCG.' });
  }

  /* =====================================================================
     ABITANTI CHE PESCANO, VENDONO E GIRANO SULLA RUOTA
     ===================================================================== */
  const ruoli = { pescatori: [], venditori: [], passeggeri: [], lista: null };
  function assegnaRuoli() {
    if (!app || !app.npc.length || ruoli.lista === app.npc) return;
    ruoli.lista = app.npc;
    const liberi = app.npc.slice();
    const prendi = () => liberi.shift();
    ruoli.pescatori = W.postiNpc.map((p, i) => { const o = prendi(); if (!o) return null; const canna = creaCanna(); o.av.root.add(canna.g); canna.g.position.set(0.24, 1.05, 0.22); return { o, p, canna, prossimo: rnd(8, 25), fil: creaFilo(), gall: creaGalleggiante() }; }).filter(Boolean);
    ruoli.venditori = W.banchi.map((b, i) => { const o = prendi(); return o ? { o, b } : null; }).filter(Boolean);
    ruoli.passeggeri = [2, 5].map(c => { const o = prendi(); return o ? { o, c, prossimo: rnd(10, 30) } : null; }).filter(Boolean);
    ruoli.pescatori.forEach(r => { r.gall.position.set(r.p.lancio.x, W.acquaY + 0.05, r.p.lancio.z); });
  }
  function aggiornaRuoli(t, dt) {
    assegnaRuoli();
    const parcheggia = (o, x, z, yaw) => { o.x = o.tx = x; o.z = o.tz = z; o.vx = o.vz = 0; o.att = 999; o.yaw = yaw; };
    ruoli.pescatori.forEach(r => {
      const o = r.o; parcheggia(o, r.p.x, r.p.z, r.p.yaw);
      const vis = o.av.root.visible; r.fil.visible = vis; r.gall.visible = vis;
      if (!vis) return;
      r.gall.position.y = W.acquaY + 0.05 + Math.sin(t * 2.2 + r.p.x) * 0.02;
      tendiFilo(r.fil, r.canna.punta, r.gall.position, 0.5);
      r.prossimo -= dt;
      if (r.prossimo <= 0) {
        r.prossimo = rnd(18, 40); const sp = pescaCasuale(); W.onda(r.gall.position.x, r.gall.position.z, 1);
        if (app.mostraBolla) app.mostraBolla(o, sp.curiosita ? 'Uffa, uno stivale!' : 'Preso: ' + sp.nome + '!', 3.5);
      }
    });
    ruoli.venditori.forEach(r => { const v = r.b.venditore; parcheggia(r.o, v.x, v.z, v.yaw); });
    ruoli.passeggeri.forEach(r => {
      const s = postoCabina(r.c); parcheggia(r.o, s.x, s.z, 0); r.o.av.sedT = 1; r.o.av.root.position.set(s.x, s.y, s.z);
      r.prossimo -= dt; if (r.prossimo <= 0 && r.o.av.root.visible) { r.prossimo = rnd(20, 45); if (app.mostraBolla) app.mostraBolla(r.o, ['Che vista!', 'Si vede il laghetto!', 'Ciao da quassù!', 'Che bello il tramonto da qui'][(Math.random() * 4) | 0], 3.5); }
    });
  }

  /* ---------- canna, filo e galleggiante ---------- */
  function creaCanna() {
    const g = new T.Group();
    const canna = new T.Group(); canna.rotation.x = 0.95; g.add(canna);         // inclinata in avanti verso l'acqua
    canna.add(mesh(new T.CylinderGeometry(0.035, 0.04, 0.42, 8), M('#3a2216'), { y: 0.0 }));
    const mulinello = mesh(new T.CylinderGeometry(0.06, 0.06, 0.07, 10), M('#c8c2d0'), { y: 0.13, x: 0.05 }); mulinello.rotation.z = PI / 2; canna.add(mulinello);
    canna.add(mesh(new T.CylinderGeometry(0.012, 0.025, 2.2, 6), M('#c8553d'), { y: 1.3 }));
    const punta = new T.Object3D(); punta.position.y = 2.4; canna.add(punta);
    return { g, canna, punta };
  }
  function creaFilo() {
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(new Float32Array(13 * 3), 3));
    const l = new T.Line(geo, new T.LineBasicMaterial({ color: 0xf4f0e8, transparent: true, opacity: 0.85 })); l.frustumCulled = false; W.ctx.scene.add(l); return l;
  }
  function creaGalleggiante() {
    const g = new T.Group();
    g.add(mesh(new T.SphereGeometry(0.09, 10, 6, 0, PI * 2, 0, PI / 2), M('#e0473c'), { l: 0.008 }));
    const sotto = mesh(new T.SphereGeometry(0.09, 10, 6, 0, PI * 2, PI / 2, PI / 2), M('#fbf3ea'), { l: 0.008 }); g.add(sotto);
    g.add(mesh(new T.CylinderGeometry(0.012, 0.012, 0.12, 5), M('#2a1a2e'), { y: 0.12 }));
    W.ctx.scene.add(g); return g;
  }
  const vA = new T.Vector3(), vB = new T.Vector3();
  function tendiFilo(filo, punta, fine, mollezza) {
    punta.getWorldPosition(vA); const p = filo.geometry.attributes.position;
    for (let i = 0; i <= 12; i++) {
      const u = i / 12; vB.copy(vA).lerp(fine, u); vB.y -= Math.sin(u * PI) * mollezza;
      if (u > 0.85) vB.y = Math.max(vB.y, fine.y);
      p.setXYZ(i, vB.x, vB.y, vB.z);
    }
    p.needsUpdate = true;
  }

  /* =====================================================================
     PESCA
     ===================================================================== */
  function disponibili() {
    const a = atmo();
    return SPECIE.filter(s => !s.quando || (s.quando === 'notte' && a === 'notte') || (s.quando === 'sera' && a !== 'giorno') || (s.quando === 'giorno' && a === 'giorno'));
  }
  function pescaCasuale() {
    const l = disponibili(); let tot = 0; l.forEach(s => { tot += RAR[s.rar].peso; });
    let r = Math.random() * tot; for (const s of l) { r -= RAR[s.rar].peso; if (r <= 0) return s; } return l[0];
  }
  function trovate() { return SPECIE.filter(s => !s.curiosita && S.pesci[s.id]).length; }
  const pesci = n => n + (n === 1 ? ' pesce' : ' pesci');
  const nelSecchio = () => Object.keys(S.secchio).reduce((a, k) => a + S.secchio[k], 0);

  const Pesca = B.Pesca = {
    attivo: false, st: 'pronto', posto: -1, t: 0,
    inizia(i) {
      if (!app) return; const P = W.posti[i]; if (!P) return;
      if (Ruota.attiva) return;
      app.usaPorta({ sedile: P.sedile });
      Pesca.attivo = true; Pesca.posto = i; Pesca.st = 'pronto'; Pesca.t = 0;
      if (!Pesca.canna) { Pesca.canna = creaCanna(); Pesca.filo = creaFilo(); Pesca.gall = creaGalleggiante(); }
      app.io.av.root.add(Pesca.canna.g); Pesca.canna.g.position.set(0.26, 0.82, 0.3);
      Pesca.filo.visible = Pesca.gall.visible = true;
      pannello(true); stato('Tocca «Lancia» per gettare l\'amo', '🎣 Lancia');
      setTimeout(() => toast('Sei al laghetto: lancia, aspetta che abbocchi e tira!'), 60);
    },
    fine() {
      if (!Pesca.attivo) return; Pesca.attivo = false; Pesca.st = 'pronto';
      if (Pesca.canna && Pesca.canna.g.parent) Pesca.canna.g.parent.remove(Pesca.canna.g);
      if (Pesca.filo) Pesca.filo.visible = Pesca.gall.visible = false;
      if (Pesca.pesce) { W.ctx.scene.remove(Pesca.pesce); Pesca.pesce = null; }
      pannello(false);
    },
    tocco() {
      const st = Pesca.st;
      if (st === 'pronto') { Pesca.st = 'lancio'; Pesca.t = 0; stato('…', '', true); }
      else if (st === 'attesa') { Pesca.st = 'pronto'; stato('Troppo presto! Ritira e riprova', '🎣 Lancia'); }
      else if (st === 'abbocca') { Pesca.lotta(); }
      else if (st === 'lotta') { Pesca.ferma(); }
    },
    lotta() {
      const r = RAR[Pesca.preda.rar]; Pesca.st = 'lotta'; Pesca.t = 0;
      Pesca.zona = { a: rnd(0.12, 0.88 - r.zona), w: r.zona }; Pesca.ago = 0; Pesca.dir = 1; Pesca.vel = r.vel * rnd(0.9, 1.1);
      barra(true); stato('Fermati nella zona verde!', '✋ Ferma!');
    },
    ferma() {
      const z = Pesca.zona, u = Pesca.ago; barra(false);
      if (u >= z.a && u <= z.a + z.w) preso(Pesca.preda);
      else { Pesca.st = 'pronto'; W.onda(Pesca.gall.position.x, Pesca.gall.position.z, 1.4); stato('È scappato! Riprova', '🎣 Lancia'); if (app.mostraBolla) app.mostraBolla(app.io, 'Nooo!', 2); }
    },
    frame(t, dt) {
      if (!Pesca.attivo) return;
      if (!app.io.seduto || app.io.seduto.pesca !== Pesca.posto || app.stanza().id !== 'piazza') { Pesca.fine(); return; }
      const P = W.posti[Pesca.posto], tip = Pesca.canna.punta, gl = Pesca.gall.position, acq = W.acquaY + 0.05;
      Pesca.t += dt; const st = Pesca.st;
      Pesca.canna.canna.rotation.x = 0.95 + (st === 'lotta' ? Math.sin(t * 22) * 0.06 - 0.25 : st === 'abbocca' ? -0.12 : 0) + (st === 'lancio' ? -0.9 * Math.max(0, 1 - Pesca.t * 3) : 0);
      if (st === 'pronto') { tip.getWorldPosition(vA); gl.set(vA.x, vA.y - 0.55, vA.z); tendiFilo(Pesca.filo, tip, gl, 0); }
      else if (st === 'lancio') {
        const u = clamp(Pesca.t / 0.55, 0, 1); tip.getWorldPosition(vA);
        gl.set(vA.x + (P.lancio.x - vA.x) * u, vA.y + (acq - vA.y) * u + Math.sin(u * PI) * 1.6, vA.z + (P.lancio.z - vA.z) * u);
        tendiFilo(Pesca.filo, tip, gl, 0.2);
        if (u >= 1) { W.onda(P.lancio.x, P.lancio.z, 0.9); Pesca.st = 'attesa'; Pesca.t = 0; Pesca.attesa = rnd(CF.pesca.attesa[0], CF.pesca.attesa[1]); Pesca.preda = pescaCasuale(); stato('Aspetta che abbocchi… (non tirare troppo presto!)', '⏳ Aspetta…', true); }
      }
      else if (st === 'attesa') {
        const finta = (Pesca.t % 1.7 < 0.12 && Pesca.t > 1) ? -0.03 : 0;
        gl.set(P.lancio.x, acq + Math.sin(t * 2.4) * 0.02 + finta, P.lancio.z); tendiFilo(Pesca.filo, tip, gl, 0.45);
        if (Pesca.t >= Pesca.attesa) { Pesca.st = 'abbocca'; Pesca.t = 0; W.onda(P.lancio.x, P.lancio.z, 1.2); stato('Abbocca! Tira!', '❗ Tira!'); if (app.mostraBolla) app.mostraBolla(app.io, '!', 1.2); }
      }
      else if (st === 'abbocca') {
        gl.set(P.lancio.x + Math.sin(t * 30) * 0.03, acq - 0.1 + Math.sin(t * 18) * 0.04, P.lancio.z); tendiFilo(Pesca.filo, tip, gl, 0.1);
        if (Pesca.t > CF.pesca.finestra) { Pesca.st = 'pronto'; stato('Troppo tardi: ha mangiato l\'esca!', '🎣 Lancia'); }
      }
      else if (st === 'lotta') {
        Pesca.ago += Pesca.dir * Pesca.vel * dt; if (Pesca.ago > 1) { Pesca.ago = 1; Pesca.dir = -1; } if (Pesca.ago < 0) { Pesca.ago = 0; Pesca.dir = 1; }
        aggBarra();
        gl.set(P.lancio.x + Math.sin(t * 7) * 0.35, acq - 0.06, P.lancio.z + Math.cos(t * 5) * 0.25); tendiFilo(Pesca.filo, tip, gl, 0);
        if (Math.random() < dt * 3) W.onda(gl.x, gl.z, 0.5);
        if (Pesca.t > 6) { barra(false); Pesca.st = 'pronto'; stato('Si è liberato! Riprova', '🎣 Lancia'); }
      }
      else if (st === 'preso') {
        const u = clamp(Pesca.t / 0.8, 0, 1); tip.getWorldPosition(vA);
        if (Pesca.pesce) { const p = Pesca.pesce.position; p.set(P.lancio.x + (vA.x - P.lancio.x) * u, acq + (vA.y - 0.3 - acq) * u + Math.sin(u * PI) * 1.2, P.lancio.z + (vA.z - P.lancio.z) * u); Pesca.pesce.rotation.z = Math.sin(t * 20) * 0.4; gl.copy(p); }
        tendiFilo(Pesca.filo, tip, gl, 0);
        if (Pesca.t > 1.6) { if (Pesca.pesce) { W.ctx.scene.remove(Pesca.pesce); Pesca.pesce = null; } Pesca.st = 'pronto'; stato('Tocca «Lancia» per gettare l\'amo', '🎣 Lancia'); }
      }
    }
  };
  function preso(sp) {
    const nuovo = !S.pesci[sp.id], cm = Math.round(rnd(sp.dim[0], sp.dim[1]));
    const rec = S.pesci[sp.id] = S.pesci[sp.id] || { n: 0, rec: 0 }; rec.n++; const record = cm > rec.rec && !nuovo; rec.rec = Math.max(rec.rec, cm);
    S.secchio[sp.id] = (S.secchio[sp.id] || 0) + 1;
    let premio = '';
    if (!S.trofeo && trovate() >= CF.pesca.trofeo && B.Eco) { S.trofeo = 1; B.Eco.regala('trofeo'); premio = 'trofeo'; }
    salva(); missione('pesca');
    Pesca.st = 'preso'; Pesca.t = 0; Pesca.pesce = pesce3D(sp); W.ctx.scene.add(Pesca.pesce);
    W.onda(Pesca.gall.position.x, Pesca.gall.position.z, 1.5);
    stato(sp.curiosita ? 'Un vecchio stivale… succede!' : 'Preso: ' + sp.nome + '!', '…', true);
    if (app.mostraBolla) app.mostraBolla(app.io, sp.curiosita ? 'Uno stivale?!' : sp.nome + ' ' + cm + ' cm!', 3);
    carta(sp, cm, nuovo, record, premio);
    aggSecchio();
  }

  /* ---------- pesce 3D che esce dall'acqua ---------- */
  function pesce3D(sp) {
    const g = new T.Group(), k = sp.rar === 'leggendario' ? 1.6 : sp.rar === 'epico' ? 1.2 : 1;
    if (sp.forma === 'stivale') {
      g.add(mesh(new T.BoxGeometry(0.16, 0.38, 0.2), M(sp.col), { y: 0.1, lb: 0.01 })); g.add(mesh(new T.BoxGeometry(0.16, 0.14, 0.36), M(sp.col), { y: -0.05, z: 0.1, lb: 0.01 }));
      return g;
    }
    const lungo = sp.forma === 'anguilla' ? 2.6 : sp.forma === 'lungo' ? 2.0 : sp.forma === 'tondo' ? 1.2 : 1.6;
    const corpo = mesh(new T.SphereGeometry(0.16 * k, 12, 8), M(sp.col, sp.motivo === 'luce' ? { emissive: new T.Color(sp.col2), emissiveIntensity: 0.4 } : undefined), { l: 0.01 });
    corpo.scale.set(lungo, sp.forma === 'tondo' ? 1.15 : 0.85, 0.55); g.add(corpo);
    const coda = mesh(new T.ConeGeometry(0.14 * k, 0.24 * k, 4), M(sp.col2), { x: -0.16 * k * lungo - 0.06, l: 0.01 }); coda.rotation.z = PI / 2; coda.scale.z = 0.3; g.add(coda);
    g.add(mesh(new T.SphereGeometry(0.03 * k, 6, 5), M('#1a1020'), { x: 0.16 * k * lungo * 0.6, y: 0.04 * k, z: 0.07 * k }));
    g.rotation.y = rnd(0, 6);
    return g;
  }

  /* =====================================================================
     RUOTA PANORAMICA
     ===================================================================== */
  function postoCabina(i) {
    const R = CF.ruota, a = W.angoloRuota + i / R.cabine * PI * 2, c = W.cabine[i].g;
    return { x: R.x + Math.cos(a) * R.R + Math.sin(c.rotation.z) * (R.appeso - 0.48), y: R.hub + Math.sin(a) * R.R - R.appeso + 0.06 + 0.42, z: R.z - 0.3, a };
  }
  const Ruota = B.Ruota = {
    attiva: false,
    sali() {
      if (!app || Ruota.attiva) return;
      const R = CF.ruota; let best = 0, bd = 9;
      for (let i = 0; i < R.cabine; i++) { if (ruoli.passeggeri.some(p => p.c === i)) continue; const a = ((W.angoloRuota + i / R.cabine * PI * 2) % (PI * 2) + PI * 2) % (PI * 2), d = Math.abs(a - PI * 1.5); if (d < bd) { bd = d; best = i; } }
      const p = postoCabina(best);
      Ruota.sedile = { x: p.x, z: p.z, y: p.y, yaw: 0, esci: { x: R.x, z: R.z + 3.1 }, ruota: true };
      Ruota.cabina = best; Ruota.giro = 0; Ruota.attiva = true; Ruota.zoom = app.C.zoom;
      app.usaPorta({ sedile: Ruota.sedile }); app.impostaZoom(Math.min(app.C.zoom, 0.62));
      setTimeout(() => toast('Goditi il panorama! Muovi il joystick per scendere prima.'), 60);
      const vicino = ruoli.passeggeri[0];
      if (vicino && app.mostraBolla) setTimeout(() => { if (Ruota.attiva) app.mostraBolla(vicino.o, 'Ciao ' + (app.io.nick || '') + '! Bella vista, eh?', 4); }, 3500);
    },
    scendi(auto) {
      if (!Ruota.attiva) return; Ruota.attiva = false;
      const io = app.io;
      if (io.seduto === Ruota.sedile) { io.seduto = null; io.x = Ruota.sedile.esci.x; io.z = Ruota.sedile.esci.z; io.yaw = 0; }
      app.impostaZoom(Ruota.zoom || 1);
      if (auto) { S.giri++; salva(); missione('ruota'); toast('Che giro! Hai visto tutto il borgo dall\'alto.'); }
    },
    frame(t, dt) {
      const R = CF.ruota, w = PI * 2 / R.giro;
      W.angoloRuota += w * dt; W.ruota.rotation.z = W.angoloRuota;
      W.cabine.forEach((c, i) => { const a = W.angoloRuota + i / R.cabine * PI * 2; c.g.position.set(Math.cos(a) * R.R, R.hub + Math.sin(a) * R.R, 0); c.g.rotation.z = Math.sin(t * 0.9 + i) * 0.03; });
      // lampadine: di sera le due serie si alternano
      const sera = atmo() !== 'giorno', on = Math.floor(t * 1.6) % 2;
      W.serie.forEach((s, k) => { const v = !sera || k === on; s.visible = v; s.userData.copia.visible = v; });
      if (Ruota.attiva) {
        const io = app.io;
        if (io.seduto !== Ruota.sedile || app.stanza().id !== 'piazza') { Ruota.scendi(false); return; }
        const p = postoCabina(Ruota.cabina); Object.assign(Ruota.sedile, { x: p.x, y: p.y, z: p.z });
        io.x = p.x; io.y = p.y; io.z = p.z; io.av.root.position.set(p.x, p.y, p.z);
        Ruota.giro += w * dt; if (Ruota.giro >= PI * 2 - 0.02) Ruota.scendi(true);
      }
    }
  };

  /* =====================================================================
     MERCATINO
     ===================================================================== */
  function nuovoGiornoMercato() { const o = oggi(); if (S.merc.g !== o) { S.merc = { g: o, presi: [] }; salva(); } if (S.vend.g !== o) { S.vend = { g: o, c: 0 }; salva(); } if (!S.vendC || S.vendC.g !== o) { S.vendC = { g: o, c: 0 }; salva(); } }
  function prezzoPesce(sp) { const r = seme(oggi() + sp.id)(); return Math.max(1, Math.round(sp.prezzo * (0.85 + r * 0.3))); }
  const eLuce = a => !!a.luce || ['vaso', 'pianta', 'tappeto', 'fontana'].indexOf(a.id) >= 0;
  function offerte(i) {
    nuovoGiornoMercato();
    const tema = BANCHI[i].tema, rng = seme(oggi() + ':' + i), A = (B.ARREDI || []).filter(a => !a.esclusivo && a.prezzo > 0);
    const mescola = l => { l = l.slice(); for (let k = l.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [l[k], l[j]] = [l[j], l[k]]; } return l; };
    let out = [];
    if (tema === 'usato') out = mescola(A).slice(0, 4).map(a => ({ id: a.id, prezzo: Math.round(a.prezzo * (0.62 + rng() * 0.2)), pieno: a.prezzo }));
    else if (tema === 'luci') { const l = A.filter(eLuce); out = mescola(l).slice(0, 3).map(a => ({ id: a.id, prezzo: Math.round(a.prezzo * 0.85), pieno: a.prezzo })); }
    out.forEach((o, k) => { o.k = i + ':' + k; o.venduto = S.merc.presi.indexOf(o.k) >= 0; });
    return out;
  }
  // modellini sui banchi
  function mettiMerce(b, ids) {
    while (b.merce.children.length) { const c = b.merce.children[0]; b.merce.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    ids.slice(0, 3).forEach((id, k, l) => {
      if (!B.creaMobile || !(B.ARREDI || []).find(a => a.id === id)) return;
      const a = B.ARREDI.find(q => q.id === id), m = B.creaMobile(id), s = clamp(0.8 / Math.max(a.w, a.d, 1.2), 0.18, 0.45);
      m.scale.setScalar(s); m.position.set((k - (l.length - 1) / 2) * 0.95, 0, 0); m.rotation.y = rnd(-0.3, 0.3); b.merce.add(m);
    });
  }
  function merceRiposta() {
    if (!W.banchi) return;
    W.banchi.forEach((b, i) => {
      const t = b.d.tema;
      if (t === 'pesce') {
        if (b.merce.children.length) return;
        [-0.8, 0, 0.8].forEach((x, k) => {
          b.merce.add(mesh(new T.BoxGeometry(0.7, 0.16, 0.5), M('#8a5a35'), { x, y: 0.08, lb: 0.01 }));
          b.merce.add(mesh(new T.BoxGeometry(0.62, 0.04, 0.42), M('#e8f4fb'), { x, y: 0.17 }));
          for (let j = 0; j < 3; j++) { const sp = SPECIE[(k * 3 + j) % 8], f = pesce3D(sp); f.scale.setScalar(0.75); f.rotation.set(0, 0.2 + j * 0.3, 0); f.position.set(x - 0.18 + j * 0.18, 0.24, (j - 1) * 0.08); b.merce.add(f); }
        });
      } else if (t === 'carte') mettiCarte(b);
      else mettiMerce(b, offerte(i).filter(o => !o.venduto).map(o => o.id));
    });
  }
  // le carte di Belinverse in piedi sul banco (tre a caso tra le rare, cambiano ogni giorno)
  function mettiCarte(b) {
    if (b.merce.children.length) return;
    const BC = B.BELIN_CARTE; if (!BC) return;
    const rng = seme(oggi() + ':carte'), rare = BC.CARTE.filter(k => k.r === 'SR'), ids = [];
    while (ids.length < 3 && rare.length) ids.push(rare.splice(Math.floor(rng() * rare.length), 1)[0].id);
    const src = id => (window.BELIN_IMG && window.BELIN_IMG[id]) || ('img/belinverse/' + id + '.webp');
    ids.forEach((id, k) => {
      const tx = new T.TextureLoader().load(src(id)); tx.encoding = T.sRGBEncoding;
      const c = new T.Mesh(new T.PlaneGeometry(0.5, 0.7), new T.MeshBasicMaterial({ map: tx, side: T.DoubleSide }));
      c.position.set((k - 1) * 0.72, 0.42, 0.05 - Math.abs(k - 1) * 0.08); c.rotation.set(-0.22, (1 - k) * 0.25, 0); b.merce.add(c);
      b.merce.add(mesh(new T.BoxGeometry(0.56, 0.06, 0.2), M('#2c2140'), { x: c.position.x, y: 0.03, z: c.position.z + 0.08 }));
    });
    // mazzetti di buste
    [-1.2, 1.2].forEach(x => b.merce.add(mesh(new T.BoxGeometry(0.34, 0.12, 0.46), M('#c8553d'), { x, y: 0.06, z: 0.12, lb: 0.01 })));
  }
  // vecchio "tuo banco": i mobili che ci erano rimasti tornano liberi in casa
  function restituisciBanco() {
    if (!S.banco || !S.banco.length || !B.Eco) return;
    S.banco.forEach(v => B.Eco.regala(v.id)); S.banco = []; salva();
  }
  const Mercato = B.Mercato = {
    aperto: -1,
    annunciRete: () => (S.annunci.length ? S.annunci.map(a => [a.i, a.id, a.p]) : null),
    vendutoA,
    apri(i) {
      Mercato.aperto = i; nuovoGiornoMercato();
      const ven = ruoli.venditori.find(r => r.b === W.banchi[i]);
      if (ven && app.mostraBolla) app.mostraBolla(ven.o, VENDITORI_FRASI[(Math.random() * VENDITORI_FRASI.length) | 0].replace('{nick}', app.io.nick || ''), 3.5);
      Mercato.disegna(); ov.apri(BANCHI[i].nome);
    },
    disegna() {
      const i = Mercato.aperto, c = ov.corpo(); if (!c) return; c.textContent = '';
      const tema = BANCHI[i].tema, ven = ruoli.venditori.find(r => r.b === W.banchi[i]);
      const intro = t => c.appendChild(el('p', 'att-intro', t));
      if (tema === 'pesce') return disegnaPescheria(c, ven);
      if (tema === 'carte') return disegnaBancoCarte(c, ven);
      intro((ven ? '<b>' + ven.o.nick + '</b> · ' : '') + 'Offerte di oggi: domani cambiano. Più giù puoi vendergli i tuoi ' + (tema === 'luci' ? 'lampade e decorazioni' : 'mobili') + ' che non usi.');
      c.appendChild(el('h3', '', 'In vendita oggi'));
      offerte(i).forEach(o => {
        const a = (B.ARREDI || []).find(q => q.id === o.id); if (!a) return;
        const d = el('div', 'att-cd' + (o.top ? ' top' : '')); d.appendChild(immagineMobile(a));
        d.appendChild(el('b', '', a.nome)); d.appendChild(el('small', '', o.pieno && o.pieno > o.prezzo ? '<s>🪙 ' + o.pieno + '</s> −' + Math.round((1 - o.prezzo / o.pieno) * 100) + '%' : a.esclusivo ? 'Esclusivo' : 'Ne hai: ' + (B.Eco ? B.Eco.posseduti(a.id) : 0)));
        const bt = el('button', 'att-bt', o.venduto ? 'Venduto' : '🪙 ' + o.prezzo); bt.disabled = o.venduto || !B.Eco || B.Eco.coins < o.prezzo;
        bt.addEventListener('click', () => {
          if (!B.Eco.spendi(o.prezzo)) return; B.Eco.regala(o.id); S.merc.presi.push(o.k); salva(); missione('mercato');
          ov.dire('Comprato: ' + a.nome + ' (lo trovi in casa, “Arreda”)'); if (ven && app.mostraBolla) app.mostraBolla(ven.o, 'Grazie! Buona giornata!', 3);
          merceRiposta(); Mercato.disegna();
        });
        d.appendChild(bt); c.appendChild(d);
      });
      disegnaVendiMobili(c, tema, ven);
    }
  };
  function disegnaPescheria(c, ven) {
    const resta = Math.max(0, CF.pesca.tettoPescheria - S.vend.c);
    c.appendChild(el('p', 'att-intro', (ven ? '<b>' + ven.o.nick + '</b> · ' : '') + 'Compra i pesci del laghetto. Prezzi di oggi; può spendere ancora 🪙 ' + resta + '.'));
    const ids = SPECIE.filter(s => S.secchio[s.id]);
    if (!ids.length) { c.appendChild(el('p', 'att-vuoto', 'Il tuo secchio è vuoto. Vai a pescare al laghetto, a est della piazza!')); return; }
    let tot = 0; ids.forEach(s => { tot += prezzoPesce(s) * S.secchio[s.id]; });
    const tutto = el('div', 'att-cd big'); tutto.appendChild(el('b', '', 'Nel secchio: ' + pesci(nelSecchio())));
    tutto.appendChild(el('small', '', 'Valgono 🪙 ' + tot + ' in tutto'));
    const bt = el('button', 'att-bt', 'Vendi tutto'); bt.disabled = !resta; bt.addEventListener('click', () => vendiPesci(ids.map(s => s.id), ven)); tutto.appendChild(bt); c.appendChild(tutto);
    ids.forEach(s => {
      const d = el('div', 'att-cd'), im = el('div', 'att-im pesce'); const i = new Image(); i.src = disegnaPesce(s); im.appendChild(i); d.appendChild(im);
      d.appendChild(el('b', '', s.nome + ' ×' + S.secchio[s.id])); d.appendChild(el('small', '', '🪙 ' + prezzoPesce(s) + ' l\'uno'));
      const b = el('button', 'att-bt', 'Vendi'); b.disabled = !resta; b.addEventListener('click', () => vendiPesci([s.id], ven)); d.appendChild(b); c.appendChild(d);
    });
  }
  function vendiPesci(ids, ven) {
    let guad = 0, resta = CF.pesca.tettoPescheria - S.vend.c, finito = false;
    ids.forEach(id => { const sp = SPECIE.find(s => s.id === id), p = prezzoPesce(sp); while (S.secchio[id] > 0) { if (p > resta) { finito = true; break; } S.secchio[id]--; guad += p; resta -= p; } if (!S.secchio[id]) delete S.secchio[id]; });
    S.vend.c += guad; salva(); if (guad && B.Eco) B.Eco.add(guad, 'piazza'); if (guad) missione('mercato');
    ov.dire(guad ? 'Venduto! +' + guad + ' coins' + (finito ? ' (per oggi ha finito i soldi)' : '') : 'Per oggi la Pescheria non compra più: torna domani');
    if (ven && guad && app.mostraBolla) app.mostraBolla(ven.o, 'Che bel pescato!', 3);
    aggSecchio(); Mercato.disegna();
  }
  // vendere i mobili liberi al banco giusto: luci e decorazioni da una parte, tutto il resto ai mobili usati
  function disegnaVendiMobili(c, tema, ven) {
    c.appendChild(el('h3', '', tema === 'luci' ? 'Vendi le tue luci e decorazioni' : 'Vendi i tuoi mobili'));
    const liberi = (B.ARREDI || []).filter(a => B.Eco && B.Eco.liberi(a.id) > 0 && (tema === 'luci') === eLuce(a));
    if (!liberi.length) { c.appendChild(el('p', 'att-vuoto', 'Non hai ' + (tema === 'luci' ? 'luci o decorazioni' : 'mobili') + ' liberi da vendere: quelli che hai sono tutti in casa.')); return; }
    c.appendChild(el('p', 'att-intro', 'Te li ricompra al ' + Math.round(CF.usato.quota * 100) + '% del prezzo del negozio. Vendi solo quelli che non hai messo in casa.'));
    liberi.forEach(a => {
      const prezzo = a.esclusivo || !a.prezzo ? CF.usato.prezzoEsclusivi : Math.max(10, Math.round(a.prezzo * CF.usato.quota)), d = el('div', 'att-cd');
      d.appendChild(immagineMobile(a)); d.appendChild(el('b', '', a.nome)); d.appendChild(el('small', '', 'Ne hai liberi: ' + B.Eco.liberi(a.id)));
      const b = el('button', 'att-bt', 'Vendi a 🪙 ' + prezzo);
      b.addEventListener('click', () => {
        if (B.Eco.liberi(a.id) <= 0) return;
        B.Eco.stato.inv[a.id]--; B.Eco.salva(); B.Eco.add(prezzo, 'rivendita'); missione('mercato');
        ov.dire('Venduto: ' + a.nome + ' (+' + prezzo + ' coins)'); if (ven && app.mostraBolla) app.mostraBolla(ven.o, 'Affare fatto!', 3);
        Mercato.disegna();
      });
      d.appendChild(b); c.appendChild(d);
    });
  }
  // banco Belinverse TCG: compra le carte che hai in più, prezzo secondo la rarità
  const NOMI_RAR_C = { C: 'Comune', R: 'Rara', SR: 'Super rara', alt: 'Belinone Alternative' };
  const COL_RAR_C = { C: '#cfd8dc', R: '#6fb4f0', SR: '#c58bd6', alt: '#f2c76e' };
  const rarCarta = k => k.t === 'L' ? 'alt' : (CF.carte[k.r] ? k.r : 'C');
  const prezzoConsigliato = k => rarCarta(k) === 'alt' ? CF.carte.alt : CF.carte[rarCarta(k)] * CF.annunci.consigliato;
  const nomeCarta = id => ((B.BELIN_CARTE && B.BELIN_CARTE.PER_ID[id]) || { n: id }).n;
  const imgCarta = id => (window.BELIN_IMG && window.BELIN_IMG[id]) || ('img/belinverse/' + id + '.webp');
  function riquadroCarta(k, sotto) {
    const r = rarCarta(k), d = el('div', 'att-cd');
    const im = el('div', 'att-im carta'); const i = new Image(); i.src = imgCarta(k.id); i.alt = k.n; i.loading = 'lazy'; im.appendChild(i); d.appendChild(im);
    d.appendChild(el('b', '', esc(k.n)));
    d.appendChild(el('small', '', '<span class="rar" style="background:' + COL_RAR_C[r] + '">' + NOMI_RAR_C[r] + '</span>' + (sotto ? ' ' + sotto : '')));
    return d;
  }
  function disegnaBancoCarte(c, ven) {
    const BC = B.BELIN_CARTE, BV = B.Belinverse, ON = B.Online;
    const resta = Math.max(0, CF.carte.tetto - S.vendC.c);
    c.appendChild(el('p', 'att-intro', (ven ? '<b>' + ven.o.nick + '</b> · ' : '') + 'Qui le carte di Belinverse 2 si comprano e si vendono tra giocatori: metti in vendita le tue e compra quelle dei tuoi amici online.'));
    if (!BC || !BV) { c.appendChild(el('p', 'att-vuoto', 'Le carte non sono disponibili.')); return; }
    // 1) in vendita dagli amici
    c.appendChild(el('h3', '', '🛒 In vendita dagli altri giocatori'));
    const loro = ON && ON.annunci ? ON.annunci() : [];
    if (!loro.length) c.appendChild(el('p', 'att-vuoto', ON && ON.inLinea && ON.inLinea() ? 'Nessun amico online ha carte in vendita adesso.' : 'Qui vedi le carte messe in vendita dai tuoi amici quando giocate insieme online.'));
    loro.forEach(l => {
      const k = BC.PER_ID[l.id]; if (!k) return;
      const d = riquadroCarta(k, '· da <b>' + esc(l.nick) + '</b>');
      const b = el('button', 'att-bt', l.attesa ? 'In attesa di ' + esc(l.nick) + '…' : 'Compra a 🪙 ' + l.p); b.disabled = l.attesa || !B.Eco || B.Eco.coins < l.p;
      b.addEventListener('click', () => {
        const r = ON.compra(l.nick, l.i);
        ov.dire({ ok: 'Pagato 🪙 ' + l.p + ': aspetta che ' + l.nick + ' ti passi la carta', soldi: 'Non hai abbastanza coins', esaurito: 'Questa carta non è più in vendita', offline: l.nick + ' non è più online', attesa: 'Stai già aspettando questa carta' }[r] || '');
        Mercato.disegna();
      });
      d.appendChild(b); c.appendChild(d);
    });
    // 2) le mie carte in vendita
    c.appendChild(el('h3', '', '🏷️ Le tue carte in vendita <small>' + S.annunci.length + ' / ' + CF.annunci.max + '</small>'));
    if (!S.annunci.length) c.appendChild(el('p', 'att-vuoto', 'Non hai carte in vendita.'));
    else c.appendChild(el('p', 'att-intro', 'Le vedono i tuoi amici quando siete online insieme: quando uno la compra, i coins arrivano a te.'));
    S.annunci.forEach(a => {
      const k = BC.PER_ID[a.id]; if (!k) return;
      const d = riquadroCarta(k, '🪙 ' + a.p);
      const b = el('button', 'att-bt sec', 'Ritira'); b.addEventListener('click', () => { ritiraAnnuncio(a); ov.dire('Ritirata: ' + k.n + ' (torna nello zaino)'); Mercato.disegna(); });
      d.appendChild(b); c.appendChild(d);
    });
    // 3) le mie carte da mettere in vendita
    const coll = BV.collezione();
    const lista = BC.CARTE.concat(BC.LEADER.filter(l => l.alt)).filter(k => BV.vendibili(k.id) > 0);
    c.appendChild(el('h3', '', '🃏 Metti in vendita le tue carte'));
    if (!lista.length) { c.appendChild(el('p', 'att-vuoto', Object.keys(coll).length ? 'Le carte che hai le usi tutte nel tuo mazzo.' : 'Non hai ancora carte. Il venditore della sala TCG ti regala un pacchetto al giorno.')); return; }
    c.appendChild(el('p', 'att-intro', 'Scegli il prezzo (quello proposto dipende dalla rarità). Le copie del tuo mazzo e il Belinone scelto restano tue. Se hai fretta, ' + (ven ? ven.o.nick : 'il banco') + ' te le compra subito a meno: Comune 🪙 ' + CF.carte.C + ', Rara 🪙 ' + CF.carte.R + ', Super rara 🪙 ' + CF.carte.SR + ', Alternative 🪙 ' + CF.carte.alt + ' (oggi può spendere ancora 🪙 ' + resta + ').'));
    const pieno = S.annunci.length >= CF.annunci.max;
    lista.forEach(k => {
      const nv = BV.vendibili(k.id), d = riquadroCarta(k, nv > 1 ? '· ne hai ' + nv + ' da vendere' : '');
      const riga = el('div', 'att-prezzo'), inp = el('input'); inp.type = 'number'; inp.min = 1; inp.max = 99999; inp.inputMode = 'numeric'; inp.value = prezzoConsigliato(k);
      riga.append(el('span', '', '🪙'), inp); d.appendChild(riga);
      const b = el('button', 'att-bt', pieno ? 'Banco pieno' : 'Metti in vendita'); b.disabled = pieno;
      b.addEventListener('click', () => {
        const p = Math.round(+inp.value); if (!(p >= 1 && p <= 99999)) { ov.dire('Scrivi un prezzo da 1 a 99999'); return; }
        if (S.annunci.length >= CF.annunci.max || !BV.vendi(k.id, 1)) return;
        S.annunci.push({ i: ++S.nAnn, id: k.id, p }); salva(); missione('mercato');
        ov.dire('In vendita: ' + k.n + ' a 🪙 ' + p); Mercato.disegna();
      });
      const sub = el('button', 'att-bt sec', 'Vendi subito a 🪙 ' + CF.carte[rarCarta(k)]); sub.disabled = CF.carte[rarCarta(k)] > resta;
      sub.addEventListener('click', () => vendiCarte([{ k, n: 1 }], ven));
      d.append(b, sub); c.appendChild(d);
    });
  }
  function ritiraAnnuncio(a) {
    const n = S.annunci.indexOf(a); if (n < 0) return;
    S.annunci.splice(n, 1); salva(); if (B.Belinverse) B.Belinverse.aggiungi(a.id);
  }
  // un amico ha comprato una carta (online.js): l'annuncio deve esserci ancora, uguale
  function vendutoA(i, id, p, nick) {
    const a = S.annunci.find(x => x.i === i && x.id === id && x.p === p); if (!a) return false;
    S.annunci.splice(S.annunci.indexOf(a), 1); salva();
    if (B.Eco) B.Eco.add(p, 'amici'); missione('mercato');
    toast('🃏 ' + nick + ' ha comprato ' + nomeCarta(id) + ' dal tuo banco (+' + p + ' coins)');
    if (Mercato.aperto >= 0 && ov.aperta()) Mercato.disegna();
    return true;
  }
  function vendiCarte(lista, ven) {
    const BV = B.Belinverse; let guad = 0, n = 0, resta = CF.carte.tetto - S.vendC.c, finito = false;
    lista.forEach(o => { const p = CF.carte[rarCarta(o.k)]; for (let q = 0; q < o.n; q++) { if (p > resta) { finito = true; break; } if (!BV.vendi(o.k.id, 1)) break; guad += p; resta -= p; n++; } });
    S.vendC.c += guad; salva(); if (guad && B.Eco) B.Eco.add(guad, 'piazza'); if (guad) missione('mercato');
    ov.dire(guad ? 'Vendut' + (n > 1 ? 'e ' + n + ' carte' : 'a') + '! +' + guad + ' coins' + (finito ? ' (per oggi ha finito i soldi)' : '') : 'Per oggi il banco non compra più carte: torna domani');
    if (ven && guad && app.mostraBolla) app.mostraBolla(ven.o, 'Bella carta!', 3);
    Mercato.disegna();
  }
  function immagineMobile(a) {
    const im = el('div', 'att-im'), src = B.anteprimaMobile ? B.anteprimaMobile(a.id) : null;
    if (src) { const i = new Image(); i.src = src; i.alt = a.nome; im.appendChild(i); } else im.textContent = '🪑';
    return im;
  }

  /* =====================================================================
     DISEGNO DEI PESCI (per la collezione e le carte)
     ===================================================================== */
  const cachePesci = {};
  function disegnaPesce(sp, sagoma) {
    const k = sp.id + (sagoma ? '_s' : ''); if (cachePesci[k]) return cachePesci[k];
    const [cv, x] = B.tela(200, 130), cx = 104, cy = 66;
    x.lineJoin = 'round'; x.lineWidth = 4; x.strokeStyle = '#2a1a2e';
    if (sp.forma === 'stivale') {
      x.beginPath(); x.moveTo(70, 18); x.lineTo(118, 18); x.lineTo(118, 78); x.lineTo(160, 86); x.quadraticCurveTo(172, 92, 166, 108); x.lineTo(70, 108); x.closePath();
      x.fillStyle = sp.col; x.fill(); x.stroke(); x.fillStyle = sp.col2; x.fillRect(70, 100, 98, 8); x.strokeRect(70, 100, 97, 8);
      x.fillStyle = '#7fd6f2'; x.beginPath(); x.arc(150, 40, 6, 0, 7); x.arc(140, 22, 4, 0, 7); x.fill();
    } else {
      const lungo = sp.forma === 'anguilla' ? 82 : sp.forma === 'lungo' ? 70 : sp.forma === 'tondo' ? 44 : 58, alto = sp.forma === 'anguilla' ? 13 : sp.forma === 'lungo' ? 19 : sp.forma === 'tondo' ? 38 : 28;
      // coda
      x.beginPath(); x.moveTo(cx - lungo + 8, cy); x.lineTo(cx - lungo - 26, cy - alto * 0.9 - 6); x.quadraticCurveTo(cx - lungo - 14, cy, cx - lungo - 26, cy + alto * 0.9 + 6); x.closePath();
      x.fillStyle = sp.col2; x.fill(); x.stroke();
      // pinna dorsale
      x.beginPath(); x.moveTo(cx - lungo * 0.45, cy - alto + 4); x.quadraticCurveTo(cx - lungo * 0.1, cy - alto - 22, cx + lungo * 0.25, cy - alto + 2); x.closePath(); x.fillStyle = sp.col2; x.fill(); x.stroke();
      // corpo
      x.save(); x.beginPath(); x.ellipse(cx, cy, lungo, alto, 0, 0, PI * 2); const gr = x.createLinearGradient(0, cy - alto, 0, cy + alto); gr.addColorStop(0, sp.col); gr.addColorStop(0.62, sp.col); gr.addColorStop(1, sp.motivo === 'koi' ? sp.col : sp.col2); x.fillStyle = gr; x.fill(); x.clip();
      const mo = sp.motivo;
      if (mo === 'strisce') { x.fillStyle = 'rgba(30,40,30,0.35)'; for (let i = -3; i <= 3; i++) x.fillRect(cx + i * 15 - 4, cy - alto, 7, alto * 2); }
      if (mo === 'macchie') { x.fillStyle = sp.id === 'trota' ? 'rgba(240,143,180,0.85)' : 'rgba(230,230,160,0.85)'; if (sp.id === 'trota') x.fillRect(cx - lungo, cy - 4, lungo * 2, 9); x.fillStyle = 'rgba(40,40,30,0.5)'; for (let i = 0; i < 16; i++) { x.beginPath(); x.arc(cx - lungo * 0.8 + (i * 37 % (lungo * 1.6)), cy - alto * 0.6 + (i * 13 % (alto * 1.1)), 2.6, 0, 7); x.fill(); } }
      if (mo === 'koi') { x.fillStyle = sp.col2; [[-20, -10, 18], [12, -6, 15], [34, 6, 10], [-38, 8, 9]].forEach(m => { x.beginPath(); x.ellipse(cx + m[0], cy + m[1], m[2] * 1.3, m[2], 0.3, 0, 7); x.fill(); }); }
      if (mo === 'scaglie') { x.strokeStyle = 'rgba(120,60,10,0.35)'; x.lineWidth = 2; for (let r = -2; r <= 2; r++) for (let c = -4; c <= 3; c++) { x.beginPath(); x.arc(cx + c * 13 + (r % 2) * 6, cy + r * 9, 6, 0.3, PI - 0.3); x.stroke(); } x.strokeStyle = '#2a1a2e'; x.lineWidth = 4; }
      if (mo === 'petali') { x.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 6; i++) { x.save(); x.translate(cx - 34 + i * 13, cy - 6 + (i % 2) * 12); x.rotate(i); x.beginPath(); x.ellipse(0, 0, 6, 3, 0, 0, 7); x.fill(); x.restore(); } }
      if (mo === 'luce') { x.fillStyle = 'rgba(255,227,106,0.6)'; for (let i = 0; i < 7; i++) { x.beginPath(); x.arc(cx - 26 + i * 9, cy + 12, 2.6, 0, 7); x.fill(); } }
      x.restore();
      x.beginPath(); x.ellipse(cx, cy, lungo, alto, 0, 0, PI * 2); x.stroke();
      // pinna laterale
      x.beginPath(); x.moveTo(cx + lungo * 0.15, cy + alto * 0.25); x.quadraticCurveTo(cx - lungo * 0.15, cy + alto * 0.75, cx - lungo * 0.05, cy + alto * 0.95); x.quadraticCurveTo(cx + lungo * 0.12, cy + alto * 0.6, cx + lungo * 0.15, cy + alto * 0.25); x.fillStyle = sp.col2; x.fill(); x.lineWidth = 2.5; x.stroke(); x.lineWidth = 4;
      // occhio
      const ex = cx + lungo * 0.62, ey = cy - alto * 0.22;
      x.fillStyle = '#fff'; x.beginPath(); x.arc(ex, ey, 6.5, 0, 7); x.fill(); x.lineWidth = 2.5; x.stroke(); x.fillStyle = '#1a1020'; x.beginPath(); x.arc(ex + 1.5, ey, 3.4, 0, 7); x.fill(); x.lineWidth = 4;
      if (mo === 'baffi') { x.lineWidth = 2.5; [[-1, 18], [1, 14]].forEach(b => { x.beginPath(); x.moveTo(cx + lungo - 4, cy + 4); x.quadraticCurveTo(cx + lungo + 14, cy + 4 + b[0] * 6, cx + lungo + 20, cy + b[1]); x.stroke(); }); x.lineWidth = 4; }
      if (mo === 'luce') { x.lineWidth = 2.5; x.beginPath(); x.moveTo(cx + lungo * 0.4, cy - alto + 2); x.quadraticCurveTo(cx + lungo * 0.8, cy - alto - 30, cx + lungo + 12, cy - alto - 14); x.stroke(); x.shadowColor = '#ffe36a'; x.shadowBlur = 18; x.fillStyle = '#fff6b0'; x.beginPath(); x.arc(cx + lungo + 12, cy - alto - 12, 7, 0, 7); x.fill(); x.shadowBlur = 0; x.lineWidth = 4; }
      if (mo === 'corona') { x.fillStyle = '#ffd36a'; x.beginPath(); const bx = cx + lungo * 0.38, by = cy - alto - 2; x.moveTo(bx - 14, by); x.lineTo(bx - 14, by - 16); x.lineTo(bx - 7, by - 8); x.lineTo(bx, by - 20); x.lineTo(bx + 7, by - 8); x.lineTo(bx + 14, by - 16); x.lineTo(bx + 14, by); x.closePath(); x.fill(); x.lineWidth = 2.5; x.stroke(); x.lineWidth = 4; }
    }
    if (sagoma) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = '#3a2f4e'; x.fillRect(0, 0, 200, 130); x.globalCompositeOperation = 'source-over'; }
    return (cachePesci[k] = cv.toDataURL());
  }

  /* =====================================================================
     INTERFACCIA
     ===================================================================== */
  const css = document.createElement('style');
  css.textContent = `
#pesca-pan{position:absolute;left:12px;bottom:calc(var(--h-tab) + var(--h-chat,0px) + 14px);z-index:12;display:none;flex-direction:column;gap:7px;width:min(260px,calc(100% - 150px));padding:10px;border-radius:18px;background:rgba(28,19,40,.86);border:1px solid rgba(242,199,110,.45);box-shadow:0 8px 24px rgba(0,0,0,.45);color:#fbf3dc;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
#pesca-pan.on{display:flex}
#pesca-pan .tt{font-size:13.5px;font-weight:700;text-align:center;min-height:18px;line-height:1.25}
#pesca-pan .main{border:0;border-radius:14px;padding:14px 10px;font:800 18px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;cursor:pointer;box-shadow:0 3px 0 #b8893a}
#pesca-pan .main:active{transform:translateY(2px);box-shadow:0 1px 0 #b8893a}
#pesca-pan .main.aspetta{background:rgba(255,255,255,.16);color:#fbf3dc;box-shadow:none}
#pesca-pan .main.tira{background:#e0473c;color:#fff;box-shadow:0 3px 0 #9a2a22;animation:pescaTira .35s ease-in-out infinite alternate}
@keyframes pescaTira{to{transform:scale(1.05)}}
#pesca-pan .barra{position:relative;height:22px;border-radius:11px;background:rgba(255,255,255,.15);overflow:hidden;display:none}
#pesca-pan .barra.on{display:block}
#pesca-pan .barra .zona{position:absolute;top:0;bottom:0;background:#6fd36a;border-radius:6px}
#pesca-pan .barra .ago{position:absolute;top:-2px;bottom:-2px;width:5px;margin-left:-2.5px;background:#fff;border-radius:3px;box-shadow:0 0 6px #fff}
#pesca-pan .sec{display:flex;gap:6px}
#pesca-pan .sec button{flex:1;border:0;border-radius:10px;padding:7px 4px;font:700 12.5px inherit;font-family:inherit;color:#fbf3dc;background:rgba(255,255,255,.13);cursor:pointer;white-space:nowrap}
body.pescando #controlli,body.pescando #btn-contesto{display:none!important}
body.orizz #pesca-pan{left:auto;right:136px;bottom:16px}
#pesca-carta{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 92px);transform:translateX(-50%) scale(.9);z-index:13;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;width:min(260px,80vw);padding:12px 14px;border-radius:20px;background:linear-gradient(#3a2a52,#241a33);border:2px solid #f2c76e;color:#fbf3dc;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#pesca-carta.on{opacity:1;transform:translateX(-50%) scale(1);pointer-events:auto}
#pesca-carta img{width:150px;height:auto;display:block;margin:0 auto}
#pesca-carta b{display:block;font-size:17px}#pesca-carta .rar{display:inline-block;margin:3px 0;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:800;color:#2a1a2e}
#pesca-carta small{display:block;opacity:.85;font-size:12.5px}#pesca-carta .nuovo{color:#ffd36a;font-weight:800}
.att-ov{position:fixed;inset:0;z-index:300;display:none;flex-direction:column;background:#241a30;color:#fbf3dc}
.att-ov.on{display:flex}
.att-ov .sb{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;background:linear-gradient(#5a3a2f,#3f2a22);border-bottom:2px solid #f2c76e;flex:0 0 auto}
.att-ov .sb button{border:0;border-radius:12px;padding:9px 14px;font:800 14px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;cursor:pointer;white-space:nowrap}
.att-ov .sb b{flex:1;text-align:center;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.att-ov .mon{padding:6px 12px;border-radius:99px;background:rgba(255,211,106,.95);color:#3a2216;font-weight:800;font-size:14px;white-space:nowrap}
.att-ov .gr{flex:1 1 auto;overflow:auto;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:14px 12px calc(env(safe-area-inset-bottom,0px) + 24px);max-width:720px;width:100%;margin:0 auto;box-sizing:border-box;align-content:start}
@media(min-width:640px){.att-ov .gr{grid-template-columns:repeat(3,1fr)}}
.att-ov .att-intro,.att-ov .att-vuoto,.att-ov h3{grid-column:1/-1;margin:2px 2px 0;font-size:14px;line-height:1.35;opacity:.92}
.att-ov h3{margin-top:8px;font-size:15px;color:#f2c76e;opacity:1}
.att-ov .att-vuoto{opacity:.7;font-style:italic}
.att-ov .att-cd{border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(242,199,110,.3);padding:10px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}
.att-ov .att-cd.top{border-color:#f2c76e;box-shadow:0 0 0 2px rgba(242,199,110,.35)}
.att-ov .att-cd.big{grid-column:1/-1}
.att-ov .att-cd.ignoto{opacity:.75}
.att-ov .att-im{width:100%;aspect-ratio:1/1;border-radius:12px;background:radial-gradient(circle at 50% 40%,#5a4670,#2c2038);display:grid;place-items:center;font-size:44px;overflow:hidden}
.att-ov .att-im.pesce{aspect-ratio:200/130;background:radial-gradient(circle at 50% 45%,#3f7fa8,#1f3f5a)}
.att-ov .att-im img{width:100%;height:100%;object-fit:contain}
.att-ov .att-im.carta{aspect-ratio:5/7;background:none;border-radius:8px}
.att-ov .att-prezzo{display:flex;align-items:center;gap:6px;width:100%;margin-top:4px}
.att-ov .att-prezzo input{flex:1;min-width:0;border:1px solid rgba(242,199,110,.5);border-radius:10px;background:rgba(0,0,0,.25);color:#fbf3dc;font:700 16px inherit;font-family:inherit;padding:7px 8px;text-align:center}
.att-ov .att-cd .att-bt+.att-bt{margin-top:6px}
.att-ov .att-cd b{font-size:15px}.att-ov .att-cd small{opacity:.8;font-size:12.5px}
.att-ov .rar{padding:1px 8px;border-radius:99px;font-size:11px;font-weight:800;color:#2a1a2e}
.att-ov .att-bt{border:0;border-radius:12px;padding:9px 12px;font:800 14px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;cursor:pointer;width:100%;margin-top:auto}
.att-ov .att-bt.sec{background:rgba(255,255,255,.16);color:#fbf3dc}
.att-ov .att-bt:disabled{background:rgba(255,255,255,.18);color:rgba(255,255,255,.55);cursor:default}
.att-ov .prog{height:10px;border-radius:5px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:6px;width:100%}.att-ov .prog i{display:block;height:100%;background:#f2c76e}
.att-ov .msg{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 26px);transform:translateX(-50%);background:#f2c76e;color:#2a1a2e;font-weight:800;padding:10px 16px;border-radius:14px;opacity:0;transition:opacity .25s;pointer-events:none;max-width:90vw;text-align:center}
.att-ov .msg.on{opacity:1}
`;
  document.head.appendChild(css);

  /* ---------- schermata a tutto schermo (mercatino e collezione) ---------- */
  const ov = (() => {
    let nodo = null, gr = null, msg = null, tm = 0, alChiudere = null;
    function crea() {
      nodo = el('div', 'att-ov');
      nodo.innerHTML = '<div class="sb"><button class="bk">← Torna al gioco</button><b></b><span class="mon">🪙 <span class="coins-val">' + (B.Eco ? B.Eco.coins : 0) + '</span></span></div><div class="gr"></div><div class="msg"></div>';
      document.body.appendChild(nodo); gr = nodo.querySelector('.gr'); msg = nodo.querySelector('.msg');
      nodo.querySelector('.bk').addEventListener('click', () => o.chiudi());
      window.addEventListener('keydown', e => { if (e.key === 'Escape' && nodo.classList.contains('on')) o.chiudi(); });
    }
    const o = {
      apri(titolo, chiudi) { if (!nodo) crea(); nodo.querySelector('.sb b').textContent = titolo; nodo.classList.add('on'); alChiudere = chiudi || null; if (B.Eco) B.Eco.avvisa(); if (app && app.joy) app.joy.x = app.joy.y = 0; gr.scrollTop = 0; },
      chiudi() { if (nodo) nodo.classList.remove('on'); Mercato.aperto = -1; if (alChiudere) { const f = alChiudere; alChiudere = null; f(); } },
      corpo() { if (!nodo) crea(); return gr; },
      dire(t) { msg.textContent = t; msg.classList.add('on'); clearTimeout(tm); tm = setTimeout(() => msg.classList.remove('on'), 2400); },
      aperta: () => !!(nodo && nodo.classList.contains('on'))
    };
    return o;
  })();

  /* ---------- collezione dei pesci ---------- */
  function apriCollezione() {
    const c = ov.corpo(); c.textContent = '';
    const n = trovate(), tot = SPECIE.filter(s => !s.curiosita).length;
    const top = el('div', 'att-cd big');
    top.appendChild(el('b', '', 'Specie trovate: ' + n + ' / ' + tot));
    top.appendChild(el('small', '', S.trofeo ? '🏆 Hai vinto il Trofeo di pesca (lo trovi in casa, “Arreda”)' : 'A ' + CF.pesca.trofeo + ' specie vinci il Trofeo di pesca, un mobile esclusivo'));
    const pr = el('div', 'prog'), pi = el('i'); pi.style.width = Math.min(100, n / tot * 100) + '%'; pr.appendChild(pi); top.appendChild(pr);
    top.appendChild(el('small', '', 'Nel secchio: ' + pesci(nelSecchio()) + ' · vendili alla Pescheria del mercatino'));
    c.appendChild(top);
    SPECIE.forEach(s => {
      const r = S.pesci[s.id], d = el('div', 'att-cd' + (r ? '' : ' ignoto')), im = el('div', 'att-im pesce'), i = new Image(); i.src = disegnaPesce(s, !r); im.appendChild(i); d.appendChild(im);
      d.appendChild(el('b', '', r ? s.nome : '???'));
      const rr = el('span', 'rar', RAR[s.rar].nome); rr.style.background = RAR[s.rar].col; d.appendChild(rr);
      d.appendChild(el('small', '', r ? (s.curiosita ? 'Pescati: ' + r.n : 'Pescati: ' + r.n + ' · record ' + r.rec + ' cm') : (s.quando ? QUANDO[s.quando] : 'Ancora da pescare')));
      c.appendChild(d);
    });
    ov.apri('Collezione del laghetto');
  }

  /* ---------- pannello della pesca ---------- */
  let pan = null, carta_ = null, tCarta = 0;
  function creaPannello() {
    pan = el('div'); pan.id = 'pesca-pan';
    pan.innerHTML = '<div class="tt"></div><div class="barra"><i class="zona"></i><i class="ago"></i></div><button class="main"></button><div class="sec"><button data-a="coll">📖 Collezione</button><button data-a="esci">Smetti</button></div>';
    (document.getElementById('app') || document.body).appendChild(pan);
    pan.querySelector('.main').addEventListener('click', e => { e.preventDefault(); Pesca.tocco(); });
    pan.querySelector('[data-a=coll]').addEventListener('click', () => apriCollezione());
    pan.querySelector('[data-a=esci]').addEventListener('click', () => { if (app && app.io.seduto && app.io.seduto.pesca !== undefined) { const s = app.io.seduto; app.io.seduto = null; app.io.x = s.esci.x; app.io.z = s.esci.z; } Pesca.fine(); });
    window.addEventListener('keydown', e => { if (Pesca.attivo && (e.key === ' ' || e.key === 'Enter') && !(e.target && e.target.tagName === 'INPUT')) { e.preventDefault(); Pesca.tocco(); } });
    carta_ = el('div'); carta_.id = 'pesca-carta'; (document.getElementById('app') || document.body).appendChild(carta_);
    carta_.addEventListener('click', () => carta_.classList.remove('on'));
  }
  function pannello(on) {
    if (!pan) creaPannello(); pan.classList.toggle('on', on); barra(false); document.body.classList.toggle('pescando', on);
    const bc = document.getElementById('btn-contesto'); if (bc && on) bc.hidden = true;
    if (on) aggSecchio();
  }
  function stato(testo, bottone, aspetta) {
    if (!pan) return; pan.querySelector('.tt').textContent = testo;
    const b = pan.querySelector('.main'); b.textContent = bottone || '…'; b.classList.toggle('aspetta', !!aspetta); b.classList.toggle('tira', Pesca.st === 'abbocca');
  }
  function barra(on) {
    if (!pan) return; const b = pan.querySelector('.barra'); b.classList.toggle('on', on);
    if (on) { const z = b.querySelector('.zona'); z.style.left = Pesca.zona.a * 100 + '%'; z.style.width = Pesca.zona.w * 100 + '%'; aggBarra(); }
  }
  function aggBarra() { if (pan) pan.querySelector('.ago').style.left = Pesca.ago * 100 + '%'; }
  function aggSecchio() { if (pan) pan.querySelector('[data-a=coll]').textContent = '📖 Collezione · 🪣 ' + nelSecchio(); }
  function carta(sp, cm, nuovo, record, premio) {
    if (!carta_) creaPannello(); const r = RAR[sp.rar];
    carta_.innerHTML = '<img alt=""><b></b><span class="rar"></span><small class="d"></small><small class="nuovo"></small>';
    carta_.querySelector('img').src = disegnaPesce(sp); carta_.querySelector('b').textContent = sp.nome;
    const rr = carta_.querySelector('.rar'); rr.textContent = r.nome; rr.style.background = r.col;
    carta_.querySelector('.d').textContent = sp.curiosita ? 'Non vale niente, ma finisce in collezione' : cm + ' cm · alla Pescheria vale 🪙 ' + prezzoPesce(sp);
    carta_.querySelector('.nuovo').textContent = premio === 'trofeo' ? '🏆 ' + CF.pesca.trofeo + ' specie! Hai vinto il Trofeo di pesca' : nuovo ? '✨ Nuova specie per la collezione!' : record ? '📏 Nuovo record!' : '';
    carta_.classList.add('on'); clearTimeout(tCarta); tCarta = setTimeout(() => carta_.classList.remove('on'), premio ? 4500 : 2800);
  }

  /* =====================================================================
     AVVIO
     ===================================================================== */
  B.Attivita = {
    alt: altezza,
    init(a) {
      app = a;
      W.ctx.anim.push((t, dt) => { aggiornaRuoli(t, dt); Pesca.frame(t, dt); });
      const g = G();
      if (g) {
        g.su('stanza', () => { if (Pesca.attivo && a.stanza().id !== 'piazza') Pesca.fine(); if (Ruota.attiva && a.stanza().id !== 'piazza') Ruota.scendi(false); });
        g.su('avvio', () => { merceRiposta(); restituisciBanco(); });
        g.su('annunci', () => { if (Mercato.aperto >= 0 && ov.aperta() && BANCHI[Mercato.aperto].tema === 'carte' && !(document.activeElement && document.activeElement.tagName === 'INPUT')) Mercato.disegna(); });
        g.su('porta', p => { if (Pesca.attivo) { const bc = document.getElementById('btn-contesto'); if (bc) bc.hidden = true; } });
      }
      if (B.Eco) B.Eco.su(() => { if (Mercato.aperto >= 0 && ov.aperta()) Mercato.disegna(); });
      restituisciBanco();
    },
    stato: S, CF, SPECIE, apriCollezione, _W: W
  };
})();
