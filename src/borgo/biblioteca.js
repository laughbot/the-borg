/* =====================================================================
   THE BORG 3D - LA BIBLIOTECA (interno): librerie, tavoli da lettura e un leggio.
   Al leggio si apre il pannello letture (link ufficiali e testi liberi, vedi biblioteca.js).
   Le pareti davanti alla camera diventano trasparenti, come in casa.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, rnd = B.rnd;
  const PI = Math.PI;

  const X = 7.5, Z0 = -6.5, Z1 = 7.5;                      // pareti: nord, sud ed est/ovest
  const AREA = { x0: -X + 0.7, x1: X - 0.7, z0: Z0 + 0.8, z1: Z1 - 0.8 };

  function costruisciBiblioteca(scena) {
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), M(col), { x, y, z, l: l === undefined ? 0.018 : l }); g.add(m); return m; };
    const legno = '#a96f44', legnoS = '#6b4326';

    /* ---------- base, pavimento, nuvole ---------- */
    scena.add(mesh(new T.BoxGeometry(2 * X + 0.4, 0.9, Z1 - Z0 + 0.4), M('#6f6485'), { y: -0.46, z: (Z0 + Z1) / 2, lb: 0.05 }));
    for (let i = 0; i < 6; i++) { const c = mesh(new T.ConeGeometry(rnd(0.9, 1.7), rnd(1.5, 2.8), 7), M('#554a70'), { x: rnd(-6, 6), y: -1.6 - rnd(0, 0.6), z: rnd(-5, 6) }); c.rotation.x = PI; scena.add(c); }
    const tPar = B.texParquet(); tPar.repeat.set(2 * X / 4, (Z1 - Z0) / 4);
    const pav = new T.Mesh(new T.PlaneGeometry(2 * X, Z1 - Z0), new T.MeshToonMaterial({ map: tPar, gradientMap: gm, color: new T.Color('#d8c0a0') })); pav.rotation.x = -PI / 2; pav.position.set(0, 0.002, (Z0 + Z1) / 2); pav.receiveShadow = true; scena.add(pav);
    const nuvole = [];
    for (let i = 0; i < 8; i++) {
      const g = new T.Group(), a = i / 8 * 6.283 + rnd(-0.2, 0.2), rx = 13 + rnd(0, 5), rz = 10 + rnd(0, 4);
      g.position.set(Math.cos(a) * rx, rnd(-5, -2.4), 0.5 + Math.sin(a) * rz);
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

    /* ---------- pareti ---------- */
    parete(2 * X + 0.6, '#3a2f4a', 0, Z0, 0, [0, -1], g => {
      finestra(g, -5.6, 2.5, 1.3, 1.5); finestra(g, 5.6, 2.5, 1.3, 1.5);
      const [cv, x] = B.tela(512, 128); B.rr(x, 4, 4, 504, 120, 22); x.fillStyle = '#1d2a22'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#8fe0c0'; x.stroke();
      x.font = 'bold 74px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#1f4a3a'; x.strokeText('BIBLIOTECA', 256, 68); x.fillStyle = '#e9fff4'; x.fillText('BIBLIOTECA', 256, 68);
      const ins = new T.Mesh(new T.PlaneGeometry(4.2, 1.05), new T.MeshBasicMaterial({ map: B.tex(cv) })); ins.position.set(0, 3.1, 0.1); g.add(ins);
    });
    parete(Z1 - Z0 + 0.3, '#33293f', -X, (Z0 + Z1) / 2, PI / 2, [-1, 0], g => { finestra(g, 0, 2.6, 1.4, 1.3); });
    parete(Z1 - Z0 + 0.3, '#33293f', X, (Z0 + Z1) / 2, -PI / 2, [1, 0], g => { finestra(g, 0, 2.6, 1.4, 1.3); });

    /* ---------- librerie piene di libri (dorsi colorati, senza titoli di opere vere) ---------- */
    const DORSI = ['#c4453b', '#3b5fc4', '#3a9a7a', '#8a5ac4', '#e9b44c', '#e07a9a', '#2fb8d9', '#7a8a3a', '#d9702f', '#4a4a6a'];
    function libreria(x, z, rot, n) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rot; scena.add(g);
      const Wd = n * 1.2;
      scatola(g, Wd + 0.2, 3.1, 0.6, legnoS, 0, 1.55, -0.12, 0.02);
      scatola(g, Wd + 0.3, 0.1, 0.7, legno, 0, 3.12, -0.1, 0.012);
      for (let r = 0; r < 5; r++) {
        const y = 0.28 + r * 0.6;
        scatola(g, Wd, 0.05, 0.56, legno, 0, y, 0.02, 0.008);
        let px = -Wd / 2 + 0.06;
        while (px < Wd / 2 - 0.12) {
          const w = 0.07 + Math.random() * 0.07, h = 0.38 + Math.random() * 0.14, c = DORSI[(Math.random() * DORSI.length) | 0];
          if (Math.random() < 0.08) { px += 0.18; continue; }
          scatola(g, w, h, 0.34, c, px + w / 2, y + 0.03 + h / 2, 0.05, 0.006); px += w + 0.005;
        }
      }
      const q = Math.abs(Math.sin(rot)) > 0.5; ostBox(x, z, q ? 0.8 : Wd + 0.3, q ? Wd + 0.3 : 0.8);
    }
    libreria(-4.2, Z0 + 0.7, 0, 2); libreria(0, Z0 + 0.7, 0, 2); libreria(4.2, Z0 + 0.7, 0, 2);
    libreria(-X + 0.6, -2.2, PI / 2, 3); libreria(-X + 0.6, 2.8, PI / 2, 3);
    libreria(X - 0.6, -2.2, -PI / 2, 3); libreria(X - 0.6, 2.8, -PI / 2, 3);
    // scala a pioli appoggiata alla libreria centrale
    (function () {
      const g = new T.Group(); g.position.set(2.0, 0, Z0 + 1.2); g.rotation.x = -0.18; scena.add(g);
      [-0.28, 0.28].forEach(s => scatola(g, 0.06, 3.0, 0.06, legno, s, 1.5, 0, 0.008));
      for (let i = 0; i < 6; i++) scatola(g, 0.56, 0.05, 0.05, legno, 0, 0.4 + i * 0.5, 0, 0.006);
    })();

    /* ---------- tavoli da lettura con sedie ---------- */
    function tavolo(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scena.add(g);
      scatola(g, 2.4, 0.1, 1.2, '#a96f44', 0, 0.95, 0, 0.015);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => scatola(g, 0.1, 0.9, 0.1, '#6b4326', p[0] * 1.05, 0.45, p[1] * 0.5, 0.01));
      scatola(g, 0.5, 0.07, 0.36, '#c4453b', -0.6, 1.03, 0.1, 0.008); scatola(g, 0.46, 0.06, 0.34, '#3b5fc4', 0.5, 1.02, -0.1, 0.008);
      cil(g, 0.02, 0.02, 0.4, '#2c2431', 0.0, 1.2, -0.38, 6, 0); const lp = mesh(new T.ConeGeometry(0.22, 0.2, 12, 1, true), M('#2f7a5a'), { y: 1.5, z: -0.38, l: 0.012 }); lp.material.side = T.DoubleSide; g.add(lp);
      ostBox(x, z, 2.6, 1.4);
      [-1, 1].forEach(s => { const sx = x + s * 0.5, sz = z + 1.1; cil(scena, 0.28, 0.28, 0.45, '#8a5a35', sx, 0.22, sz, 12, 0.014); ostCer(sx, sz, 0.3);
        const st = { x: sx, z: sz, y: 0.08, yt: 0, yaw: PI }; st.azione = { sedile: st, nome: 'Siediti', testo: 'Siediti' }; sedili.push(st); });
    }
    tavolo(-3.4, 1.0); tavolo(3.4, 1.0);

    /* ---------- leggio con libro aperto: apre il pannello letture ---------- */
    (function () {
      const g = new T.Group(); g.position.set(0, 0, 3.6); scena.add(g);
      scatola(g, 1.3, 0.12, 1.0, '#6b4326', 0, 0.06, 0, 0.012);
      cil(g, 0.12, 0.2, 1.0, '#8a5a35', 0, 0.62, 0, 10, 0.014);
      const top = scatola(g, 1.5, 0.08, 0.9, '#a96f44', 0, 1.2, 0.0, 0.012); top.rotation.x = -0.35;
      [-1, 1].forEach(s => { const pg = scatola(g, 0.62, 0.02, 0.78, '#fbf3dc', s * 0.33, 1.28, -0.02, 0.006); pg.rotation.x = -0.35; pg.rotation.z = -s * 0.08; });
      const glow = new T.Mesh(new T.CircleGeometry(1.4, 24), new T.MeshBasicMaterial({ color: 0x9fe0d6, transparent: true, opacity: 0.18 })); glow.rotation.x = -PI / 2; glow.position.set(0, 0.02, 0); g.add(glow);
      anim.push(t => { glow.material.opacity = 0.14 + Math.sin(t * 2) * 0.05; });
      ostBox(0, 3.6, 1.5, 1.1);
      const pr = new T.Mesh(new T.BoxGeometry(2.0, 2.0, 1.6), new T.MeshBasicMaterial()); pr.position.set(0, 1.0, 3.6); pr.visible = false; scena.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Leggio: avvicinati e premi "Leggi" per le letture' });
    })();
    porte.push({ id: 'leggio', nome: 'Leggio', testo: 'Leggi', biblioteca: true, x: 0, z: 4.9, r: 1.6 });
    const tapB = new T.Mesh(new T.PlaneGeometry(6, 4), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); tapB.rotation.x = -PI / 2; tapB.position.set(0, 0.012, 3.6); scena.add(tapB);

    /* ---------- luci e uscita ---------- */
    const lampa = B.Mluce('#ffd9a0', 0.9);
    [[-3.4, 1], [3.4, 1], [0, -2.5], [0, 5]].forEach(p => {
      const l = new T.Group(); l.position.set(p[0], 0, p[1]); scena.add(l);
      cil(l, 0.01, 0.01, 1.3, '#2c2431', 0, 3.35, 0, 4, 0); const sh = mesh(new T.ConeGeometry(0.4, 0.34, 12, 1, true), M('#2f7a5a'), { y: 2.65, l: 0.016 }); sh.material.side = T.DoubleSide; l.add(sh);
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
    porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: Z1 - 1.2, r: 1.3, verso: 'piazza', arrivo: { x: -22, z: 65.2, yaw: PI } });

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

  B.costruisciBiblioteca = costruisciBiblioteca;
})();
