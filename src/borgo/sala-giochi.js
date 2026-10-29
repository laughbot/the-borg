/* =====================================================================
   THE BORG 3D - LA SALA GIOCHI (interno): cabinati arcade, il cabinato dei Go-Kart,
   tavolo da air hockey. Le pareti davanti alla
   camera diventano trasparenti, come in casa.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, rnd = B.rnd;
  const PI = Math.PI;

  /* sala centrale (34 x 28, quattro volte la vecchia) + due ali ai lati: Paintball a ovest, Go-Kart a est */
  const HX = 17, HZ0 = -13, HZ1 = 15, WX = 27, WZ0 = -6, WZ1 = 8, GAP0 = -2.5, GAP1 = 4.5, CZ = 1;
  const AREA = { x0: -WX + 0.6, x1: WX - 0.6, z0: HZ0 + 0.7, z1: HZ1 - 0.8 };
  const inGap = z => z > GAP0 + 0.3 && z < GAP1 - 0.3;

  function costruisciSala(scena) {
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), M(col), { x, y, z, l: l === undefined ? 0.018 : l }); g.add(m); return m; };
    const legno = '#a96f44', legnoS = '#6b4326';


    /* ---------- basi fluttuanti, pavimento a scacchi e pavimenti delle ali ---------- */
    scena.add(mesh(new T.BoxGeometry(2 * HX + 0.4, 0.9, HZ1 - HZ0 + 0.4), M('#6f6485'), { y: -0.46, z: CZ, lb: 0.05 }));
    [-1, 1].forEach(sg => scena.add(mesh(new T.BoxGeometry(WX - HX + 0.4, 0.9, WZ1 - WZ0 + 0.4), M(sg < 0 ? '#5a6a8a' : '#6b5f6f'), { x: sg * (HX + WX) / 2, y: -0.46, z: (WZ0 + WZ1) / 2, lb: 0.05 })));
    for (let i = 0; i < 16; i++) { const c = mesh(new T.ConeGeometry(rnd(1.2, 2.4), rnd(1.5, 3.2), 7), M('#554a70'), { x: rnd(-WX + 2, WX - 2), y: -1.6 - rnd(0, 0.8), z: rnd(HZ0 + 2, HZ1 - 2) }); c.rotation.x = PI; scena.add(c); }
    const [cvP, xP] = B.tela(256, 256);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { xP.fillStyle = (i + j) % 2 ? '#2b2150' : '#3d2f73'; xP.fillRect(i * 32, j * 32, 32, 32); }
    const tP = B.tex(cvP); tP.wrapS = tP.wrapT = T.RepeatWrapping; tP.repeat.set(2 * HX / 3.86, (HZ1 - HZ0) / 3.9);
    const pav = new T.Mesh(new T.PlaneGeometry(2 * HX, HZ1 - HZ0), new T.MeshToonMaterial({ map: tP, gradientMap: gm })); pav.rotation.x = -PI / 2; pav.position.set(0, 0.002, CZ); pav.receiveShadow = true; scena.add(pav);
    // pavimento ala Go-Kart (asfalto con cordoli rossi/bianchi e linea di partenza)
    (function () {
      const [cv, x] = B.tela(512, 512); x.fillStyle = '#3b3b46'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.03) + ')'; x.fillRect(Math.random() * 512, Math.random() * 512, 3, 3); }
      for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#e8e8ee' : '#d9302a'; x.fillRect(i * 32, 0, 32, 22); x.fillRect(i * 32, 490, 32, 22); }
      for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#ffffff' : '#15121f'; x.fillRect(56 + j * 16, 60 + i * 32, 16, 32); }
      const p = new T.Mesh(new T.PlaneGeometry(WX - HX, WZ1 - WZ0), new T.MeshToonMaterial({ map: B.tex(cv), gradientMap: gm })); p.rotation.x = -PI / 2; p.position.set((HX + WX) / 2, 0.004, (WZ0 + WZ1) / 2); p.receiveShadow = true; scena.add(p);
    })();
    // pavimento ala Paintball (erba sintetica scura con macchie di vernice)
    (function () {
      const [cv, x] = B.tela(512, 512); x.fillStyle = '#2f4a52'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 700; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.03) + ')'; x.fillRect(Math.random() * 512, Math.random() * 512, 2, 4); }
      ['#2f7bff', '#ff4d6d', '#ffd36a', '#35c98a', '#a55eea'].forEach(c => { for (let i = 0; i < 7; i++) { x.fillStyle = c; x.globalAlpha = 0.75; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, 12 + Math.random() * 34, 0, 7); x.fill(); } });
      x.globalAlpha = 1; x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 6; x.strokeRect(10, 10, 492, 492);
      const p = new T.Mesh(new T.PlaneGeometry(WX - HX, WZ1 - WZ0), new T.MeshToonMaterial({ map: B.tex(cv), gradientMap: gm })); p.rotation.x = -PI / 2; p.position.set(-(HX + WX) / 2, 0.004, (WZ0 + WZ1) / 2); p.receiveShadow = true; scena.add(p);
    })();
    const nuvole = [];
    for (let i = 0; i < 14; i++) {
      const g = new T.Group(), a = i / 14 * 6.283 + rnd(-0.2, 0.2), rx = 27 + rnd(0, 7), rz = 19 + rnd(0, 5);
      g.position.set(Math.cos(a) * rx, rnd(-5, -2.4), CZ + Math.sin(a) * rz);
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
    // schermi dei cabinati: animati (cambiano colore)
    const schermi = [];
    function schermo(g, w, h, x, y, z, tinta) {
      const [cv, cx] = B.tela(64, 64); const tx = B.tex(cv);
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tx })); m.position.set(x, y, z); g.add(m);
      schermi.push({ cv, cx, tx, tinta, f: rnd(0, 6) });
      return m;
    }
    anim.push(t => { schermi.forEach(s => { if (((t * 6) | 0) % 2 && s.k === ((t * 6) | 0)) return; s.k = (t * 6) | 0; const x = s.cx; x.fillStyle = '#10102a'; x.fillRect(0, 0, 64, 64); for (let i = 0; i < 7; i++) { x.fillStyle = 'hsl(' + ((s.tinta + i * 40 + s.k * 15) % 360) + ',90%,60%)'; x.fillRect(((i * 17 + s.k * 7 * (i % 2 ? 1 : -1)) % 54 + 54) % 54, (i * 11 + s.k * 3) % 56, 8, 8); } s.tx.needsUpdate = true; }); });
    function cabinato(x, z, yaw, col, tinta, solo) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; scena.add(g);
      scatola(g, 1.1, 1.0, 0.9, col, 0, 0.5, 0);
      scatola(g, 1.1, 1.0, 0.6, col, 0, 1.5, -0.15);
      scatola(g, 1.1, 0.12, 0.95, '#1b1530', 0, 1.06, 0.02);
      scatola(g, 1.14, 0.3, 0.5, '#ffd36a', 0, 2.15, -0.15, 0.01);
      const sc = schermo(g, 0.8, 0.7, 0, 1.55, 0.17, tinta); sc.rotation.x = -0.1;
      [-0.28, 0.28].forEach(s => cil(g, 0.05, 0.05, 0.1, s < 0 ? '#e05a6d' : '#5ad6c4', s, 1.14, 0.2, 8));
      ostBox(x, z, Math.abs(Math.cos(yaw)) > 0.5 ? 1.2 : 1.0, Math.abs(Math.cos(yaw)) > 0.5 ? 1.0 : 1.2);
      if (!solo) { const l = new T.PointLight(0xffffff, 0, 1); }
    }
    /* ---------- pareti: sala centrale + due ali ---------- */
    const decoW = (cx, y) => g => { finestra(g, cx, y, 1.5, 1.2); };
    parete(2 * HX + 0.6, '#2d2552', 0, HZ0, 0, [0, -1], g => {
      [-12.5, -7.5, 7.5, 12.5].forEach(x => finestra(g, x, 2.4, 1.6, 1.1));
      const [cv, x] = B.tela(512, 128);
      B.rr(x, 4, 4, 504, 120, 28); x.fillStyle = '#150f2e'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#ff7ab8'; x.stroke();
      x.font = 'bold 66px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#7a2fd6'; x.strokeText('SALA GIOCHI', 256, 68); x.fillStyle = '#ffe9a8'; x.fillText('SALA GIOCHI', 256, 68);
      const ins = new T.Mesh(new T.PlaneGeometry(6.4, 1.6), new T.MeshBasicMaterial({ map: B.tex(cv) })); ins.position.set(0, 3.0, 0.1); g.add(ins);
      quadro(g, -3.8, 2.7, 0.9, 1.1, '#e05a6d', '#6a4bd6'); quadro(g, 3.8, 2.7, 0.9, 1.1, '#3b5fc4', '#f2c76e'); quadro(g, -16, 2.6, 0.9, 1.1, '#3a9a7a', '#cfe3ff'); quadro(g, 16, 2.6, 0.9, 1.1, '#8a5ac4', '#f2a65a');
    });
    // pareti laterali della sala, con il varco verso le ali
    const lato = (sg, z0, z1, col) => parete(z1 - z0, col, sg * HX, (z0 + z1) / 2, -sg * PI / 2, [sg, 0], g => {
      const n = Math.max(1, Math.round((z1 - z0) / 7));
      for (let k = 0; k < n; k++) { const c = (k - (n - 1) / 2) * 7; if (k % 2) quadro(g, c, 2.7, 0.9, 1.1, sg < 0 ? '#8a5ac4' : '#3a9a7a', sg < 0 ? '#f2a65a' : '#cfe3ff'); else finestra(g, c, 2.4, 1.5, 1.2); }
    });
    lato(-1, HZ0 - 0.3, GAP0, '#2a2248'); lato(-1, GAP1, HZ1, '#2a2248'); lato(1, HZ0 - 0.3, GAP0, '#2a2248'); lato(1, GAP1, HZ1, '#2a2248');
    // architravi sopra i varchi
    [-1, 1].forEach(sg => { const gp = new T.Group(); gp.position.set(sg * HX, 0, (GAP0 + GAP1) / 2); scena.add(gp); scatola(gp, 0.4, 0.9, GAP1 - GAP0 + 0.6, sg < 0 ? '#2f7bff' : '#d9302a', 0, 3.55, 0, 0.02); [GAP0 - 0.2, GAP1 + 0.2].forEach(zz => scatola(gp, 0.45, 3.2, 0.4, sg < 0 ? '#2f7bff' : '#d9302a', 0, 1.6, zz - (GAP0 + GAP1) / 2, 0.02)); });
    // pareti delle ali
    const WW = WX - HX, WCX = (HX + WX) / 2, WD = WZ1 - WZ0;
    [-1, 1].forEach(sg => {
      const col = sg < 0 ? '#243a5a' : '#3a2a3e';
      parete(WW, col, sg * WCX, WZ0, 0, [0, -1], g => { quadro(g, 0, 2.6, 1.2, 1.4, sg < 0 ? '#2f7bff' : '#e8321e', sg < 0 ? '#ff4d6d' : '#ffd21a'); });
      parete(WW, col, sg * WCX, WZ1, PI, [0, 1], g => { finestra(g, -2.4, 2.4, 1.5, 1.2); finestra(g, 2.4, 2.4, 1.5, 1.2); });
      parete(WD, col, sg * WX, (WZ0 + WZ1) / 2, -sg * PI / 2, [sg, 0], g => { finestra(g, -4, 2.4, 1.5, 1.2); finestra(g, 4, 2.4, 1.5, 1.2); });
    });

    /* ---------- ALA OVEST: PAINTBALL ---------- */
    (function () {
      const px = -WX + 2.2, pz = CZ;
      const g = new T.Group(); g.position.set(px, 0, pz); g.rotation.y = -PI / 2; scena.add(g);
      scatola(g, 5.0, 0.16, 2.8, '#2a2048', 0, 0.08, 0, 0.02);
      [[-2.2, '#2f7bff'], [2.2, '#ff4d6d']].forEach(s => scatola(g, 0.5, 3.4, 0.5, s[1], s[0], 1.7, 0, 0.02));
      scatola(g, 4.9, 0.5, 0.55, '#2c2431', 0, 3.45, 0, 0.02);
      const rete = new T.Mesh(new T.PlaneGeometry(3.9, 3.0), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, side: T.DoubleSide })); rete.position.set(0, 1.65, 0); g.add(rete);
      const [cv, cx] = B.tela(512, 128); cx.fillStyle = '#17171f'; B.rr(cx, 4, 4, 504, 120, 18); cx.fill(); cx.lineWidth = 7; cx.strokeStyle = '#ffd36a'; cx.stroke();
      cx.font = '900 70px Arial Black, Impact, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineWidth = 9; cx.strokeStyle = '#1f3f7a'; cx.strokeText('PAINTBALL', 256, 68); cx.fillStyle = '#ffd36a'; cx.fillText('PAINTBALL', 256, 68);
      const tIns = B.tex(cv); [0, 1].forEach(q => { const ins = new T.Mesh(new T.PlaneGeometry(4.4, 1.1), new T.MeshBasicMaterial({ map: tIns })); ins.position.set(0, 4.35, q ? -0.32 : 0.32); if (q) ins.rotation.y = PI; g.add(ins); });
      ostBox(px, pz - 2.2, 0.7, 0.7); ostBox(px, pz + 2.2, 0.7, 0.7);
      const pr = new T.Mesh(new T.BoxGeometry(2.8, 3.4, 5), new T.MeshBasicMaterial()); pr.position.set(px, 1.7, pz); pr.visible = false; scena.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Portale Paintball: avvicinati e premi "Gioca" (DEMO, 2v2 - 5v5)' });
      porte.push({ id: 'gioco-paintball', nome: 'Paintball', testo: 'Gioca a Paintball', gioco: 'paintball', x: px + 1.0, z: pz, r: 2.4 });
    })();

    /* ---------- ALA EST: GO-KART ---------- */
    (function () {
      const px = WX - 2.2, pz = CZ;
      const g = new T.Group(); g.position.set(px, 0, pz); g.rotation.y = -PI / 2; scena.add(g);
      const rosso = M('#d9302a'), bianco = M('#f4efe6');
      [-1, 1].forEach(s => {
        for (let k = 0; k < 6; k++) g.add(mesh(new T.BoxGeometry(0.66, 0.5, 0.66), k % 2 ? bianco : rosso, { x: s * 2.0, y: 0.25 + k * 0.5, z: 0, l: 0.02 }));
        g.add(mesh(new T.BoxGeometry(0.9, 0.24, 0.9), M('#4a4458'), { x: s * 2.0, y: 0.12, z: 0 }));
      });
      const arc = mesh(new T.TorusGeometry(2.0, 0.32, 10, 28, PI), M('#2a2d38'), { y: 3.0, l: 0.02 }); g.add(arc);
      for (let k = 0; k < 9; k++) { const a = k / 8 * PI; g.add(mesh(new T.BoxGeometry(0.34, 0.34, 0.7), k % 2 ? bianco : M('#15151a'), { x: Math.cos(a) * 2.0, y: 3.0 + Math.sin(a) * 2.0, z: 0 })); }
      const [cv, ctx] = B.tela(512, 160); ctx.fillStyle = '#17171f'; B.rr(ctx, 4, 4, 504, 152, 20); ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#ffd36a'; ctx.stroke();
      for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#fff' : '#15121f'; ctx.fillRect(18 + i * 30, 14 + j * 11, 15, 11); ctx.fillRect(18 + i * 30, 129 - j * 11, 15, 11); }
      ctx.font = '900 92px Arial Black, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 10; ctx.strokeStyle = '#7a1410'; ctx.strokeText('KART', 256, 84); ctx.fillStyle = '#ff3b2a'; ctx.fillText('KART', 256, 84); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillText('KART', 256, 80);
      const tIns = B.tex(cv); [0, 1].forEach(q => { const ins = new T.Mesh(new T.PlaneGeometry(4.6, 1.44), new T.MeshBasicMaterial({ map: tIns })); ins.position.set(0, 5.9, q ? -0.03 : 0.03); if (q) ins.rotation.y = PI; g.add(ins); });
      g.add(mesh(new T.BoxGeometry(4.8, 0.14, 0.3), M('#2a2d38'), { y: 5.1 }));
      [-1, 1].forEach(s => { g.add(mesh(new T.CylinderGeometry(0.05, 0.06, 3.4, 6), M('#e8e8ee'), { x: s * 3.0, y: 1.7, z: 0.2 })); const fl = new T.Mesh(new T.PlaneGeometry(0.6, 1.8), new T.MeshToonMaterial({ color: new T.Color(s < 0 ? '#e8321e' : '#ffd21a'), gradientMap: gm, side: T.DoubleSide })); fl.position.set(s * 3.0 + 0.3, 2.6, 0.2); g.add(fl); });
      ostBox(px, pz - 2.0, 0.9, 0.9); ostBox(px, pz + 2.0, 0.9, 0.9);
      // plastico della pista (le 4 piste a rotazione), nell'angolo sud dell'ala
      const pl = new T.Group(); pl.position.set(HX + 4.3, 0, WZ1 - 2.9); pl.scale.setScalar(1.05); scena.add(pl);
      pl.add(mesh(new T.CylinderGeometry(1.7, 1.9, 0.8, 28), M('#6d5a4a'), { y: 0.4, l: 0.03 }));
      pl.add(mesh(new T.CylinderGeometry(1.75, 1.75, 0.08, 28), M('#d9302a'), { y: 0.82 }));
      const pns = B.Kart && B.Kart.pianta ? [0, 1, 2, 3].map(i => { const p = B.Kart.pianta(512, i); p.tex = B.tex(p.cv); return p; }) : [], pn = pns[0] || null;
      if (pn) {
        const top = new T.Mesh(new T.CircleGeometry(1.62, 40), new T.MeshBasicMaterial({ map: pn.tex })); top.rotation.x = -PI / 2; top.position.y = 0.87; pl.add(top);
        const mk = new T.Group(); mk.add(mesh(new T.BoxGeometry(0.2, 0.1, 0.32), M('#d9302a'), { y: 0.06 })); mk.add(mesh(new T.SphereGeometry(0.07, 8, 6), M('#f4f4f4'), { y: 0.16, z: -0.03 })); mk.position.y = 0.9; pl.add(mk);
        anim.push(t => { const pi = Math.floor(t / 7) % pns.length, cur = pns[pi]; if (top.material.map !== cur.tex) { top.material.map = cur.tex; top.material.needsUpdate = true; } const n = cur.pts.length, f = (t * 0.06 % 1) * n, i = Math.floor(f) % n, a = pn.pts[i], b = pn.pts[(i + 1) % n], u = f - Math.floor(f); const qx = a[0] + (b[0] - a[0]) * u, qz = a[1] + (b[1] - a[1]) * u; mk.position.set((qx - 0.5) * 3.24, 0.9, (qz - 0.5) * 3.24); mk.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); });
      }
      const [c2, x2] = B.tela(256, 64); x2.fillStyle = '#17171f'; B.rr(x2, 2, 2, 252, 60, 12); x2.fill(); x2.font = 'bold 30px Arial'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillStyle = '#ffd36a'; x2.fillText('Go-Kart · anteprima', 128, 34);
      const tC2 = B.tex(c2); [0, 1].forEach(q => { const tg = new T.Mesh(new T.PlaneGeometry(1.8, 0.45), new T.MeshBasicMaterial({ map: tC2 })); tg.position.set(0, 1.4, q ? -0.02 : 0.02); if (q) tg.rotation.y = PI; pl.add(tg); }); pl.add(mesh(new T.CylinderGeometry(0.04, 0.04, 0.6, 6), M('#8a8a96'), { y: 1.1 }));
      ostCer(HX + 4.3, WZ1 - 2.9, 2.0);
      const pr = new T.Mesh(new T.BoxGeometry(3.4, 1.8, 3.4), new T.MeshBasicMaterial()); pr.position.set(0, 0.9, 0); pl.add(pr); pr.visible = false;
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Pista Go-Kart: entra dall\'arco per correre (DEMO)' });
      porte.push({ id: 'porta-kart', nome: 'Go-Kart', x: px - 1.0, z: pz, r: 2.3, gioco: 'kart', testo: 'Gioca a Go-Kart' });
    })();

    /* ---------- SALA CENTRALE: NASCONDINO TRASFORMISTA (porta di legno con oggetti che sbirciano) ---------- */
    (function () {
      const px = -9.5, pz = HZ0 + 2.0;
      const g = new T.Group(); g.position.set(px, 0, pz); scena.add(g);
      scatola(g, 5.2, 0.16, 2.4, '#2a2048', 0, 0.08, 0, 0.02);
      [-1.4, 1.4].forEach(x => scatola(g, 0.4, 3.2, 0.4, legno, x, 1.6, 0, 0.02));
      scatola(g, 3.4, 0.4, 0.5, legnoS, 0, 3.3, 0, 0.02);
      const tenda = new T.Mesh(new T.PlaneGeometry(2.4, 3.0), new T.MeshToonMaterial({ color: new T.Color('#7a2fd6'), gradientMap: gm, side: T.DoubleSide })); tenda.position.set(0, 1.55, 0); g.add(tenda);
      const [cv, cx] = B.tela(512, 128); cx.fillStyle = '#17171f'; B.rr(cx, 4, 4, 504, 120, 18); cx.fill(); cx.lineWidth = 7; cx.strokeStyle = '#ffd36a'; cx.stroke();
      cx.font = '900 62px Arial Black, Impact, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineWidth = 9; cx.strokeStyle = '#4a1f8a'; cx.strokeText('NASCONDINO', 256, 68); cx.fillStyle = '#ffd36a'; cx.fillText('NASCONDINO', 256, 68);
      const ins = new T.Mesh(new T.PlaneGeometry(4.0, 1.0), new T.MeshBasicMaterial({ map: B.tex(cv) })); ins.position.set(0, 4.05, 0.05); g.add(ins);
      // tre oggetti accanto alla porta: uno ha gli occhi (e' un giocatore nascosto!)
      const occhi = (gg, y, z) => [-0.11, 0.11].forEach(x => { gg.add(mesh(new T.SphereGeometry(0.075, 8, 6), M('#ffffff'), { x, y, z })); gg.add(mesh(new T.SphereGeometry(0.035, 6, 4), M('#1b1530'), { x, y, z: z + 0.06 })); });
      const bar = new T.Group(); bar.position.set(-2.1, 0, 0.7); g.add(bar); cil(bar, 0.4, 0.4, 1.1, '#8a5a36', 0, 0.55, 0, 14); [0.12, 0.98].forEach(y => cil(bar, 0.42, 0.42, 0.07, '#3a3540', 0, y, 0, 14)); occhi(bar, 0.78, 0.36);
      anim.push(t => { bar.position.y = Math.max(0, Math.sin(t * 1.3)) * 0.06; bar.rotation.y = Math.sin(t * 0.7) * 0.25; });
      scatola(g, 0.9, 0.85, 0.9, '#b07a45', 2.1, 0.43, 0.6);
      const vaso = new T.Group(); vaso.position.set(2.0, 0, -0.5); g.add(vaso); cil(vaso, 0.34, 0.26, 0.52, '#c8704f', 0, 0.26, 0, 12); vaso.add(mesh(new T.SphereGeometry(0.32, 10, 8), M('#4f9d5c'), { y: 0.72 }));
      ostBox(px - 1.4, pz, 0.6, 0.6); ostBox(px + 1.4, pz, 0.6, 0.6); ostCer(px - 2.1, pz + 0.7, 0.5); ostBox(px + 2.1, pz + 0.6, 1.0, 1.0); ostCer(px + 2.0, pz - 0.5, 0.45);
      const pr = new T.Mesh(new T.BoxGeometry(3.0, 3.2, 1.2), new T.MeshBasicMaterial()); pr.position.set(px, 1.6, pz); pr.visible = false; scena.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Nascondino Trasformista: avvicinati e premi "Gioca" (da 4 a 8, anche con gli amici)' });
      porte.push({ id: 'gioco-nascondino', nome: 'Nascondino', testo: 'Gioca a Nascondino', gioco: 'nascondino', x: px, z: pz + 1.6, r: 2.0 });
    })();

    /* ---------- SALA CENTRALE: FRONTE DELLA COMETA (varco con sacchi di sabbia, rete mimetica e bandiere) ---------- */
    (function () {
      const px = 9.5, pz = HZ0 + 2.0;
      const g = new T.Group(); g.position.set(px, 0, pz); scena.add(g);
      scatola(g, 5.4, 0.16, 2.4, '#2a2048', 0, 0.08, 0, 0.02);
      // portale di legno scuro rinforzato
      [-1.45, 1.45].forEach(x => { scatola(g, 0.42, 3.3, 0.42, '#4a3a2c', x, 1.65, 0, 0.02); scatola(g, 0.5, 0.12, 0.5, '#e2b24f', x, 3.0, 0, 0.012); });
      scatola(g, 3.5, 0.42, 0.52, '#3a2e24', 0, 3.4, 0, 0.02);
      const buio = new T.Mesh(new T.PlaneGeometry(2.5, 3.1), new T.MeshBasicMaterial({ color: 0x141018 })); buio.position.set(0, 1.55, -0.05); g.add(buio);
      // rete mimetica sopra il varco
      const [cvR, xR] = B.tela(128, 64); xR.fillStyle = '#4f5a3e'; xR.fillRect(0, 0, 128, 64);
      ['#3c4630', '#6b7550', '#5a4a34'].forEach(c => { for (let i = 0; i < 18; i++) { xR.fillStyle = c; xR.beginPath(); xR.ellipse(Math.random() * 128, Math.random() * 64, 6 + Math.random() * 10, 4 + Math.random() * 6, Math.random() * 3, 0, 7); xR.fill(); } });
      const rete = new T.Mesh(new T.PlaneGeometry(4.4, 1.3, 8, 2), new T.MeshToonMaterial({ map: B.tex(cvR), gradientMap: gm, side: T.DoubleSide }));
      const pr0 = rete.geometry.attributes.position; for (let i = 0; i < pr0.count; i++) pr0.setZ(i, Math.sin(pr0.getX(i) * 2.3) * 0.12 + (pr0.getY(i) < 0 ? 0.18 : 0)); rete.geometry.computeVertexNormals();
      rete.position.set(0, 3.1, 0.38); rete.rotation.x = -0.35; g.add(rete);
      // sacchi di sabbia ai lati
      [-1, 1].forEach(sd => { for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) { const sc = mesh(new T.SphereGeometry(0.36, 10, 8), M(['#c9b07a', '#bba06c', '#d3bd88'][(r + k) % 3]), { x: sd * (2.2 + k * 0.62 + r * 0.31), y: 0.2 + r * 0.32, z: 0.55, l: 0.012 }); sc.scale.set(0.95, 0.5, 0.75); g.add(sc); } });
      // due bandiere: la Milizia (blu) e i Predoni (rossi)
      [['#3f8cff', -1], ['#ff5a4a', 1]].forEach(([c, sd]) => {
        cil(g, 0.04, 0.05, 3.8, '#2c2431', sd * 3.6, 1.9, -0.2, 6);
        const fl = new T.Mesh(new T.PlaneGeometry(1.0, 0.65, 6, 1), new T.MeshToonMaterial({ color: new T.Color(c), gradientMap: gm, side: T.DoubleSide })); fl.position.set(sd * 3.6 + sd * 0.52, 3.35, -0.2); g.add(fl);
        anim.push(t => { const p = fl.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 4 + p.getX(i) * 5 * sd) * 0.06 * (0.5 + sd * p.getX(i))); p.needsUpdate = true; });
      });
      // insegna con la cometa
      const [cv, cx] = B.tela(512, 128); cx.fillStyle = '#17171f'; B.rr(cx, 4, 4, 504, 120, 18); cx.fill(); cx.lineWidth = 7; cx.strokeStyle = '#e2b24f'; cx.stroke();
      cx.fillStyle = '#9fe9ff'; cx.beginPath(); cx.arc(56, 64, 16, 0, 7); cx.fill(); cx.globalAlpha = 0.5; cx.beginPath(); cx.moveTo(40, 58); cx.lineTo(10, 40); cx.lineTo(44, 72); cx.fill(); cx.globalAlpha = 1;
      cx.font = '900 46px Arial Black, Impact, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.lineWidth = 8; cx.strokeStyle = '#3a2a08'; cx.strokeText('FRONTE', 280, 50); cx.fillStyle = '#ffd36a'; cx.fillText('FRONTE', 280, 50);
      cx.font = 'bold 26px Georgia, serif'; cx.fillStyle = '#f4ecd8'; cx.fillText('della Cometa', 280, 96);
      const ins = new T.Mesh(new T.PlaneGeometry(4.2, 1.05), new T.MeshBasicMaterial({ map: B.tex(cv) })); ins.position.set(0, 4.3, 0.05); g.add(ins);
      ostBox(px - 1.45, pz, 0.6, 0.6); ostBox(px + 1.45, pz, 0.6, 0.6); ostBox(px - 2.8, pz + 0.55, 2.2, 0.8); ostBox(px + 2.8, pz + 0.55, 2.2, 0.8); ostCer(px - 3.6, pz - 0.2, 0.2); ostCer(px + 3.6, pz - 0.2, 0.2);
      const pr = new T.Mesh(new T.BoxGeometry(3.0, 3.2, 1.2), new T.MeshBasicMaterial()); pr.position.set(px, 1.6, pz); pr.visible = false; scena.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Fronte della Cometa: sparatutto a squadre in prima persona (anche con gli amici)' });
      porte.push({ id: 'gioco-fronte', nome: 'Fronte della Cometa', testo: 'Gioca al Fronte', gioco: 'fronte', x: px, z: pz + 1.6, r: 2.0 });
    })();

    /* la Cripta del Re non e' piu' qui: si entra dal portale in piazza (js/portale-cripta.js) */

    /* ---------- luci e uscita ---------- */
    const lampa = B.Mluce('#ff9ad8', 0.9);
    [[-9, 3], [9, 3], [0, -4], [0, 11], [-22, 1], [22, 1], [-9, 11], [9, 11]].forEach(p => {
      const l = new T.Group(); l.position.set(p[0], 0, p[1]); scena.add(l);
      cil(l, 0.01, 0.01, 1.3, '#2c2431', 0, 3.35, 0, 4, 0); const sh = mesh(new T.ConeGeometry(0.4, 0.34, 12, 1, true), M('#7a2fd6'), { y: 2.65, l: 0.016 }); sh.material.side = T.DoubleSide; l.add(sh);
      const bu = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), lampa); bu.position.y = 2.6; l.add(bu);
      lampade.push({ x: p[0], y: 2.4, z: p[1] });
    });
    (function () {
      const g = new T.Group(); g.position.set(0, 0, HZ1 + 0.4); scena.add(g);
      [-1, 1].forEach(s => scatola(g, 0.18, 3.0, 0.2, '#6b4326', s * 1.0, 1.5, 0, 0.015)); scatola(g, 2.18, 0.2, 0.2, '#6b4326', 0, 3.0, 0, 0.015);
      const [cv, x] = B.tela(256, 96); B.rr(x, 4, 4, 248, 88, 18); x.fillStyle = '#2a1a2e'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#ffd36a'; x.stroke();
      x.font = 'bold 50px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#9fe0d6'; x.fillText('APERTO', 128, 50);
      const ap = new T.Mesh(new T.PlaneGeometry(0.9, 0.34), new T.MeshBasicMaterial({ map: B.tex(cv), side: T.DoubleSide })); ap.position.set(0, 2.35, 0.02); g.add(ap);
      const mt = new T.Mesh(new T.PlaneGeometry(1.6, 0.9), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm })); mt.rotation.x = -PI / 2; mt.position.set(0, 0.014, -0.5); g.add(mt);
    })();
    porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: HZ1 - 1.2, r: 1.3, verso: 'piazza', arrivo: { x: -22.2, z: -5.2, yaw: 0.2 } });

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
    const area = (x, z) => {
      if (z <= AREA.z0 || z >= AREA.z1) return false;
      const ax = Math.abs(x);
      if (ax < HX - 0.6) return true;                                  // sala centrale
      if (ax < HX + 0.7) return inGap(z);                              // varco verso le ali
      return ax < AREA.x1 && z > WZ0 + 0.7 && z < WZ1 - 0.8;           // ali
    };
    return { sedili, anim, ostacoli, porte, toccabili, lampade, area, aggiornaMuri, atm, limiti: AREA };
  }

  B.costruisciSala = costruisciSala;
})();
