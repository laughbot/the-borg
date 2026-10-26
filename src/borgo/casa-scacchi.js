/* =====================================================================
   THE BORG 3D - LA CASA DEGLI SCACCHI
   In piazza: la casa bianca e nera nella fila nord, tra il Negozio TCG e la
   Caffetteria, con l'insegna a scacchi, due pezzi giganti ai lati della porta
   e il selciato a scacchiera davanti (B3.CasaScacchi.decoraPiazza).
   Dentro (B3.costruisciCasaScacchi): pavimento a scacchiera, sei tavoli da
   gioco con i pezzi, una scacchiera gigante in mezzo alla sala, il tabellone
   della classifica sulla parete in fondo. Ai tavoli si apre la partita
   (B3.Scacchi, src/minigiochi/scacchi/gioco.js).
   Le pareti davanti alla camera diventano trasparenti, come in biblioteca.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, rnd = B.rnd;
  const PI = Math.PI;
  const X = 10, Z0 = -8, Z1 = 9;                              // pareti: ovest/est, nord, sud
  const AREA = { x0: -X + 0.6, x1: X - 0.6, z0: Z0 + 0.7, z1: Z1 - 0.7 };
  const BIANCO = '#f4eedf', NERO = '#2c2733';
  // dove si esce in piazza (davanti alla porta della casa, vedi piazza.js)
  const PIAZZA = { x: 3, z: -9.1 };

  /* ---------- i pezzi in 3D (profili girati attorno all'asse, il cavallo a blocchi) ---------- */
  const GEO = {};
  const tornio = (k, punti, seg) => GEO[k] || (GEO[k] = new T.LatheGeometry(punti.map(p => new T.Vector2(p[0], p[1])), seg || 12));
  const PROFILI = {
    1: [[0, 0], [0.42, 0], [0.42, 0.1], [0.3, 0.16], [0.18, 0.5], [0.26, 0.56], [0.14, 0.62], [0.24, 0.72], [0.26, 0.84], [0.18, 0.96], [0, 1.0]],
    3: [[0, 0], [0.44, 0], [0.44, 0.1], [0.3, 0.18], [0.18, 0.75], [0.3, 0.82], [0.18, 0.88], [0.26, 1.08], [0.2, 1.3], [0.06, 1.42], [0.1, 1.48], [0, 1.56]],
    4: [[0, 0], [0.46, 0], [0.46, 0.12], [0.34, 0.2], [0.28, 0.85], [0.4, 0.92], [0.4, 1.18], [0, 1.18]],
    5: [[0, 0], [0.48, 0], [0.48, 0.12], [0.34, 0.2], [0.2, 0.95], [0.34, 1.02], [0.22, 1.1], [0.38, 1.52], [0.3, 1.56], [0.16, 1.6], [0.12, 1.66], [0, 1.72]],
    6: [[0, 0], [0.5, 0], [0.5, 0.12], [0.36, 0.2], [0.22, 1.0], [0.36, 1.08], [0.24, 1.16], [0.34, 1.58], [0.18, 1.66], [0, 1.68]]
  };
  // pezzo alto circa 1 (pedone) - 1,9 (re); con lb/l = contorno (solo per i pezzi grandi)
  function pezzo3D(tipo, bianco, contorno) {
    const g = new T.Group(), mat = M(bianco ? BIANCO : NERO), o = contorno ? { l: contorno } : { cast: true };
    if (tipo === 2) {
      g.add(mesh(tornio('base2', [[0, 0], [0.46, 0], [0.46, 0.12], [0.34, 0.2], [0.3, 0.3], [0, 0.3]]), mat, o));
      const corpo = mesh(new T.BoxGeometry(0.42, 0.75, 0.5), mat, contorno ? { lb: contorno } : {}); corpo.position.set(0, 0.62, -0.02); corpo.rotation.x = -0.18; g.add(corpo);
      const testa = mesh(new T.BoxGeometry(0.36, 0.34, 0.74), mat, contorno ? { lb: contorno } : {}); testa.position.set(0, 1.05, 0.16); testa.rotation.x = 0.42; g.add(testa);
      const criniera = mesh(new T.BoxGeometry(0.12, 0.6, 0.2), M(bianco ? '#d9cfb8' : '#4a4352'), {}); criniera.position.set(0, 0.95, -0.24); criniera.rotation.x = -0.2; g.add(criniera);
      [-0.11, 0.11].forEach(s => { const or = mesh(new T.ConeGeometry(0.07, 0.2, 4), mat, {}); or.position.set(s, 1.3, -0.04); g.add(or); });
      return g;
    }
    g.add(mesh(tornio('p' + tipo, PROFILI[tipo], 14), mat, o));
    if (tipo === 6) { const v = mesh(new T.BoxGeometry(0.1, 0.42, 0.1), mat, contorno ? { lb: contorno } : {}); v.position.y = 1.86; g.add(v); const c = mesh(new T.BoxGeometry(0.32, 0.1, 0.1), mat, contorno ? { lb: contorno } : {}); c.position.y = 1.9; g.add(c); }
    if (tipo === 5) { const p = mesh(new T.SphereGeometry(0.1, 10, 8), M('#e3a63a'), {}); p.position.y = 1.78; g.add(p); }
    if (tipo === 4) [0, 1, 2, 3].forEach(i => { const m = mesh(new T.BoxGeometry(0.16, 0.16, 0.16), mat, {}); m.position.set(Math.cos(i * PI / 2) * 0.3, 1.24, Math.sin(i * PI / 2) * 0.3); g.add(m); });
    return g;
  }

  /* ---------- texture: scacchiera e pavimento ---------- */
  function texScacchiera(chiaro, scuro, bordo, n) {
    const S = 512, [cv, x] = B.tela(S, S), b = bordo ? 26 : 0, q = (S - 2 * b) / (n || 8);
    if (bordo) { x.fillStyle = bordo; x.fillRect(0, 0, S, S); }
    for (let r = 0; r < (n || 8); r++) for (let f = 0; f < (n || 8); f++) { x.fillStyle = (r + f) % 2 ? scuro : chiaro; x.fillRect(b + f * q, b + r * q, q + 0.5, q + 0.5); }
    if (bordo) { x.strokeStyle = 'rgba(255,220,150,.6)'; x.lineWidth = 3; x.strokeRect(b - 2, b - 2, S - 2 * b + 4, S - 2 * b + 4); }
    const t = B.tex(cv); t.anisotropy = 4; return t;
  }
  function texPavimento() {
    const S = 512, [cv, x] = B.tela(S, S), q = S / 4;
    for (let r = 0; r < 4; r++) for (let f = 0; f < 4; f++) {
      const chiaro = (r + f) % 2 === 0; x.fillStyle = chiaro ? '#efe6d2' : '#3b3340'; x.fillRect(f * q, r * q, q, q);
      // venature del marmo
      x.strokeStyle = chiaro ? 'rgba(160,140,120,.18)' : 'rgba(255,255,255,.06)'; x.lineWidth = 2;
      for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(f * q + Math.random() * q, r * q); x.bezierCurveTo(f * q + Math.random() * q, r * q + q * 0.4, f * q + Math.random() * q, r * q + q * 0.6, f * q + Math.random() * q, r * q + q); x.stroke(); }
    }
    x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * q, 0); x.lineTo(i * q, S); x.stroke(); x.beginPath(); x.moveTo(0, i * q); x.lineTo(S, i * q); x.stroke(); }
    const t = B.tex(cv, true); return t;
  }

  /* ---------- insegna della casa in piazza ---------- */
  B.texInsegnaScacchi = function (w, h) {
    const [cv, x] = B.tela(w, h), q = h / 6;
    // cornice a scacchi
    for (let i = 0; i * q < w; i++) for (let r = 0; r < 6; r++) { if (r > 0 && r < 5 && i > 0 && (i + 1) * q < w) continue; x.fillStyle = (i + r) % 2 ? NERO : BIANCO; x.fillRect(i * q, r * q, q + 0.5, q + 0.5); }
    B.rr(x, q * 0.8, q * 0.8, w - q * 1.6, h - q * 1.6, 12); x.fillStyle = '#1f1b26'; x.fill(); x.lineWidth = 6; x.strokeStyle = '#e3a63a'; x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold ' + Math.round(h * 0.3) + 'px Georgia, serif'; x.fillStyle = '#f6d27a';
    x.fillText('CASA DEGLI SCACCHI', w / 2 + h * 0.18, h * 0.52);
    // un cavallo disegnato (lo stesso dei pezzi della scacchiera)
    if (B.ScacchiPezzi) { try { x.save(); B.ScacchiPezzi.disegna(x, 2, q * 1.9, h / 2, h * 0.62); B.ScacchiPezzi.disegna(x, -2, w - q * 1.9, h / 2, h * 0.62); x.restore(); } catch (e) { } }
    const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t;
  };

  /* ---------- in piazza: pezzi giganti ai lati della porta e selciato a scacchiera ---------- */
  function decoraPiazza(scena, ctx) {
    const xp = PIAZZA.x, zf = PIAZZA.z + 2.5;
    // selciato a scacchiera davanti alla porta (piatto: ci si cammina sopra)
    const tp = texScacchiera('#efe6d2', '#4a4252', null, 6);
    const pav = new T.Mesh(new T.PlaneGeometry(4.2, 4.2), new T.MeshToonMaterial({ map: tp, gradientMap: M('#fff').gradientMap, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    pav.rotation.x = -PI / 2; pav.position.set(xp, 0.015, zf + 2.6); pav.receiveShadow = true; scena.add(pav);
    // due pezzi giganti su un piedistallo: il re bianco e il cavallo nero
    [[-1, 6, true], [1, 2, false]].forEach(([s, tipo, bianco]) => {
      const g = new T.Group(); g.position.set(xp + s * 4.2, 0, zf + 0.7); scena.add(g);
      g.add(mesh(new T.BoxGeometry(1.1, 0.5, 1.1), M('#b3a29b'), { y: 0.25, lb: 0.025 }));
      g.add(mesh(new T.BoxGeometry(1.25, 0.1, 1.25), M('#cdbfb8'), { y: 0.52, lb: 0.02 }));
      const p = pezzo3D(tipo, bianco, 0.03); p.scale.setScalar(1.05); p.position.y = 0.57; if (tipo === 2) p.rotation.y = -PI / 2.6; g.add(p);
      if (ctx && ctx.ostCer) ctx.ostCer(xp + s * 4.2, zf + 0.7, 0.75);
    });
  }

  /* ---------- tabellone della classifica (texture che si ridisegna) ---------- */
  let tab = null;
  function disegnaTabellone(lista) {
    if (!tab) return;
    const x = tab.x, W = tab.cv.width, H = tab.cv.height;
    x.fillStyle = '#1d2a22'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#c9a25a'; x.lineWidth = 14; x.strokeRect(7, 7, W - 14, H - 14);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#f6d27a'; x.font = 'bold 54px Georgia, serif'; x.fillText('CLASSIFICA DEL BORGO', W / 2, 62);
    x.fillStyle = 'rgba(246,210,122,.5)'; x.fillRect(60, 102, W - 120, 3);
    (lista || []).slice(0, 8).forEach((r, i) => {
      const y = 140 + i * 46;
      x.textAlign = 'left'; x.font = 'bold 34px Georgia, serif'; x.fillStyle = i < 3 ? ['#ffd36a', '#dfe3ea', '#e0a36a'][i] : '#e8f2ea';
      x.fillText((i + 1) + '.', 70, y);
      x.font = (r.io ? 'bold ' : '') + '32px system-ui, sans-serif'; x.fillStyle = r.io ? '#9fe08a' : '#e8f2ea';
      let n = (r.bot ? '🤖 ' : '') + r.nome; if (n.length > 26) n = n.slice(0, 25) + '…'; x.fillText(n, 130, y);
      x.textAlign = 'right'; x.font = 'bold 34px Georgia, serif'; x.fillStyle = '#f6d27a'; x.fillText(String(r.elo), W - 70, y);
    });
    tab.t.needsUpdate = true;
  }

  function costruisciCasaScacchi(scena) {
    const sedili = [], ostacoli = [], anim = [], porte = [], toccabili = [], lampade = [], vetri = [], muri = [];
    const gm = M('#fff').gradientMap;
    const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
    const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });
    const scatola = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), typeof col === 'string' ? M(col) : col, { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
    const cil = (g, r1, r2, h, col, x, y, z, seg, l) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), M(col), { x, y, z, l: l === undefined ? 0.018 : l }); g.add(m); return m; };
    const legno = '#7a4a2c', legnoS = '#4e2f1c', ottone = '#d6a84a';

    /* ---------- base, pavimento a scacchiera, nuvole ---------- */
    scena.add(mesh(new T.BoxGeometry(2 * X + 0.4, 0.9, Z1 - Z0 + 0.4), M('#5a5068'), { y: -0.46, z: (Z0 + Z1) / 2, lb: 0.05 }));
    for (let i = 0; i < 7; i++) { const c = mesh(new T.ConeGeometry(rnd(0.9, 1.8), rnd(1.5, 2.8), 7), M('#4a4060'), { x: rnd(-8, 8), y: -1.6 - rnd(0, 0.6), z: rnd(-6, 7) }); c.rotation.x = PI; scena.add(c); }
    const tPav = texPavimento(); tPav.repeat.set(2 * X / 4, (Z1 - Z0) / 4);
    const pav = new T.Mesh(new T.PlaneGeometry(2 * X, Z1 - Z0), new T.MeshToonMaterial({ map: tPav, gradientMap: gm })); pav.rotation.x = -PI / 2; pav.position.set(0, 0.002, (Z0 + Z1) / 2); pav.receiveShadow = true; scena.add(pav);
    const nuvole = [];
    for (let i = 0; i < 8; i++) {
      const g = new T.Group(), a = i / 8 * 6.283 + rnd(-0.2, 0.2), rx = 16 + rnd(0, 5), rz = 12 + rnd(0, 4);
      g.position.set(Math.cos(a) * rx, rnd(-5, -2.4), 0.5 + Math.sin(a) * rz);
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) { const b = mesh(new T.IcosahedronGeometry(rnd(1.0, 1.9), 1), new T.MeshBasicMaterial({ color: 0xfff1e8, transparent: true, opacity: 0.88 }), { cast: false, recv: false }); b.position.set((k - n / 2) * 1.5, rnd(-0.2, 0.4), rnd(-0.6, 0.6)); b.scale.y = 0.6; g.add(b); }
      g.userData.base = g.position.x; g.userData.v = rnd(0.1, 0.25); g.userData.f = rnd(0, 6); g.userData.vivo = true; scena.add(g); nuvole.push(g);
    }
    anim.push(t => nuvole.forEach(g => { g.position.x = g.userData.base + Math.sin(t * g.userData.v + g.userData.f) * 1.3; }));

    /* ---------- pareti ---------- */
    const matVetro = () => { const m = new T.MeshToonMaterial({ color: new T.Color('#bfe3f2'), gradientMap: gm, emissive: new T.Color('#bfe3f2'), emissiveIntensity: 0.6 }); vetri.push(m); return m; };
    function finestra(g, x, y, w, h) {
      scatola(g, w + 0.34, h + 0.34, 0.12, '#efe6d2', x, y, 0.03);
      const v = new T.Mesh(new T.PlaneGeometry(w, h), matVetro()); v.position.set(x, y, 0.1); g.add(v);
      scatola(g, 0.07, h, 0.05, '#efe6d2', x, y, 0.13, 0); scatola(g, w, 0.07, 0.05, '#efe6d2', x, y, 0.13, 0);
      scatola(g, w + 0.6, 0.1, 0.34, '#d9cfb8', x, y - h / 2 - 0.2, 0.15, 0.012);
    }
    function quadroScacchi(g, x, y, s) {   // quadretto con una scacchiera e un pezzo
      scatola(g, s + 0.16, s + 0.16, 0.07, '#2a2038', x, y, 0.04, 0.01);
      const p = new T.Mesh(new T.PlaneGeometry(s, s), new T.MeshToonMaterial({ map: texScacchiera('#efe6d2', '#6b5a7a', null, 4), gradientMap: gm })); p.position.set(x, y, 0.085); g.add(p);
    }
    function parete(len, col, wx, wz, rotY, out, contenuto) {
      const g = new T.Group(); g.position.set(wx, 0, wz); g.rotation.y = rotY; g.userData.vivo = true; scena.add(g);
      const corpo = mesh(new T.BoxGeometry(len, 4.2, 0.3), M(col), { y: 2.1, z: -0.15, lb: 0.03 }); corpo.castShadow = false; g.add(corpo);
      scatola(g, len, 1.1, 0.06, '#3a2a22', 0, 0.55, 0.03, 0.01);                 // boiserie in basso
      scatola(g, len, 0.08, 0.1, ottone, 0, 1.12, 0.05, 0.006);
      scatola(g, len, 0.16, 0.14, '#efe6d2', 0, 4.12, 0.07, 0.012);
      contenuto(g);
      muri.push({ g, out, mats: [], lines: [], q: 1, ap: 1 });
      return g;
    }
    parete(2 * X + 0.6, '#284238', 0, Z0, 0, [0, -1], g => {
      finestra(g, -7.4, 2.7, 1.4, 1.6); finestra(g, 7.4, 2.7, 1.4, 1.6);
      // tabellone della classifica (si ridisegna quando cambia l'Elo)
      const [cv, x] = B.tela(1024, 520); const t = B.tex(cv); tab = { cv, x, t };
      scatola(g, 5.0, 2.7, 0.12, '#4e2f1c', 0, 2.55, 0.06, 0.02);
      const pan = new T.Mesh(new T.PlaneGeometry(4.7, 2.4), new T.MeshBasicMaterial({ map: t })); pan.position.set(0, 2.55, 0.13); g.add(pan);
      quadroScacchi(g, -4.3, 2.8, 0.9); quadroScacchi(g, 4.3, 2.8, 0.9);
    });
    parete(Z1 - Z0 + 0.3, '#22382f', -X, (Z0 + Z1) / 2, PI / 2, [-1, 0], g => { finestra(g, -3.5, 2.7, 1.4, 1.4); finestra(g, 3.5, 2.7, 1.4, 1.4); quadroScacchi(g, 0, 2.7, 1.0); });
    parete(Z1 - Z0 + 0.3, '#22382f', X, (Z0 + Z1) / 2, -PI / 2, [1, 0], g => { finestra(g, -3.5, 2.7, 1.4, 1.4); finestra(g, 3.5, 2.7, 1.4, 1.4); quadroScacchi(g, 0, 2.7, 1.0); });
    // tocco sul tabellone: apre la classifica
    const prTab = new T.Mesh(new T.BoxGeometry(5, 2.8, 0.6), new T.MeshBasicMaterial()); prTab.position.set(0, 2.5, Z0 + 0.3); prTab.visible = false; scena.add(prTab);
    toccabili.push({ obj: prTab, tipo: 'azione', fn: () => { if (B.Scacchi) B.Scacchi.apri('classifica'); } });
    porte.push({ id: 'tabellone', nome: 'Classifica', testo: '🏆 Guarda la classifica', fn: () => { if (B.Scacchi) B.Scacchi.apri('classifica'); }, x: 0, z: Z0 + 1.5, r: 1.4 });

    /* ---------- tavoli da gioco: scacchiera con i pezzi e due sedie ---------- */
    const texTav = texScacchiera('#f6e3c6', '#c0705a', '#5a3a24');
    // pezzi in partenza (o a meta' partita, per varieta')
    const PARTENZA = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR', META = ['r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R', 'r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1', '6k1/5ppp/8/8/3R4/8/5PPP/6K1', 'r1bq1rk1/pp3ppp/2n1pn2/2pp4/3P4/2PBPN2/PP1N1PPP/R2QK2R'];
    const DA = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
    function tavolo(x, z, fen) {
      const g = new T.Group(); g.position.set(x, 0, z); scena.add(g);
      scatola(g, 1.5, 0.1, 1.5, legno, 0, 0.82, 0, 0.015);
      cil(g, 0.1, 0.14, 0.78, legnoS, 0, 0.4, 0, 10, 0.012); cil(g, 0.5, 0.55, 0.06, legnoS, 0, 0.03, 0, 16, 0.012);
      const sc = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), new T.MeshToonMaterial({ map: texTav, gradientMap: gm })); sc.rotation.x = -PI / 2; sc.position.y = 0.873; g.add(sc);
      // i pezzi (piccoli, senza contorno)
      const q = 1.1 / 8, righe = fen.split('/');
      righe.forEach((riga, r) => { let f = 0; for (const c of riga) { if (c >= '1' && c <= '8') { f += +c; continue; } const t = DA[c.toLowerCase()]; const p = pezzo3D(t, c !== c.toLowerCase(), 0); p.scale.setScalar(q * 0.62); p.position.set(-0.55 + (f + 0.5) * q, 0.876, -0.55 + (r + 0.5) * q); if (t === 2) p.rotation.y = c !== c.toLowerCase() ? PI : 0; g.add(p); f++; } });
      // orologio da scacchi
      const or = new T.Group(); or.position.set(0.66, 0.87, 0); or.rotation.y = PI / 2; g.add(or);
      scatola(or, 0.36, 0.14, 0.12, '#2a2230', 0, 0.07, 0, 0.008);
      [-0.09, 0.09].forEach((s, i) => { const d = new T.Mesh(new T.CircleGeometry(0.045, 14), new T.MeshBasicMaterial({ color: 0xfbf3dc })); d.position.set(s, 0.08, 0.062); or.add(d); cil(or, 0.02, 0.02, 0.04, i ? '#c4453b' : '#e3a63a', s, 0.16, 0, 8, 0); });
      // due sedie, una per lato (bianco a sud, nero a nord)
      [-1, 1].forEach(s => {
        const sd = new T.Group(); sd.position.set(0, 0, s * 1.15); sd.rotation.y = s > 0 ? 0 : PI; g.add(sd);
        scatola(sd, 0.6, 0.08, 0.55, '#8a2f3a', 0, 0.5, 0, 0.01);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => scatola(sd, 0.06, 0.5, 0.06, legnoS, p[0] * 0.25, 0.25, p[1] * 0.22, 0.006));
        scatola(sd, 0.6, 0.62, 0.07, legnoS, 0, 0.85, 0.26, 0.01);
        ostCer(x, z + s * 1.15, 0.32);
      });
      ostBox(x, z, 1.6, 1.6);
      porte.push({ id: 'tavolo-' + porte.length, nome: 'Tavolo da scacchi', testo: '♞ Gioca a scacchi', gioco: 'scacchi', x, z, r: 2.0 });
      lampade.push({ x, y: 2.6, z });
    }
    tavolo(-6.4, -4.0, PARTENZA); tavolo(-6.4, 0.6, META[0]); tavolo(-6.4, 5.2, META[2]);
    tavolo(6.4, -4.0, META[1]); tavolo(6.4, 0.6, PARTENZA); tavolo(6.4, 5.2, META[3]);

    /* ---------- scacchiera gigante in mezzo alla sala (ci si cammina in mezzo) ---------- */
    (function () {
      const cx = 0, cz = -1.6, L = 4.8, q = L / 8;
      scena.add(mesh(new T.BoxGeometry(L + 0.5, 0.12, L + 0.5), M('#3a2a22'), { x: cx, y: 0.06, z: cz, lb: 0.02 }));
      const sc = new T.Mesh(new T.PlaneGeometry(L, L), new T.MeshToonMaterial({ map: texScacchiera('#f6e3c6', '#b5624d', null), gradientMap: gm })); sc.rotation.x = -PI / 2; sc.position.set(cx, 0.125, cz); sc.receiveShadow = true; scena.add(sc);
      // una partita a meta': pochi pezzi, cosi' resta spazio per passeggiare
      [['K', 6, 7], ['R', 4, 7], ['P', 5, 6], ['P', 6, 6], ['B', 3, 4], ['N', 5, 5], ['Q', 2, 6], ['k', 6, 0], ['r', 3, 0], ['p', 5, 1], ['p', 6, 2], ['q', 4, 2], ['n', 2, 2], ['b', 1, 3]].forEach(([c, f, r]) => {
        const t = DA[c.toLowerCase()], bianco = c !== c.toLowerCase(), p = pezzo3D(t, bianco, 0.022);
        p.scale.setScalar(0.42); const x = cx - L / 2 + (f + 0.5) * q, z = cz - L / 2 + (r + 0.5) * q; p.position.set(x, 0.125, z); if (t === 2) p.rotation.y = bianco ? PI : 0;
        scena.add(p); ostCer(x, z, 0.24);
      });
      // cordoncino con paletti agli angoli
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(a => { const px = cx + a[0] * (L / 2 + 0.25), pz = cz + a[1] * (L / 2 + 0.25); cil(scena, 0.06, 0.08, 0.8, ottone, px, 0.4, pz, 10, 0.012); cil(scena, 0.09, 0.09, 0.08, ottone, px, 0.84, pz, 10, 0.01); ostCer(px, pz, 0.15); });
    })();

    /* ---------- arredi: librerie con i libri di scacchi, piante, panche all'ingresso ---------- */
    const DORSI = ['#c4453b', '#efe6d2', '#2c2733', '#3a9a7a', '#e9b44c', '#3b5fc4'];
    [[-3.6, Z0 + 0.55], [3.6, Z0 + 0.55]].forEach(([lx, lz]) => {
      const g = new T.Group(); g.position.set(lx, 0, lz); scena.add(g);
      scatola(g, 2.2, 2.6, 0.55, legnoS, 0, 1.3, -0.12, 0.02);
      for (let r = 0; r < 4; r++) { const y = 0.3 + r * 0.6; scatola(g, 2.0, 0.05, 0.5, legno, 0, y, 0.04, 0.008); let px = -0.95; while (px < 0.9) { const w = 0.07 + Math.random() * 0.06, h = 0.36 + Math.random() * 0.14; scatola(g, w, h, 0.32, DORSI[(Math.random() * DORSI.length) | 0], px + w / 2, y + 0.03 + h / 2, 0.06, 0.005); px += w + 0.006; } }
      ostBox(lx, lz, 2.3, 0.7);
    });
    [[-X + 0.8, Z0 + 0.8], [X - 0.8, Z0 + 0.8], [-X + 0.8, Z1 - 0.9], [X - 0.8, Z1 - 0.9]].forEach(([px, pz]) => {
      cil(scena, 0.36, 0.27, 0.55, '#c8704f', px, 0.28, pz, 12);
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283, fo = mesh(new T.SphereGeometry(0.26, 8, 6), M(['#4f9d5c', '#69b86f', '#3f8a4c'][i % 3]), { l: 0.014 }); fo.scale.set(0.5, 1.4, 0.16); fo.position.set(px + Math.cos(a) * 0.2, 0.95 + (i % 3) * 0.14, pz + Math.sin(a) * 0.2); fo.rotation.set(Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5); scena.add(fo); }
      ostCer(px, pz, 0.45);
    });
    [-4.2, 4.2].forEach(bx => {
      const g = new T.Group(); g.position.set(bx, 0, Z1 - 0.8); scena.add(g);
      scatola(g, 2.2, 0.1, 0.55, legno, 0, 0.48, 0, 0.012); scatola(g, 2.2, 0.55, 0.08, legno, 0, 0.8, 0.26, 0.012);
      [-0.95, 0.95].forEach(s => scatola(g, 0.1, 0.45, 0.5, legnoS, s, 0.23, 0, 0.01));
      ostBox(bx, Z1 - 0.8, 2.3, 0.65);
      [-0.55, 0.55].forEach(s => { const st = { x: bx + s, z: Z1 - 0.85, y: 0.08, yt: 0, yaw: PI }; st.azione = { sedile: st, nome: 'Siediti', testo: 'Siediti' }; sedili.push(st); });
    });

    /* ---------- luci (niente lampadari: con la camera dall'alto sembravano tavolini sospesi) ---------- */
    lampade.length = 0;   // le luci vere sono 6: sopra la scacchiera gigante, all'ingresso e ai tavoli degli angoli
    [[0, 3.0, -1.6], [0, 3.0, 5], [-6.4, 2.6, -4], [6.4, 2.6, -4], [-6.4, 2.6, 5.2], [6.4, 2.6, 5.2]].forEach(p => lampade.push({ x: p[0], y: p[1], z: p[2] }));

    /* ---------- uscita ---------- */
    (function () {
      const g = new T.Group(); g.position.set(0, 0, Z1 + 0.4); scena.add(g);
      [-1, 1].forEach(s => scatola(g, 0.18, 3.0, 0.2, legnoS, s * 1.0, 1.5, 0, 0.015)); scatola(g, 2.18, 0.2, 0.2, legnoS, 0, 3.0, 0, 0.015);
      const mt = new T.Mesh(new T.PlaneGeometry(1.6, 0.9), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: gm })); mt.rotation.x = -PI / 2; mt.position.set(0, 0.014, -0.5); g.add(mt);
    })();
    porte.push({ id: 'porta-uscita', nome: 'Esci in piazza', x: 0, z: Z1 - 1.2, r: 1.3, verso: 'piazza', arrivo: { x: PIAZZA.x, z: PIAZZA.z + 4.0, yaw: 0 } });

    /* ---------- pezzi fermi uniti (meno lavoro per il telefono) ---------- */
    if (B.unisciStatici) try { B.unisciStatici(scena, { anim, protetti: toccabili.map(t => t.obj) }); } catch (e) { }

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
    disegnaTabellone(B.Scacchi && B.Scacchi.classifica ? B.Scacchi.classifica(8) : []);
    if (window.Gioco) window.Gioco.su('stanza', s => { if (s && s.id === 'scacchi' && B.Scacchi) disegnaTabellone(B.Scacchi.classifica(8)); });
    const area = (x, z) => x > AREA.x0 && x < AREA.x1 && z > AREA.z0 && z < AREA.z1;
    return { sedili, anim, ostacoli, porte, toccabili, lampade, area, aggiornaMuri, atm, limiti: AREA };
  }

  B.costruisciCasaScacchi = costruisciCasaScacchi;
  B.CasaScacchi = { decoraPiazza, pezzo3D, tabellone: disegnaTabellone, PIAZZA, rect: { x0: -X, x1: X, z0: Z0, z1: Z1 } };
})();
