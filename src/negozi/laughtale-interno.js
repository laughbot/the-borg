/* =====================================================================
   THE BORG 3D - LAUGH TALE COLLECTIBLES (interno): negozio con scaffali di
   prodotti e distributori automatici. Toccando un distributore si apre il
   sito del negozio (finestra a schermo intero dentro l'app, vedi ltc.js).
   Le pareti davanti alla camera diventano trasparenti, come in casa.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, rnd = B.rnd;
  const PI = Math.PI;

  // due stanze: il negozio Laugh Tale (si entra dalla piazza) e, attraverso una porta, la sala giochi TCG
  const DIM = { negozio: { X: 10.5, Z0: -5, Z1: 15 }, tcg: { X: 21, Z0: -13, Z1: 15 } };

  function costruisciCollectibles(scena, parte) {
    parte = parte || 'negozio'; const SHOP = parte === 'negozio', { X, Z0, Z1 } = DIM[parte], AREA = { x0: -X + 0.7, x1: X - 0.7, z0: Z0 + 0.8, z1: Z1 - 0.8 };
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), M(col), { x, y, z, l: l === undefined ? 0.018 : l }); g.add(m); return m; };
    const legno = '#a96f44', legnoS = '#6b4326';

    /* ---------- base, pavimento, nuvole ---------- */
    scena.add(mesh(new T.BoxGeometry(2 * X + 0.4, 0.9, Z1 - Z0 + 0.4), M('#6f6485'), { y: -0.46, z: (Z0 + Z1) / 2, lb: 0.05 }));
    for (let i = 0; i < (SHOP ? 10 : 20); i++) { const c = mesh(new T.ConeGeometry(rnd(0.9, 1.7), rnd(1.5, 2.8), 7), M('#554a70'), { x: rnd(-X + 1, X - 1), y: -1.6 - rnd(0, 0.6), z: rnd(Z0 + 1, Z1 - 1) }); c.rotation.x = PI; scena.add(c); }
    const [cvP, xP] = B.tela(512, 256); xP.fillStyle = '#5e6068'; xP.fillRect(0, 0, 512, 256);
    for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) { const v = rnd(-6, 6); xP.fillStyle = 'rgb(' + Math.round(148 + v) + ',' + Math.round(151 + v) + ',' + Math.round(158 + v) + ')'; xP.fillRect(q * 256 + 4, r * 128 + 4, 248, 120); xP.fillStyle = 'rgba(255,255,255,.18)'; xP.fillRect(q * 256 + 4, r * 128 + 4, 248, 6); }
    let tPav;
    if (SHOP) { tPav = B.tex(cvP, true); tPav.repeat.set(2 * X / 4, (Z1 - Z0) / 2); }                 // negozio: piastrelle grigie come nel negozio vero
    else { tPav = B.texParquet(); tPav.repeat.set(2 * X / 4, (Z1 - Z0) / 4); }                          // sala giochi: parquet
    const pav = new T.Mesh(new T.PlaneGeometry(2 * X, Z1 - Z0), new T.MeshToonMaterial({ map: tPav, gradientMap: gm, color: SHOP ? new T.Color('#ffffff') : new T.Color('#b8a0c8') })); pav.rotation.x = -PI / 2; pav.position.set(0, 0.002, (Z0 + Z1) / 2); pav.receiveShadow = true; scena.add(pav);
    if (!SHOP) { const tap = new T.Mesh(new T.PlaneGeometry(9, 5), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); tap.rotation.x = -PI / 2; tap.position.set(0, 0.012, 11.0); scena.add(tap); }
    const nuvole = [];
    for (let i = 0; i < 8; i++) {
      const g = new T.Group(), a = i / 8 * 6.283 + rnd(-0.2, 0.2), rx = X + 11 + rnd(0, 6), rz = (Z1 - Z0) / 2 + 9 + rnd(0, 5);
      g.position.set(Math.cos(a) * rx, rnd(-5, -2.4), (Z0 + Z1) / 2 + Math.sin(a) * rz);
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) { const b = mesh(new T.IcosahedronGeometry(rnd(1.0, 1.9), 1), new T.MeshBasicMaterial({ color: 0xfff1e8, transparent: true, opacity: 0.88 }), { cast: false, recv: false }); b.position.set((k - n / 2) * 1.5, rnd(-0.2, 0.4), rnd(-0.6, 0.6)); b.scale.y = 0.6; g.add(b); }
      g.userData.base = g.position.x; g.userData.v = rnd(0.1, 0.25); g.userData.f = rnd(0, 6); scena.add(g); nuvole.push(g);
    }
    anim.push(t => nuvole.forEach(g => { g.position.x = g.userData.base + Math.sin(t * g.userData.v + g.userData.f) * 1.3; }));

    /* ---------- pareti ---------- */
    const matVetro = () => { const m = new T.MeshToonMaterial({ color: new T.Color('#bfe3f2'), gradientMap: gm, emissive: new T.Color('#bfe3f2'), emissiveIntensity: 0.6 }); vetri.push(m); return m; };
    function finestra(g, x, y, w, h) {
      scatola(g, w + 0.34, h + 0.34, 0.12, '#f4ecdf', x, y, 0.03);
      const v = new T.Mesh(new T.PlaneGeometry(w, h), matVetro()); v.position.set(x, y, 0.1); g.add(v);
      scatola(g, 0.07, h, 0.05, '#f4ecdf', x, y, 0.13, 0); scatola(g, w, 0.07, 0.05, '#f4ecdf', x, y, 0.13, 0);
      scatola(g, w + 0.6, 0.1, 0.34, '#e8dcc8', x, y - h / 2 - 0.2, 0.15, 0.012);
    }
    function quadro(g, x, y, w, h, c1, c2) {
      scatola(g, w + 0.16, h + 0.16, 0.07, '#2a2038', x, y, 0.04, 0.01);
      const p = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshToonMaterial({ map: B.texQuadro(c1, c2), gradientMap: gm })); p.position.set(x, y, 0.085); g.add(p);
    }
    function parete(len, col, wx, wz, rotY, out, contenuto) {
      const g = new T.Group(); g.position.set(wx, 0, wz); g.rotation.y = rotY; scena.add(g);
      const corpo = mesh(new T.BoxGeometry(len, 4, 0.3), M(col), { y: 2, z: -0.15, lb: 0.03 }); corpo.castShadow = false; g.add(corpo);
      scatola(g, len, 0.3, 0.08, legnoS, 0, 0.15, 0.04, 0.012);
      scatola(g, len, 0.16, 0.14, '#f4ecdf', 0, 3.92, 0.07, 0.012);
      contenuto(g);
      muri.push({ g, out, mats: [], lines: [], q: 1, ap: 1 });
      return g;
    }

    /* ---------- pareti ---------- */
    // porta in una parete laterale (lx = posizione lungo la parete): cornice, anta e targhetta
    function portaMuro(g, lx, testo) {
      scatola(g, 2.0, 2.9, 0.14, '#f4ecdf', lx, 1.45, 0.05); scatola(g, 1.6, 2.7, 0.1, '#7a4a30', lx, 1.35, 0.1, 0.01);
      scatola(g, 0.12, 0.12, 0.08, '#e3a63a', lx + 0.55, 1.3, 0.18, 0);
      const [cv, x] = B.tela(256, 64); B.rr(x, 2, 2, 252, 60, 12); x.fillStyle = '#1b1530'; x.fill(); x.lineWidth = 4; x.strokeStyle = '#ffd36a'; x.stroke();
      x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff1b8'; x.fillText(testo, 128, 34);
      const tg = new T.Mesh(new T.PlaneGeometry(1.8, 0.45), new T.MeshBasicMaterial({ map: B.tex(cv) })); tg.position.set(lx, 3.2, 0.12); g.add(tg);
    }
    const ZC = (Z0 + Z1) / 2;
    if (SHOP) {
      parete(2 * X + 0.6, '#2d2552', 0, Z0, 0, [0, -1], g => {
        finestra(g, -8.4, 2.4, 1.2, 1.1); finestra(g, 8.4, 2.4, 1.2, 1.1);
        const ins = new T.Mesh(new T.PlaneGeometry(4.9, 1.12), new T.MeshBasicMaterial({ map: B.texInsegnaLTC(1024, 234), transparent: true })); ins.position.set(0, 3.3, 0.1); g.add(ins);
      });
      parete(Z1 - Z0 + 0.3, '#2a2248', -X, ZC, PI / 2, [-1, 0], g => { [-6, 0, 6].forEach(z => finestra(g, z, 2.9, 1.2, 1.1)); portaMuro(g, -4, 'SALA TCG'); });     // porta verso la sala TCG (sulla parete ovest, sempre visibile)
      parete(Z1 - Z0 + 0.3, '#2a2248', X, ZC, -PI / 2, [1, 0], g => { finestra(g, -7, 2.9, 1.2, 1.1); finestra(g, 4, 2.9, 1.2, 1.1); });
    } else {
      parete(2 * X + 0.6, '#2d2552', 0, Z0, 0, [0, -1], g => {
        [-16, -9, 9, 16].forEach(x => finestra(g, x, 2.4, 1.5, 1.1));
        const [cv, x] = B.tela(512, 112); B.rr(x, 4, 4, 504, 104, 26); x.fillStyle = '#1b1530'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#ffd36a'; x.stroke();
        x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8; x.strokeStyle = '#1a6bd6'; x.strokeText('SALA GIOCHI TCG', 256, 60); x.fillStyle = '#fff1b8'; x.fillText('SALA GIOCHI TCG', 256, 60);
        const ins = new T.Mesh(new T.PlaneGeometry(6.0, 1.31), new T.MeshBasicMaterial({ map: B.tex(cv), transparent: true })); ins.position.set(0, 3.2, 0.1); g.add(ins);
      });
      parete(Z1 - Z0 + 0.3, '#2a2248', -X, ZC, PI / 2, [-1, 0], g => { finestra(g, 6, 2.9, 1.4, 1.1); finestra(g, -4, 2.9, 1.4, 1.1); finestra(g, -10, 2.9, 1.4, 1.1); portaMuro(g, -8, 'NEGOZIO'); });    // porta verso il negozio
      parete(Z1 - Z0 + 0.3, '#2a2248', X, ZC, -PI / 2, [1, 0], g => { [-10, -4, 2, 8].forEach(z => finestra(g, z, 2.9, 1.4, 1.1)); });
    }

    /* ---------- prodotti: scatole booster, Funko, Beyblade, manga ---------- */
    const COL = ['#3b5fc4', '#c4453b', '#3a9a7a', '#8a5ac4', '#e9b44c', '#e07a9a', '#2fb8d9'];
    const NERO = '#17171c';
    function prodotto(g, tipo, x, y, z, i) {
      const c = COL[i % COL.length];
      if (tipo === 0) { scatola(g, 0.36, 0.22, 0.26, c, x, y + 0.11, z, 0.012); scatola(g, 0.37, 0.05, 0.27, '#f4ecdf', x, y + 0.18, z, 0); }       // booster box
      else if (tipo === 1) { scatola(g, 0.2, 0.28, 0.17, '#f4ecdf', x, y + 0.14, z, 0.01); const f = mesh(new T.SphereGeometry(0.075, 10, 8), M(c), { x, y: y + 0.2, z: z + 0.0, l: 0.012 }); g.add(f); g.add(mesh(new T.SphereGeometry(0.05, 8, 6), M('#f1c9a5'), { x, y: y + 0.3, z: z + 0.0, l: 0.01 })); }  // Funko
      else if (tipo === 3) { scatola(g, 0.09, 0.34, 0.24, c, x, y + 0.17, z, 0.008); scatola(g, 0.091, 0.1, 0.241, '#f4ecdf', x, y + 0.2, z, 0); }       // manga
      else { const d = mesh(new T.CylinderGeometry(0.1, 0.1, 0.035, 14), M(c), { x, y: y + 0.02, z, l: 0.01 }); g.add(d); g.add(mesh(new T.CylinderGeometry(0.035, 0.035, 0.06, 8), M('#d9dbe6'), { x, y: y + 0.06, z, l: 0 })); }                // Beyblade
    }
    // insegna bianca con il nome del gioco, come sopra gli scaffali del negozio vero
    function insegna(g, testo, w, y) {
      const [cv, x] = B.tela(512, 96); x.fillStyle = '#f4f4f6'; x.fillRect(0, 0, 512, 96); x.lineWidth = 6; x.strokeStyle = '#17171c'; x.strokeRect(3, 3, 506, 90);
      x.font = 'bold ' + (testo.length > 14 ? 40 : 52) + 'px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#17171c'; x.fillText(testo, 256, 50);
      const p = new T.Mesh(new T.PlaneGeometry(w, w * 96 / 512), new T.MeshBasicMaterial({ map: B.tex(cv) })); p.position.set(0, y, 0.3); g.add(p);
    }
    // libreria nera con ripiani pieni di prodotti (tipo: 0 box, 1 Funko, 2 Beyblade, 3 manga, undefined = misto)
    function scaffale(x, z, rot, n, o) {
      o = o || {}; const H = o.h || 2.2, sp = (H - 0.5) / 4;
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scena.add(g);
      scatola(g, n * 1.1 + 0.2, H, 0.5, NERO, 0, H / 2, -0.1, 0.02);
      for (let r = 0; r < 4; r++) {
        scatola(g, n * 1.1, 0.05, 0.52, '#2b2b34', 0, 0.3 + r * sp, 0.02, 0.01);
        for (let k = 0; k < n * 3; k++) prodotto(g, o.tipo !== undefined ? o.tipo : (r + k) % 3, -n * 0.55 + 0.2 + k * (n * 1.1 - 0.3) / (n * 3 - 1), 0.33 + r * sp, 0.02, k + r * 2 + (o.sh || 0));
      }
      if (o.insegna) insegna(g, o.insegna, Math.min(n * 1.1, 4.2), H + 0.35);
      const q = Math.abs(Math.sin(rot)) > 0.5; ostBox(x, z, q ? 0.8 : n * 1.1 + 0.3, q ? n * 1.1 + 0.3 : 0.8);
    }
    // niente scritte di marchi: solo scaffali neri pieni di prodotti generici
    const costruisciNegozioLTC = () => {
      [-5.25, -1.75, 1.75, 5.25].forEach((x, k) => scaffale(x, Z0 + 0.7, 0, 3, { sh: k * 3 }));                      // parete di fondo
      scaffale(-X + 0.6, 0.0, PI / 2, 3, { tipo: 3 }); scaffale(-X + 0.6, 3.6, PI / 2, 3, { tipo: 3, sh: 3 });    // lato ovest
      scaffale(X - 0.6, -0.4, -PI / 2, 3, { sh: 4 }); scaffale(X - 0.6, 3.0, -PI / 2, 3, { tipo: 1, sh: 1 }); scaffale(X - 0.6, 9.6, -PI / 2, 3, { tipo: 3, sh: 2 });                                                       // lato est
    };
    if (SHOP) costruisciNegozioLTC();
    function vetrinaAlta(x, z, rot) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scena.add(g);
      const W = 1.8, H = 2.3;
      scatola(g, W, 0.5, 0.7, NERO, 0, 0.25, 0, 0.02);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => scatola(g, 0.06, H, 0.06, NERO, p[0] * (W / 2 - 0.03), H / 2 + 0.25 - 0.25, p[1] * 0.32, 0.005));
      const vt = new T.Mesh(new T.BoxGeometry(W - 0.1, H - 0.5, 0.64), new T.MeshToonMaterial({ color: new T.Color('#cfeaf6'), transparent: true, opacity: 0.28, gradientMap: gm })); vt.position.set(0, 0.5 + (H - 0.5) / 2, 0); g.add(vt);
      scatola(g, W, 0.05, 0.7, NERO, 0, H, 0, 0.01);
      for (let r = 0; r < 3; r++) { scatola(g, W - 0.12, 0.04, 0.6, '#cfeaf6', 0, 0.9 + r * 0.55, 0, 0); for (let k = 0; k < 4; k++) prodotto(g, (r + k) % 3 === 2 ? 1 : (r + k) % 3, -0.65 + k * 0.43, 0.92 + r * 0.55, 0, k + r * 3); }
      ostBox(x, z, Math.abs(Math.sin(rot)) > 0.5 ? 0.8 : W + 0.1, Math.abs(Math.sin(rot)) > 0.5 ? W + 0.1 : 0.8);
      const pr = new T.Mesh(new T.BoxGeometry(W, H, 0.9), new T.MeshBasicMaterial()); pr.position.set(0, H / 2, 0); pr.visible = false; g.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Vetrina dei pezzi da collezione (dimostrativa): i prodotti veri sono sul sito' });
    }
    if (SHOP) { vetrinaAlta(-X + 0.8, 12.4, PI / 2); vetrinaAlta(X - 0.8, 6.2, -PI / 2); }

    if (SHOP) {
    /* ---------- il bancone con la commessa: da qui si entra nel sito ---------- */
    (function () {
      const g = new T.Group(); g.position.set(0, 0, 3.2); scena.add(g);
      const piano = '#c9a06a';
      [-2.8, 2.8].forEach(px => { scatola(g, 5.4, 0.95, 1.2, NERO, px, 0.475, 0, 0.02); scatola(g, 5.5, 0.08, 1.3, piano, px, 0.99, 0, 0.015); });
      scatola(g, 1.2, 0.95, 3.6, NERO, 5.4, 0.475, -1.2, 0.02); scatola(g, 1.3, 0.08, 3.7, piano, 5.4, 0.99, -1.2, 0.015);     // ala di ritorno a "L"
      for (let k = 0; k < 9; k++) prodotto(g, k % 3, -5.0 + k * 1.1, 1.03, 0.1, k + 3);                                           // prodotti sul bancone
      scatola(g, 0.7, 0.45, 0.06, '#101015', 1.0, 1.55, -0.2, 0.01); scatola(g, 0.12, 0.28, 0.1, '#101015', 1.0, 1.2, -0.2, 0.01);     // schermo della cassa
      const sc = new T.Mesh(new T.PlaneGeometry(0.62, 0.36), new T.MeshBasicMaterial({ color: 0x9fe0d6 })); sc.position.set(1.0, 1.55, -0.16); sc.rotation.y = PI; g.add(sc);
      ostBox(0, 3.2, 11.2, 1.4); ostBox(5.4, 2.0, 1.4, 3.8);
      // la commessa dietro al bancone
      const look = (window.CONFIG.utentiDemo[2] || window.CONFIG.utentiDemo[0]).look;
      const av = B.creaAvatar(look); av.root.position.set(0, 0, 1.6); av.root.rotation.y = 0; scena.add(av.root);
      const et = B.etichetta('Negozio online', { sfondo: '#2a1f36', colore: '#ffe9c4', altezza: 0.34 }); et.position.y = 2.5; av.root.add(et);
      anim.push((t, dt) => { av.aggiorna(dt || 0.016, 0, t); });
      ostCer(0, 1.6, 0.4);
      toccabili.push({ obj: av.proxy, tipo: 'azione', testo: 'Commessa: "' + (window.B3 && B3.gen ? B3.gen('Benvenuto', 'Benvenuta') : 'Benvenuto') + ' da Laugh Tale! Vuoi vedere il negozio online?" — premi "Apri il negozio online"' });
      const pr = new T.Mesh(new T.BoxGeometry(11.2, 1.4, 1.6), new T.MeshBasicMaterial()); pr.position.set(0, 0.8, 3.2); pr.visible = false; scena.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Bancone Laugh Tale: avvicinati e premi "Apri il negozio online"' });
    })();
    porte.push({ id: 'vending-sito', nome: 'Negozio online', testo: 'Apri il negozio online', sito: true, x: 0, z: 5.1, r: 3.4 });

    }

    /* ---------- sala giochi TCG: tavoli, sedie e vetrine ---------- */
    if (!SHOP) {
      const tav = []; [-6.5, -1.5, 3.5].forEach(z => [-14, -5, 5, 14].forEach(x => tav.push([x, z])));
      const tcg = B.costruisciNegozio(scena, { solo: true, dx: 0, dz: 0, tavoli: tav, vetrine: [[X - 0.9, -6, true, -PI / 2], [X - 0.9, 0, true, -PI / 2], [X - 0.9, 6, true, -PI / 2], [-X + 0.9, -6, true, PI / 2], [-X + 0.9, 0.5, true, PI / 2]], senzaBanco: true });
      tcg.sedili.forEach(q => sedili.push(q)); tcg.ostacoli.forEach(o => ostacoli.push(o)); tcg.toccabili.forEach(q => toccabili.push(q));
      tcg.anim.forEach(f => anim.push(f)); tcg.lampade.forEach(l => lampade.push(l));
      // tavolo di BELINVERSE 2 (gioco di carte, js/belinverse.js) sul tappeto vicino all'ingresso
      (function () {
        const g = new T.Group(); g.position.set(0, 0, 10.6); scena.add(g);
        scatola(g, 2.6, 0.12, 1.6, legnoS, 0, 0.8, 0, 0.02);
        scatola(g, 2.4, 0.02, 1.4, '#2f6b4a', 0, 0.87, 0, 0);
        [[-1.15, -0.65], [1.15, -0.65], [-1.15, 0.65], [1.15, 0.65]].forEach(q => scatola(g, 0.12, 0.8, 0.12, legnoS, q[0], 0.4, q[1], 0.012));
        const carta = (id, x, z, r) => {
          const m = new T.MeshBasicMaterial({ color: 0xffffff }); new T.TextureLoader().load((window.BELIN_IMG && window.BELIN_IMG[id]) || ('img/belinverse/' + id + '.webp'), t => { m.map = t; m.needsUpdate = true; });
          const c = new T.Mesh(new T.PlaneGeometry(0.25, 0.35), m); c.rotation.x = -PI / 2; c.rotation.z = r; c.position.set(x, 0.885, z); g.add(c);
        };
        [['101', -0.95, 0.35, 0], ['043', -0.45, 0.3, 0.05], ['022', -0.1, 0.32, -0.04], ['109', 0.95, -0.35, PI], ['031', 0.45, -0.3, PI + 0.06], ['089', 0.1, -0.32, PI - 0.05], ['T01', -0.8, -0.2, 0.3], ['T01', 0.8, 0.2, 0.2]].forEach(q => carta(q[0], q[1], q[2], q[3]));
        cil(g, 0.05, 0.05, 2.4, '#2c2431', 1.9, 1.2, 0.6, 8);
        const [cv, x] = B.tela(512, 256); B.rr(x, 6, 6, 500, 244, 26); x.fillStyle = '#1a0f33'; x.fill(); x.lineWidth = 10; x.strokeStyle = '#ffd36a'; x.stroke();
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 86px Arial Black, Impact, sans-serif'; x.lineWidth = 12; x.strokeStyle = '#7a2fd6'; x.strokeText('BELINVERSE', 256, 100); x.fillStyle = '#ffe9a8'; x.fillText('BELINVERSE', 256, 100);
        x.font = 'bold 46px Arial, sans-serif'; x.fillStyle = '#9fe0d6'; x.fillText('2 · gioca qui', 256, 190);
        const ins = new T.Mesh(new T.PlaneGeometry(2.0, 1.0), new T.MeshBasicMaterial({ map: B.tex(cv), side: T.DoubleSide })); ins.position.set(1.9, 2.75, 0.6); g.add(ins);
        anim.push(t => { ins.rotation.y = Math.sin(t * 0.6) * 0.5; });
        ostBox(0, 10.6, 2.7, 1.7); ostCer(1.9, 11.2, 0.2);
        porte.push({ id: 'gioco-belinverse', nome: 'Belinverse 2', testo: 'Gioca a Belinverse 2', fn: () => { if (B.Belinverse) B.Belinverse.apri(); }, x: 0, z: 10.6, r: 2.3 });
      })();
      // venditore di pacchetti BELINVERSE: 1 pacchetto gratis al giorno, gli altri a coins (js/belinverse.js)
      (function () {
        const VX = 8, VZ = 12.4, g = new T.Group(); g.position.set(VX, 0, VZ); scena.add(g);
        scatola(g, 2.8, 0.95, 0.8, '#3b1d6e', 0, 0.475, 0, 0.02); scatola(g, 2.9, 0.08, 0.9, legnoS, 0, 0.99, 0, 0.015);
        const pacco = (x, z, r) => { const p = new T.Group(); scatola(p, 0.22, 0.3, 0.05, '#7a2fd6', 0, 0.15, 0, 0.008); scatola(p, 0.23, 0.04, 0.055, '#ffd36a', 0, 0.27, 0, 0.004); p.position.set(x, 1.03, z); p.rotation.set(-0.25, r, 0); g.add(p); };
        [-1.1, -0.8, -0.5, 0.5, 0.8, 1.1].forEach((x, i) => pacco(x, -0.1 + (i % 2) * 0.12, (i - 2.5) * 0.08));
        const look = (window.CONFIG.utentiDemo[4] || window.CONFIG.utentiDemo[0]).look;
        const av = B.creaAvatar(look); av.root.position.set(0, 0, 0.95); av.root.rotation.y = PI; g.add(av.root);
        const et = B.etichetta('Pacchetti Belinverse', { sfondo: '#2a1f36', colore: '#ffe9c4', altezza: 0.34 }); et.position.y = 2.5; av.root.add(et);
        let tSaluto = 0;
        anim.push((t, dt) => { av.aggiorna(dt || 0.016, 0, t); if (t - tSaluto > 9 && av.faiEmote) { tSaluto = t; av.faiEmote('saluta', 1.6); } });
        ostBox(VX, VZ, 3.0, 1.0); ostCer(VX, VZ + 0.95, 0.4);
        toccabili.push({ obj: av.proxy, tipo: 'azione', testo: 'Venditore: "Un pacchetto di Belinverse al giorno è gratis! Gli altri costano ' + B3.Eco.nome + '." — premi "Pacchetti Belinverse"' });
        porte.push({ id: 'pacchetti-belinverse', nome: 'Pacchetti Belinverse', testo: 'Pacchetti Belinverse', fn: () => { if (B.Belinverse) B.Belinverse.negozio(); }, x: VX, z: VZ - 1.4, r: 1.8 });
      })();
      porte.push({ id: 'porta-negozio', nome: 'Torna al negozio', testo: 'Torna al negozio', x: -X + 1.2, z: 9, r: 1.4, verso: 'collectibles', arrivo: { x: -DIM.negozio.X + 2.2, z: 9, yaw: PI / 2 } });
    }

    /* ---------- luci e uscita ---------- */
    const lampa = B.Mluce('#ff9ad8', 0.9);
    if (SHOP) {
      [[-5, 1], [5, 1], [-5, 9], [5, 9]].forEach(p => {
        const l = new T.Group(); l.position.set(p[0], 0, p[1]); scena.add(l);
        cil(l, 0.01, 0.01, 1.3, '#2c2431', 0, 3.35, 0, 4, 0); const sh = mesh(new T.ConeGeometry(0.4, 0.34, 12, 1, true), M('#7a2fd6'), { y: 2.65, l: 0.016 }); sh.material.side = T.DoubleSide; l.add(sh);
        const bu = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), lampa); bu.position.y = 2.6; l.add(bu);
        lampade.push({ x: p[0], y: 2.4, z: p[1] });
      });
      (function () {
        const g = new T.Group(); g.position.set(0, 0, Z1 + 0.4); scena.add(g);
        [-1, 1].forEach(s => scatola(g, 0.18, 3.0, 0.2, '#6b4326', s * 1.0, 1.5, 0, 0.015)); scatola(g, 2.18, 0.2, 0.2, '#6b4326', 0, 3.0, 0, 0.015);
        const [cv, x] = B.tela(256, 96); B.rr(x, 4, 4, 248, 88, 18); x.fillStyle = '#2a1a2e'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#ffd36a'; x.stroke();
        x.font = 'bold 50px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#9fe0d6'; x.fillText('APERTO', 128, 50);
        const ap = new T.Mesh(new T.PlaneGeometry(0.9, 0.34), new T.MeshBasicMaterial({ map: B.tex(cv), side: T.DoubleSide })); ap.position.set(0, 2.35, 0.02); g.add(ap);
        const mt = new T.Mesh(new T.PlaneGeometry(1.6, 0.9), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm })); mt.rotation.x = -PI / 2; mt.position.set(0, 0.014, -0.5); g.add(mt);
      })();
      porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: Z1 - 1.2, r: 1.3, verso: 'piazza', arrivo: { x: -40, z: -5.2, yaw: 0.2 } });
      porte.push({ id: 'porta-tcg', nome: 'Sala giochi TCG', testo: 'Entra nella sala giochi TCG', x: -X + 1.2, z: 9, r: 1.4, verso: 'tcg', arrivo: { x: -DIM.tcg.X + 2.2, z: 9, yaw: PI / 2 } });
    }

    /* ---------- pareti che spariscono quando la camera e' dietro di loro ---------- */
    muri.forEach(m => {
      m.g.traverse(c => {
        if (!c.isMesh) return;
        const mm = c.material;
        if (mm.isShaderMaterial || (mm.isMeshBasicMaterial && mm.side === T.BackSide)) { m.lines.push(c); return; }
        const nuovo = mm.clone(), i = B.finestreMat.indexOf(mm); if (i >= 0) B.finestreMat[i] = nuovo;
        const j = vetri.indexOf(mm); if (j >= 0) vetri[j] = nuovo;
        c.material = nuovo; m.mats.push(nuovo);
      });
    });
    function aggiornaMuri(az, dt) {
      const cx = Math.sin(az), cz = Math.cos(az);
      muri.forEach(m => {
        const fuori = m.out[0] * cx + m.out[1] * cz > 0.2, target = fuori ? 0.0 : 1;
        m.q += (target - m.q) * Math.min(1, dt * 9);
        const q = Math.abs(m.q - target) < 0.02 ? target : m.q;
        if (q === m.ap) return; m.ap = q;
        m.mats.forEach(mm => { const tr = q < 0.99; if (mm.transparent !== tr) { mm.transparent = tr; mm.needsUpdate = true; } mm.opacity = q; mm.depthWrite = !tr; });
        m.g.visible = q > 0.02;
        m.lines.forEach(l => { l.visible = q >= 0.99; });
      });
    }
    const COLORI = { giorno: ['#bfe3f2', 0.6], tramonto: ['#ffb878', 0.55], notte: ['#2c3a78', 0.5] };
    function atm(nome) {
      const c = COLORI[nome] || COLORI.giorno;
      vetri.forEach(v => { v.color.set(c[0]); v.emissive.set(nome === 'notte' ? '#3a4a9a' : c[0]); v.emissiveIntensity = c[1]; });
    }
    const area = (x, z) => x > AREA.x0 && x < AREA.x1 && z > AREA.z0 && z < AREA.z1;
    return { sedili, anim, ostacoli, porte, toccabili, lampade, area, aggiornaMuri, atm, limiti: AREA };
  }

  B.costruisciCollectibles = costruisciCollectibles;
})();
