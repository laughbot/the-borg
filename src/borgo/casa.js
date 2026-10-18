/* =====================================================================
   BORGO LUME 3D - LA TUA CASA: stanza con letto, scrivania, librerie,
   divano, finestre e terrazza con il gatto. Le pareti davanti alla camera
   diventano trasparenti, cosi' si vede sempre dentro.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, rnd = B.rnd;
  const PI = Math.PI;

  const LIVELLI = [{ w: 10, d: 7 }, { w: 14, d: 9 }, { w: 18, d: 11 }, { w: 22, d: 13 }];   // ampliamenti della stanza
  B.CASA_LIVELLI = LIVELLI;

  /* ---------- stili di pavimento e pareti (si comprano con i coins) ---------- */
  function legnoDis(base, plank) {
    return function (x, S) {
      const n = 8, h = S / n;
      for (let r = 0; r < n; r++) {
        let px = -rnd(0, 120);
        while (px < S) {
          const w = rnd(110, 200), v = rnd(-12, 12);
          x.fillStyle = 'rgb(' + Math.round(base[0] + v) + ',' + Math.round(base[1] + v) + ',' + Math.round(base[2] + v) + ')'; x.fillRect(px, r * h, w, h);
          x.fillStyle = 'rgba(255,240,210,0.10)'; x.fillRect(px, r * h + 2, w, 3);
          x.strokeStyle = plank; x.lineWidth = 2.5; x.strokeRect(px, r * h, w, h);
          px += w;
        }
      }
    };
  }
  const STILI = B.STILI = {
    pav: [
      { id: 'parquet', nome: 'Parquet', prezzo: 0, tex: () => B.texParquet(), prev: '#be8758' },
      { id: 'rovere', nome: 'Rovere chiaro', prezzo: 120, dis: legnoDis([226, 190, 140], 'rgba(120,80,40,0.45)') },
      { id: 'noce', nome: 'Noce scuro', prezzo: 150, dis: legnoDis([120, 78, 52], 'rgba(30,15,8,0.6)') },
      { id: 'scacchi', nome: 'Marmo a scacchi', prezzo: 220, dis(x, S) { const n = 4, c = S / n; for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) { x.fillStyle = (r + q) % 2 ? '#2f2a36' : '#f1ece6'; x.fillRect(q * c, r * c, c, c); x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(q * c, r * c, c, 5); } } },
      { id: 'pietra', nome: 'Lastre di pietra', prezzo: 150, dis(x, S) { x.fillStyle = '#6d6470'; x.fillRect(0, 0, S, S); const n = 3, c = S / n; for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) { const v = rnd(-12, 12); x.fillStyle = 'rgb(' + Math.round(172 + v) + ',' + Math.round(164 + v) + ',' + Math.round(160 + v) + ')'; B.rr(x, q * c + 4, r * c + 4, c - 8, c - 8, 10); x.fill(); } } },
      { id: 'moquette', nome: 'Moquette blu', prezzo: 100, dis(x, S) { x.fillStyle = '#4a6fa8'; x.fillRect(0, 0, S, S); for (let i = 0; i < 1800; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,40,0.09)'; x.fillRect(rnd(0, S), rnd(0, S), 3, 3); } } },
      { id: 'erba', nome: 'Prato', prezzo: 180, dis(x, S) { x.fillStyle = '#6aa043'; x.fillRect(0, 0, S, S); for (let i = 0; i < 1400; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(190,240,120,0.35)' : 'rgba(30,90,30,0.30)'; x.fillRect(rnd(0, S), rnd(0, S), 2, 7); } for (let i = 0; i < 16; i++) { x.fillStyle = ['#fff', '#ffd45e', '#f58fb4'][i % 3]; x.beginPath(); x.arc(rnd(0, S), rnd(0, S), 3, 0, 7); x.fill(); } } },
      { id: 'mosaico', nome: 'Mosaico', prezzo: 300, tex: () => B.texMosaico(), prev: '#6fa9b8' }
    ],
    par: [
      { id: 'crema', nome: 'Crema', prezzo: 0, col: '#e9d5c0', colL: '#dcc2ab' },
      { id: 'azzurro', nome: 'Azzurro cielo', prezzo: 80, col: '#bcd9ea', colL: '#a8c8de' },
      { id: 'rosa', nome: 'Rosa antico', prezzo: 80, col: '#efc4cc', colL: '#e2b0ba' },
      { id: 'salvia', nome: 'Verde salvia', prezzo: 80, col: '#c4d8b8', colL: '#b2c8a4' },
      { id: 'senape', nome: 'Senape', prezzo: 80, col: '#e8cf84', colL: '#d8bd6e' },
      { id: 'notte', nome: 'Blu notte', prezzo: 120, col: '#4a548c', colL: '#3e477a' },
      { id: 'righe', nome: 'A righe', prezzo: 150, col: '#f3e6cf', colL: '#f3e6cf', dis(x, S) { x.fillStyle = '#f3e6cf'; x.fillRect(0, 0, S, S); const n = 8, c = S / n; for (let i = 0; i < n; i += 2) { x.fillStyle = '#e7b8b0'; x.fillRect(i * c, 0, c, S); } } },
      { id: 'mattoni', nome: 'Mattoni', prezzo: 200, col: '#c9774f', colL: '#c9774f', dis(x, S) { x.fillStyle = '#d9c3a8'; x.fillRect(0, 0, S, S); const n = 8, h = S / n, w = S / 4; for (let r = 0; r < n; r++) for (let q = -1; q < 4; q++) { const v = rnd(-14, 14); x.fillStyle = 'rgb(' + Math.round(190 + v) + ',' + Math.round(105 + v) + ',' + Math.round(72 + v) + ')'; x.fillRect(q * w + (r % 2 ? w / 2 : 0) + 3, r * h + 3, w - 6, h - 6); } } }
    ]
  };
  const trovaStile = (tipo, id) => STILI[tipo].find(a => a.id === id) || STILI[tipo][0];
  STILI.trova = trovaStile;
  STILI.disegna = function (a, S) { const [cv, x] = B.tela(S, S); a.dis(x, S); return cv; };
  STILI.anteprima = function (tipo, a) {                    // valore CSS "background" per la miniatura
    if (a.dis) { try { return 'url(' + STILI.disegna(a, 96).toDataURL() + ')'; } catch (e) { return a.col || '#888'; } }
    if (a.tex) { try { const t = a.tex(); return 'url(' + t.image.toDataURL() + ') center/cover'; } catch (e) { return a.prev || '#888'; } }
    return a.col || '#888';
  };
  STILI.texDi = function (a) { if (a.tex) return a.tex(); const t = B.tex(STILI.disegna(a, 256), true); return t; };

  function costruisciCasa(scena, liv, stile) {
    stile = stile || {};
    const sPav = trovaStile('pav', stile.pav), sPar = trovaStile('par', stile.par);
    liv = Math.max(0, Math.min(liv | 0, LIVELLI.length - 1));
    const W = LIVELLI[liv].w, D = LIVELLI[liv].d, HW = W / 2, ZN = 3 - D;          // ZN = posizione del muro nord (il lato sud resta fisso)
    const AREA = { x0: -HW + 0.35, x1: HW - 0.35, z0: ZN + 0.4, z1: 5.65 };       // dove puo' camminare il centro dell'avatar
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [], fiori = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), M(col), { x, y, z, l: l === undefined ? 0.018 : l }); g.add(m); return m; };
    const legnoC = '#a96f44', legnoS = '#6b4326', pietra = '#b3a29b';

    /* ---------- base fluttuante: pavimento, terrazza, roccia ---------- */
    scena.add(mesh(new T.BoxGeometry(W + 0.8, 0.9, D + 0.6), M('#8a7a82'), { y: -0.46, z: 3 - D / 2 + 0.15, lb: 0.05 }));
    scena.add(mesh(new T.BoxGeometry(W + 0.8, 0.7, 3.1), M('#8a7a82'), { y: -0.36, z: 4.55, lb: 0.05 }));
    for (let i = 0; i < 8 + liv * 4; i++) { const c = mesh(new T.ConeGeometry(rnd(0.9, 1.8), rnd(1.5, 3), 7), M('#6f6270'), { x: rnd(-HW + 0.5, HW - 0.5), y: -1.6 - rnd(0, 0.6), z: rnd(ZN + 1, 5) }); c.rotation.x = PI; scena.add(c); }
    const tPar = STILI.texDi(sPav); tPar.repeat.set(W / 4, D / 4);
    const pav = new T.Mesh(new T.PlaneGeometry(W, D), new T.MeshToonMaterial({ map: tPar, gradientMap: gm })); pav.rotation.x = -PI / 2; pav.position.set(0, 0.002, 3 - D / 2); pav.receiveShadow = true; scena.add(pav);
    const tTer = B.texTerracotta(); tTer.repeat.set(W * 0.33, 1.1);
    const ter = new T.Mesh(new T.PlaneGeometry(W, 3.2), new T.MeshToonMaterial({ map: tTer, gradientMap: gm })); ter.rotation.x = -PI / 2; ter.position.set(0, 0.002, 4.6); ter.receiveShadow = true; scena.add(ter);
    scena.add(mesh(new T.BoxGeometry(W + 0.2, 0.04, 0.16), M('#e0cdb8'), { y: 0.02, z: 3.0 }));      // soglia tra stanza e terrazza
    const nuvole = [];
    for (let i = 0; i < 9; i++) {
      const g = new T.Group(), a = i / 9 * 6.283 + rnd(-0.2, 0.2), rx = HW + 3 + rnd(0, 5), rz = D + rnd(0, 4);
      g.position.set(Math.cos(a) * rx, rnd(-5, -2.4), 1 + Math.sin(a) * rz);
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) { const b = mesh(new T.IcosahedronGeometry(rnd(1.0, 1.9), 1), new T.MeshBasicMaterial({ color: 0xfff1e8, transparent: true, opacity: 0.88 }), { cast: false, recv: false }); b.position.set((k - n / 2) * 1.5, rnd(-0.2, 0.4), rnd(-0.6, 0.6)); b.scale.y = 0.6; g.add(b); }
      g.userData.base = g.position.x; g.userData.v = rnd(0.1, 0.25); g.userData.f = rnd(0, 6); scena.add(g); nuvole.push(g);
    }
    anim.push(t => nuvole.forEach(g => { g.position.x = g.userData.base + Math.sin(t * g.userData.v + g.userData.f) * 1.3; }));

    /* ---------- finestre (vetro che cambia con l'atmosfera) ---------- */
    const matVetro = () => { const m = new T.MeshToonMaterial({ color: new T.Color('#bfe3f2'), gradientMap: gm, emissive: new T.Color('#bfe3f2'), emissiveIntensity: 0.6 }); vetri.push(m); return m; };
    function finestra(g, x, y, w, h, tenda) {
      scatola(g, w + 0.34, h + 0.34, 0.12, '#f4ecdf', x, y, 0.03);
      const v = new T.Mesh(new T.PlaneGeometry(w, h), matVetro()); v.position.set(x, y, 0.1); g.add(v);
      scatola(g, 0.07, h, 0.05, '#f4ecdf', x, y, 0.13, 0); scatola(g, w, 0.07, 0.05, '#f4ecdf', x, y, 0.13, 0);
      scatola(g, w + 0.6, 0.1, 0.34, '#e8dcc8', x, y - h / 2 - 0.2, 0.15, 0.012);
      if (tenda) {
        cil(g, 0.025, 0.025, w + 1.3, '#a98a4a', x, y + h / 2 + 0.32, 0.22, 6, 0).rotation.z = PI / 2;
        [-1, 1].forEach(s => { const c = scatola(g, 0.42, h + 0.6, 0.1, tenda, x + s * (w / 2 + 0.34), y - 0.05, 0.2, 0.012); c.scale.x = 1; });
      }
    }
    function quadro(g, x, y, w, h, c1, c2) {
      scatola(g, w + 0.16, h + 0.16, 0.07, '#6b4326', x, y, 0.04, 0.01);
      const p = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshToonMaterial({ map: B.texQuadro(c1, c2), gradientMap: gm })); p.position.set(x, y, 0.085); g.add(p);
    }
    /* parete in coordinate locali: il lato interno guarda verso +z */
    function parete(len, col, wx, wz, rotY, out, contenuto) {
      const g = new T.Group(); g.position.set(wx, 0, wz); g.rotation.y = rotY; scena.add(g);
      let mp = M(col); if (sPar.dis) { const tp = STILI.texDi(sPar); tp.repeat.set(len / 4, 1); mp = new T.MeshToonMaterial({ map: tp, gradientMap: gm }); }
      const corpo = mesh(new T.BoxGeometry(len, 4, 0.3), mp, { y: 2, z: -0.15, lb: 0.03 }); corpo.castShadow = false; g.add(corpo);
      scatola(g, len, 0.3, 0.08, legnoS, 0, 0.15, 0.04, 0.012);
      scatola(g, len, 0.16, 0.14, '#f4ecdf', 0, 3.92, 0.07, 0.012);
      contenuto(g);
      muri.push({ g, out, mats: [], lines: [], q: 1, ap: 1 });
      return g;
    }

    /* ---------- parete nord: porta, finestra sopra la scrivania, quadro, bandierine ---------- */
    parete(W + 0.6, sPar.col, 0, ZN, 0, [0, -1], g => {
      finestra(g, -3.2, 2.35, 1.9, 1.5, '#e8a0a8');
      finestra(g, 3.2, 2.5, 1.2, 1.2, null);
      for (let k = 1; k <= liv; k++) { const xx = 3.2 + (HW - 4.2) * k / liv; finestra(g, -xx, 2.4, 1.3, 1.3, k % 2 ? '#e8a0a8' : null); finestra(g, xx, 2.4, 1.3, 1.3, null); }
      // porta
      scatola(g, 1.95, 2.8, 0.14, '#f4ecdf', 0, 1.4, 0.05);
      scatola(g, 1.55, 2.6, 0.1, '#7a4a30', 0, 1.3, 0.1, 0.01);
      [[-0.4, 0.55], [0.4, 0.55], [-0.4, 1.45], [0.4, 1.45]].forEach(p => scatola(g, 0.55, 0.62, 0.03, '#8a5a3a', p[0], p[1] + 0.35, 0.16, 0));
      const vp = new T.Mesh(new T.PlaneGeometry(0.9, 0.5), B.Mluce('#ffc060', 0.7)); vp.position.set(0, 2.1, 0.17); g.add(vp);
      g.add(mesh(new T.SphereGeometry(0.06, 8, 6), M('#e3a63a'), { x: 0.55, y: 1.25, z: 0.18 }));
      const tz = new T.Mesh(new T.PlaneGeometry(1.5, 0.9), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm })); tz.rotation.x = -PI / 2; tz.position.set(0, 0.012, 0.6); g.add(tz);
      // lanterne ai lati della porta
      [-1, 1].forEach(s => { const l = new T.Mesh(new T.BoxGeometry(0.16, 0.3, 0.16), B.Mluce('#ffc062', 0.9)); l.position.set(s * 1.4, 2.1, 0.2); g.add(l); scatola(g, 0.06, 0.06, 0.2, '#2c2431', s * 1.4, 2.3, 0.1, 0); });
      quadro(g, 0, 3.35, 1.1, 0.8, '#7a6fc4', '#f2a65a');
      // bandierine sopra il letto
      const bandiere = ['#e05a6d', '#f2c76e', '#4aa3a0', '#7a6fc4'];
      for (let i = 0; i < 10; i++) {
        const u = i / 9, x = 1.5 + u * 3.6, y = 3.4 - Math.sin(u * PI) * 0.35;
        const sh = new T.Shape(); sh.moveTo(-0.14, 0); sh.lineTo(0.14, 0); sh.lineTo(0, -0.3); sh.lineTo(-0.14, 0);
        const f = new T.Mesh(new T.ShapeGeometry(sh), new T.MeshToonMaterial({ color: new T.Color(bandiere[i % 4]), side: T.DoubleSide, gradientMap: gm })); f.position.set(x, y, 0.1); g.add(f);
      }
      const cordaPts = []; for (let i = 0; i <= 18; i++) { const u = i / 18; cordaPts.push(new T.Vector3(1.5 + u * 3.6, 3.4 - Math.sin(u * PI) * 0.35, 0.1)); }
      g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(cordaPts), 18, 0.01, 4), M('#2c2431')));
    });
    porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: ZN + 1.1, r: 1.35, verso: 'piazza', arrivo: { x: -32, z: -5.2, yaw: 0.2 } });

    /* ---------- parete ovest: librerie, finestra, quadri ---------- */
    const ZC = ZN - 0.3 + (D + 0.3) / 2, MH = (D + 0.3) / 2;
    parete(D + 0.3, sPar.colL, -HW, ZC, PI / 2, [-1, 0], g => {
      // x locale = -(z - zc): finestra a z=2.0 -> x=-2.65
      finestra(g, -2.4, 2.3, 1.6, 1.5, '#e8a0a8');
      quadro(g, 0.9, 2.6, 0.9, 1.1, '#e05a6d', '#f2c76e'); if (!liv) quadro(g, 2.3, 2.5, 0.8, 0.9, '#4aa3a0', '#cfe3ff');
      for (let j = 0; j < liv + 1; j++) { const xx = MH - 1.3 - 3.2 * j; if (liv && Math.abs(xx + 2.4) > 1.7 && Math.abs(xx - 0.9) > 1.5) finestra(g, xx, 2.35, 1.2, 1.3, null); }
    });
    /* ---------- parete est: finestra e quadro ---------- */
    parete(D + 0.3, sPar.colL, HW, ZC, -PI / 2, [1, 0], g => {
      finestra(g, 0.5, 2.4, 1.7, 1.5, '#a8c8e8'); quadro(g, -2.2, 2.5, 0.9, 1.1, '#7a6fc4', '#e8785a');
      for (let j = 0; j < liv + 1; j++) { const xx = -(MH - 1.3 - 3.2 * j); if (liv && Math.abs(xx - 0.5) > 1.9 && Math.abs(xx + 2.2) > 1.5) finestra(g, xx, 2.35, 1.2, 1.3, null); }
    });

    /* ---------- la stanza parte vuota: i mobili arrivano dall'inventario (arredi.js) ---------- */
    function pianta(x, z, s, y0) {
      const g = new T.Group(); g.position.set(x, y0 || 0, z); g.scale.setScalar(s || 1); scena.add(g);
      cil(g, 0.36, 0.27, 0.5, '#c8704f', 0, 0.25, 0, 12, 0.02); cil(g, 0.33, 0.33, 0.05, '#5a3a22', 0, 0.52, 0, 12, 0);
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * 6.283, fo = mesh(new T.SphereGeometry(0.25, 8, 6), M(['#4f9d5c', '#69b86f', '#3f8a4c'][i % 3]), { l: 0.014 });
        fo.scale.set(0.5, 1.4, 0.16); fo.position.set(Math.cos(a) * 0.2, 0.95 + (i % 3) * 0.14, Math.sin(a) * 0.2); fo.rotation.set(Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5); g.add(fo);
      }
      ostCer(x, z, 0.42);
    }
    lampade.push({ x: -HW + 2.2, y: 2.8, z: ZN + 2.4 }, { x: HW - 2.2, y: 2.8, z: ZN + 2.4 });

    /* ---------- terrazza ---------- */
    (function () {
      // ringhiera sul lato sud e sui due lati
      const ferro = '#6b5a73';
      function ringhiera(xa, za, xb, zb) {
        const L = Math.hypot(xb - xa, zb - za), a = Math.atan2(xb - xa, zb - za), n = Math.max(2, Math.round(L / 0.35));
        const r = mesh(new T.BoxGeometry(0.12, 0.08, L + 0.1), M('#e9d3b4'), { lb: 0.012 }); r.position.set((xa + xb) / 2, 1.05, (za + zb) / 2); r.rotation.y = a; scena.add(r);
        const r2 = mesh(new T.BoxGeometry(0.06, 0.05, L), M(ferro)); r2.position.set((xa + xb) / 2, 0.2, (za + zb) / 2); r2.rotation.y = a; scena.add(r2);
        for (let i = 0; i <= n; i++) { const u = i / n, p = mesh(new T.CylinderGeometry(0.025, 0.025, 0.9, 5), M(ferro)); p.position.set(xa + (xb - xa) * u, 0.58, za + (zb - za) * u); scena.add(p); }
        for (let i = 0; i <= 4; i++) { const u = i / 4, p = mesh(new T.BoxGeometry(0.12, 1.1, 0.12), M('#e9d3b4'), { lb: 0.012 }); p.position.set(xa + (xb - xa) * u, 0.55, za + (zb - za) * u); scena.add(p); }
      }
      ringhiera(-HW + 0.05, 6.1, HW - 0.05, 6.1); ringhiera(-HW + 0.05, 3.05, -HW + 0.05, 6.1); ringhiera(HW - 0.05, 3.05, HW - 0.05, 6.1);
      // tavolino con due sedie
      const tv = new T.Group(); tv.position.set(0.3, 0, 4.7); scena.add(tv);
      cil(tv, 0.55, 0.55, 0.06, '#c98c5b', 0, 0.8, 0, 16, 0.014); cil(tv, 0.05, 0.08, 0.8, '#2c2431', 0, 0.4, 0, 8, 0.01); cil(tv, 0.28, 0.3, 0.05, '#2c2431', 0, 0.03, 0, 10, 0);
      const cand = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.16, 8), B.Mluce('#ffd98a', 0.9)); cand.position.set(0.1, 0.92, 0.05); tv.add(cand);
      [[-0.95, 0, PI / 2], [0.95, 0.1, -PI / 2]].forEach(c => {
        const ch = new T.Group(); ch.position.set(c[0], 0, c[1]); ch.rotation.y = c[2]; tv.add(ch);
        scatola(ch, 0.5, 0.06, 0.5, '#e8785a', 0, 0.5, 0, 0.012); scatola(ch, 0.5, 0.6, 0.06, '#e8785a', 0, 0.82, -0.22, 0.012);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(l => cil(ch, 0.03, 0.03, 0.5, '#5c3822', l[0] * 0.2, 0.25, l[1] * 0.2, 6, 0));
      });
      ostCer(0.3, 4.7, 0.6); ostCer(-0.65, 4.7, 0.3); ostCer(1.25, 4.8, 0.3);
      pianta(-HW + 0.7, 5.3, 1.1); pianta(HW - 0.65, 5.4, 1.2); pianta(-HW + 0.65, 3.55, 0.9);
      // gatto su un cuscino
      const gt = new T.Group(); gt.position.set(3.4, 0, 4.4); gt.rotation.y = -0.6; scena.add(gt);
      cil(gt, 0.55, 0.6, 0.14, '#c8803a', 0, 0.07, 0, 18, 0.016);
      const corpo = mesh(new T.SphereGeometry(0.3, 14, 10), M('#f4efe6'), { l: 0.02 }); corpo.position.set(0, 0.34, 0); corpo.scale.set(1, 0.9, 1.2); gt.add(corpo);
      const mac = mesh(new T.SphereGeometry(0.2, 10, 8), M('#c98e63'), { x: 0.14, y: 0.45, z: -0.08 }); mac.scale.set(1, 0.5, 1); gt.add(mac);
      const testa = new T.Group(); testa.position.set(0, 0.7, 0.2); gt.add(testa);
      testa.add(mesh(new T.SphereGeometry(0.2, 14, 10), M('#f4efe6'), { l: 0.018 }));
      [-1, 1].forEach(s => {
        const o = mesh(new T.ConeGeometry(0.075, 0.17, 4), M('#f4efe6'), { x: s * 0.13, y: 0.2, z: -0.02, l: 0.012 }); o.rotation.z = -s * 0.25; o.rotation.y = PI / 4; testa.add(o);
        const oc = mesh(new T.SphereGeometry(0.03, 6, 5), M('#2a1a2e'), { x: s * 0.08, y: 0.03, z: 0.18 }); oc.scale.y = 1.4; testa.add(oc); testa.userData['occhio' + s] = oc;
      });
      testa.add(mesh(new T.SphereGeometry(0.025, 6, 5), M('#f4a3b8'), { y: -0.03, z: 0.2 }));
      const coda = new T.Group(); coda.position.set(0.0, 0.2, -0.32); gt.add(coda);
      const cm = mesh(new T.CapsuleGeometry(0.06, 0.5, 4, 8), M('#f4efe6'), { l: 0.014, y: 0.12, z: -0.1 }); cm.rotation.x = -0.6; coda.add(cm);
      anim.push((t) => {
        coda.rotation.y = Math.sin(t * 1.6) * 0.5; coda.rotation.z = Math.sin(t * 1.1) * 0.15;
        corpo.scale.y = 0.9 + Math.sin(t * 1.8) * 0.02; testa.rotation.z = Math.sin(t * 0.5) * 0.08; testa.rotation.x = Math.sin(t * 0.37) * 0.06;
        const bl = (t % 4.5) < 0.12 ? 0.15 : 1.4; testa.userData.occhio1.scale.y = bl; testa.userData['occhio-1'].scale.y = bl;
      });
      ostCer(3.4, 4.4, 0.55);
      const pr = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 1.2, 8), new T.MeshBasicMaterial()); pr.position.set(3.4, 0.6, 4.4); pr.visible = false; scena.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Il gatto fa le fusa (dimostrativo)' });
      // luci appese tra due pali
      const pali = [[-HW + 0.2, 3.2], [HW - 0.2, 3.2], [-HW + 0.2, 5.9], [HW - 0.2, 5.9]];
      pali.forEach(p => { scena.add(mesh(new T.CylinderGeometry(0.05, 0.06, 2.7, 6), M('#5c3822'), { x: p[0], y: 1.35, z: p[1], l: 0.012 })); });
      const bul = B.Mluce('#ffd27a', 1), bul2 = B.Mluce('#ffb0c8', 1);
      function filo(a, b) {
        const pts = []; for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push(new T.Vector3(a[0] + (b[0] - a[0]) * u, 2.6 - Math.sin(u * PI) * 0.55, a[1] + (b[1] - a[1]) * u)); }
        scena.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 20, 0.012, 4), M('#2c2431')));
        for (let i = 1; i < 11; i++) { const u = i / 11, bb = new T.Mesh(new T.SphereGeometry(0.08, 8, 6), i % 2 ? bul : bul2); bb.position.set(a[0] + (b[0] - a[0]) * u, 2.5 - Math.sin(u * PI) * 0.55, a[1] + (b[1] - a[1]) * u); scena.add(bb); }
      }
      filo(pali[0], pali[1]); filo(pali[2], pali[3]); filo(pali[0], pali[2]); filo(pali[1], pali[3]);
      lampade.push({ x: 0.3, y: 2.3, z: 4.7 });
    })();

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
    return { sedili, anim, ostacoli, porte, toccabili, lampade, area, aggiornaMuri, atm, limiti: AREA, spawn: { x: 0, z: ZN + 2.6, yaw: 0.2 }, zN: ZN, w: W, d: D, liv, nuvole: nuvole.length };
  }

  B.costruisciCasa = costruisciCasa;
})();
