/* =====================================================================
   THE BORG 3D - IL NEGOZIO TCG (interno): scaffali di carte, banco con il
   negoziante, tavoli da gioco con sedie, vetrine. Le pareti davanti alla
   camera diventano trasparenti, come in casa.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, rnd = B.rnd;
  const PI = Math.PI;

  const AREA = { x0: -11.6, x1: 11.6, z0: -8.4, z1: 9.5 };

  // opts.solo: costruisce solo il contenuto (banco, tavoli, vetrine), spostato di (dx, dz), per metterlo dentro un'altra stanza
  // opts.vuota: costruisce la stanza senza arredi e senza nome
  function costruisciNegozio(scena, opts) {
    opts = opts || {}; const SOLO = !!opts.solo, VUOTA = !!opts.vuota, dx = opts.dx || 0, dz = opts.dz || 0;
    if (SOLO) { const sg = new T.Group(); sg.position.set(dx, 0, dz); scena.add(sg); scena = sg; }
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), M(col), { x, y, z, l: l === undefined ? 0.018 : l }); g.add(m); return m; };
    const legno = '#a96f44', legnoS = '#6b4326';

    /* ---------- dorso delle carte (disegnato da codice) ---------- */
    function texDorso(c1, c2) {
      const [cv, x] = B.tela(96, 134);
      B.rr(x, 2, 2, 92, 130, 9); x.fillStyle = '#f4ecdf'; x.fill();
      B.rr(x, 7, 7, 82, 120, 6); const g = x.createLinearGradient(0, 0, 96, 134); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fill();
      x.strokeStyle = 'rgba(255,230,150,.9)'; x.lineWidth = 3; x.beginPath(); x.arc(48, 67, 24, 0, 7); x.stroke();
      x.fillStyle = 'rgba(255,230,150,.95)'; x.beginPath(); x.moveTo(48, 40); x.lineTo(55, 62); x.lineTo(78, 67); x.lineTo(55, 72); x.lineTo(48, 94); x.lineTo(41, 72); x.lineTo(18, 67); x.lineTo(41, 62); x.closePath(); x.fill();
      return B.tex(cv);
    }
    const dorsi = [texDorso('#3b5fc4', '#1f2f78'), texDorso('#c4453b', '#6e1f2a'), texDorso('#3a9a7a', '#1f5a52'), texDorso('#8a5ac4', '#46287a')];
    const matDorso = i => new T.MeshToonMaterial({ map: dorsi[i % 4], gradientMap: gm });
    function carta(g, x, y, z, rotY, i, rotX) {
      const m = new T.Mesh(new T.PlaneGeometry(0.34, 0.48), matDorso(i)); m.position.set(x, y, z); m.rotation.x = rotX === undefined ? -PI / 2 : rotX; m.rotation.z = rotY || 0; g.add(m); return m;
    }

    if (!SOLO) {
    /* ---------- base fluttuante e nuvole ---------- */
    scena.add(mesh(new T.BoxGeometry(25.9, 0.9, 19.6), M('#7a6f82'), { y: -0.46, z: 0.3, lb: 0.05 }));
    for (let i = 0; i < 7; i++) { const c = mesh(new T.ConeGeometry(rnd(0.9, 1.7), rnd(1.5, 2.8), 7), M('#5f5470'), { x: rnd(-11, 11), y: -1.6 - rnd(0, 0.6), z: rnd(-8, 9) }); c.rotation.x = PI; scena.add(c); }
    const tPar = B.texParquet(); tPar.repeat.set(6.3, 4.9);
    const pav = new T.Mesh(new T.PlaneGeometry(24.9, 18.6), new T.MeshToonMaterial({ map: tPar, gradientMap: gm, color: new T.Color('#c9b3a8') })); pav.rotation.x = -PI / 2; pav.position.set(0, 0.002, 0.3); pav.receiveShadow = true; scena.add(pav);
    const tap = new T.Mesh(new T.PlaneGeometry(11, 7.6), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); tap.rotation.x = -PI / 2; tap.position.set(1.8, 0.012, 0.9); tap.receiveShadow = true; scena.add(tap);
    const nuvole = [];
    for (let i = 0; i < 9; i++) {
      const g = new T.Group(), a = i / 9 * 6.283 + rnd(-0.2, 0.2), rx = 17 + rnd(0, 6), rz = 14 + rnd(0, 5);
      g.position.set(Math.cos(a) * rx, rnd(-5, -2.4), 0.2 + Math.sin(a) * rz);
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) { const b = mesh(new T.IcosahedronGeometry(rnd(1.0, 1.9), 1), new T.MeshBasicMaterial({ color: 0xfff1e8, transparent: true, opacity: 0.88 }), { cast: false, recv: false }); b.position.set((k - n / 2) * 1.5, rnd(-0.2, 0.4), rnd(-0.6, 0.6)); b.scale.y = 0.6; g.add(b); }
      g.userData.base = g.position.x; g.userData.v = rnd(0.1, 0.25); g.userData.f = rnd(0, 6); scena.add(g); nuvole.push(g);
    }
    anim.push(t => nuvole.forEach(g => { g.position.x = g.userData.base + Math.sin(t * g.userData.v + g.userData.f) * 1.3; }));

    }

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

    // scaffale pieno di scatole e bustine (istanze: un solo oggetto per scaffale)
    function scaffale(g, x, larg) {
      if (VUOTA) return;
      scatola(g, larg, 2.7, 0.08, '#4b3350', x, 1.45, 0.05, 0.012);
      [-1, 1].forEach(s => scatola(g, 0.1, 2.8, 0.42, legnoS, x + s * larg / 2, 1.45, 0.2, 0.012));
      const righe = 4, cols = ['#3b5fc4', '#c4453b', '#3a9a7a', '#8a5ac4', '#e9b44c', '#e07a9a'];
      for (let r = 0; r < righe; r++) {
        const y = 0.55 + r * 0.62; scatola(g, larg, 0.06, 0.42, legno, x, y, 0.2, 0.012);
        const n = Math.floor(larg / 0.34), im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), M('#fff'), n), mt = new T.Matrix4(), cc = new T.Color();
        for (let i = 0; i < n; i++) {
          const w = 0.26, h = 0.34 + (i * 7 % 3) * 0.06, d = 0.26;
          mt.makeScale(w, h, d); mt.setPosition(x - larg / 2 + 0.25 + i * (larg - 0.4) / (n - 1 || 1), y + 0.03 + h / 2, 0.2); im.setMatrixAt(i, mt); im.setColorAt(i, cc.set(cols[(i + r * 2) % cols.length]));
        }
        im.castShadow = true; g.add(im);
      }
    }

    // parete nord: scaffali, insegna al neon, poster
    if (!SOLO) parete(25.8, '#3a2f55', 0, -9.1, 0, [0, -1], g => {
      scaffale(g, -8.4, 2.5); scaffale(g, 8.4, 2.5); scaffale(g, -5.0, 2.5); scaffale(g, 5.0, 2.5); scaffale(g, -3.9, 1.5); scaffale(g, 3.9, 1.5);
      finestra(g, 0, 2.0, 2.0, 1.5);
      if (VUOTA) return;
      const [cv, x] = B.tela(512, 128);
      B.rr(x, 4, 4, 504, 120, 28); x.fillStyle = '#1b1530'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#ffd36a'; x.stroke();
      x.font = 'bold 74px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = '#1a6bd6'; x.strokeText('NEGOZIO TCG', 256, 68); x.fillStyle = '#fff1b8'; x.fillText('NEGOZIO TCG', 256, 68);
      const ins = new T.Mesh(new T.PlaneGeometry(3.2, 0.8), new T.MeshBasicMaterial({ map: B.tex(cv) })); ins.position.set(0, 3.45, 0.1); g.add(ins);
      quadro(g, -1.55, 3.4, 0.5, 0.65, '#e05a6d', '#f2c76e'); quadro(g, 1.55, 3.4, 0.5, 0.65, '#3b5fc4', '#9fe0d6');
    });
    // parete ovest: banco del negoziante (libreria di raccoglitori) e poster
    if (!SOLO) parete(20, '#352a4d', -12.25, 0, PI / 2, [-1, 0], g => {
      finestra(g, 1.6, 2.2, 1.5, 1.3); finestra(g, -5, 2.2, 1.5, 1.3); finestra(g, 6, 2.2, 1.5, 1.3);
      quadro(g, -1.9, 2.5, 0.8, 1.0, '#8a5ac4', '#f2a65a'); quadro(g, -3.0, 2.3, 0.6, 0.8, '#3a9a7a', '#cfe3ff');
      scaffale(g, 2.5, 1.5);
    });
    // parete est: quadri e finestra
    if (!SOLO) parete(20, '#352a4d', 12.25, 0, -PI / 2, [1, 0], g => {
      finestra(g, -0.7, 2.4, 1.6, 1.4); finestra(g, 5.5, 2.4, 1.6, 1.4); finestra(g, -6.5, 2.4, 1.6, 1.4); quadro(g, 2.2, 2.5, 0.9, 1.1, '#e05a6d', '#6a4bd6'); quadro(g, -2.6, 2.4, 0.7, 0.9, '#f2c76e', '#c4453b');
    });
    if (!SOLO && !VUOTA) { ostBox(-8.4, -8.88, 2.7, 0.5); ostBox(8.4, -8.88, 2.7, 0.5); ostBox(-5.0, -8.88, 2.7, 0.5); ostBox(5.0, -8.88, 2.7, 0.5); ostBox(-3.9, -8.88, 1.7, 0.5); ostBox(3.9, -8.88, 1.7, 0.5); ostBox(-12.0, -4.4, 0.5, 1.7); }

    /* ---------- banco e negoziante ---------- */
    if (!VUOTA && !opts.senzaBanco) (function () {
      const g = new T.Group(); g.position.set(-8.0, 0, 0.9); scena.add(g);
      scatola(g, 1.0, 1.0, 3.0, '#5a3a2f', 0, 0.5, 0); scatola(g, 1.12, 0.1, 3.12, '#8a5a35', 0, 1.04, 0);
      const vt = new T.Mesh(new T.BoxGeometry(0.9, 0.34, 2.6), new T.MeshToonMaterial({ color: new T.Color('#cfeaf6'), transparent: true, opacity: 0.45, gradientMap: gm })); vt.position.set(0.0, 1.26, 0); g.add(vt);
      for (let i = 0; i < 7; i++) { const c = carta(g, 0.0, 1.11, -1.1 + i * 0.37, (i % 3 - 1) * 0.12, i); c.scale.set(0.8, 0.8, 1); }
      // registratore di cassa
      scatola(g, 0.5, 0.3, 0.6, '#2c2431', 0.15, 1.24, 1.15); scatola(g, 0.4, 0.22, 0.05, '#9fe0d6', 0.15, 1.5, 1.0, 0.01);
      ostBox(-8.0, 0.9, 1.15, 3.15);
      const pr = new T.Mesh(new T.BoxGeometry(1.2, 1.0, 3.0), new T.MeshBasicMaterial()); pr.position.set(-8.0, 1.2, 0.9); pr.visible = false; scena.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Banco delle carte: presto potrai comprare bustine e carte singole (dimostrativo)' });
    })();

    /* ---------- tavoli da gioco con sedie (ci si siede) ---------- */
    function posto(x, z, yaw, extra) {
      const s = Object.assign({ x, z, y: 0.08, yt: 0, yaw }, extra || {});
      s.azione = { sedile: s, nome: 'Siediti', testo: 'Siediti' }; sedili.push(s); return s;
    }
    function sedia(x, z, yaw) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; scena.add(g);
      scatola(g, 0.56, 0.1, 0.56, '#e8785a', 0, 0.58, 0, 0.015); scatola(g, 0.56, 0.62, 0.08, '#e8785a', 0, 0.95, -0.26, 0.015);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => cil(g, 0.035, 0.035, 0.55, '#2c2431', p[0] * 0.22, 0.27, p[1] * 0.22, 6, 0));
      ostCer(x, z, 0.3);
      posto(x, z, yaw, { esci: { x: x - Math.sin(yaw) * 1.2, z: z - Math.cos(yaw) * 1.2 } });
    }
    function tavolo(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scena.add(g);
      scatola(g, 1.7, 0.1, 1.1, '#2f6a4a', 0, 0.95, 0, 0.015); scatola(g, 1.82, 0.06, 1.22, legnoS, 0, 0.88, 0, 0.012);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => scatola(g, 0.1, 0.88, 0.1, legnoS, p[0] * 0.75, 0.44, p[1] * 0.46, 0.01));
      for (let i = 0; i < 5; i++) carta(g, -0.5 + i * 0.22, 1.005, (i % 2 ? 0.15 : -0.12), (i * 0.9) % 3 - 1.3, i);
      carta(g, 0.6, 1.006, 0.2, 0.4, 3);
      const dado = scatola(g, 0.1, 0.1, 0.1, '#fbf3dc', 0.55, 1.05, -0.25, 0.012); dado.rotation.y = 0.6;
      ostBox(x, z, 1.9, 1.3);
    }
    if (!VUOTA) {
      (opts.tavoli || [[-2.0, -3.2], [5.5, -3.2], [1.8, 3.8]]).forEach(t => { tavolo(t[0], t[1]); sedia(t[0], t[1] - 1.1, 0); sedia(t[0], t[1] + 1.1, PI); });
    }

    /* ---------- vetrine con carte ---------- */
    function vetrina(x, z, lungo, rotY) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; scena.add(g);
      scatola(g, 1.6, 0.9, 0.7, '#3a2f55', 0, 0.45, 0);
      const vt = new T.Mesh(new T.BoxGeometry(1.5, 0.5, 0.62), new T.MeshToonMaterial({ color: new T.Color('#cfeaf6'), transparent: true, opacity: 0.4, gradientMap: gm })); vt.position.set(0, 1.15, 0); g.add(vt);
      scatola(g, 1.62, 0.07, 0.72, '#ffd36a', 0, 0.92, 0, 0.01);
      for (let i = 0; i < 4; i++) { const c = carta(g, -0.55 + i * 0.37, 1.02, 0, (i - 1.5) * 0.1, i + 1, -0.9); c.position.z = 0.05; }
      ostBox(x, z, lungo ? 0.8 : 1.7, lungo ? 1.7 : 0.8);
      const pr = new T.Mesh(new T.BoxGeometry(lungo ? 0.9 : 1.7, 1.2, lungo ? 1.7 : 0.9), new T.MeshBasicMaterial()); pr.position.set(x, 0.8, z); pr.visible = false; scena.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Vetrina delle carte rare: presto potrai guardarle e scambiarle (dimostrativo)' });
    }
    if (!VUOTA) (opts.vetrine || [[11.3, -1.8, true, -PI / 2], [11.3, 4.6, true, -PI / 2], [-6.0, 7.4, false, 0]]).forEach(v => vetrina(v[0], v[1], v[2], v[3]));

    /* ---------- lampade a sospensione, luci, uscita ---------- */
    const lampa = B.Mluce('#ffd27a', 0.9);
    (opts.tavoli ? opts.tavoli.filter((t, i) => i % 2 === 0) : [[-2.0, -3.2], [5.5, -3.2], [1.8, 3.8], [-8.0, 0.9]]).forEach(p => {
      const l = new T.Group(); l.position.set(p[0], 0, p[1]); scena.add(l);
      cil(l, 0.01, 0.01, 1.3, '#2c2431', 0, 3.35, 0, 4, 0); const sh = mesh(new T.ConeGeometry(0.4, 0.34, 12, 1, true), M('#2a3a85'), { y: 2.65, l: 0.016 }); sh.material.side = T.DoubleSide; l.add(sh);
      const bu = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), lampa); bu.position.y = 2.6; l.add(bu);
      lampade.push({ x: p[0], y: 2.4, z: p[1] });
    });
    // porta di uscita (a sud): cornice, tappetino e cartello "APERTO"
    if (!SOLO) (function () {
      const g = new T.Group(); g.position.set(0, 0, 10.0); scena.add(g);
      [-1, 1].forEach(s => scatola(g, 0.18, 3.0, 0.2, '#6b4326', s * 1.0, 1.5, 0, 0.015)); scatola(g, 2.18, 0.2, 0.2, '#6b4326', 0, 3.0, 0, 0.015);
      const [cv, x] = B.tela(256, 96); B.rr(x, 4, 4, 248, 88, 18); x.fillStyle = '#2a1a2e'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#ffd36a'; x.stroke();
      x.font = 'bold 50px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#9fe0d6'; x.fillText('APERTO', 128, 50);
      const ap = new T.Mesh(new T.PlaneGeometry(0.9, 0.34), new T.MeshBasicMaterial({ map: B.tex(cv), side: T.DoubleSide })); ap.position.set(0, 2.35, 0.02); g.add(ap);
      const mt = new T.Mesh(new T.PlaneGeometry(1.6, 0.9), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm })); mt.rotation.x = -PI / 2; mt.position.set(0, 0.014, -0.5); g.add(mt);
    })();
    if (!SOLO) porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: 8.8, r: 1.3, verso: 'piazza', arrivo: { x: -12, z: -3.8, yaw: 0 } });

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
    if (SOLO) {                                       // le coordinate "logiche" seguono lo spostamento del gruppo
      ostacoli.forEach(o => { if (o.t === 'b') { o.x0 += dx; o.x1 += dx; o.z0 += dz; o.z1 += dz; } else { o.x += dx; o.z += dz; } });
      sedili.forEach(q => { q.x += dx; q.z += dz; if (q.esci) { q.esci.x += dx; q.esci.z += dz; } });
      lampade.forEach(l => { l.x += dx; l.z += dz; });
    }
    return { sedili, anim, ostacoli, porte, toccabili, lampade, area, aggiornaMuri, atm, limiti: AREA, vetri };
  }

  B.costruisciNegozio = costruisciNegozio;
})();
