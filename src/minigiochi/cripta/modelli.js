/* =====================================================================
   THE BORG - LA CRIPTA DEL RE SENZA LUCE: MODELLI DEI CINEREI (nemici, boss, armi)
   Stesso stile degli avatar di The Borg: materiali "cartone" a toni (B3.M) e contorno scuro.
   Ogni funzione restituisce { root, anim(t, dt), alt } con i piedi a y = 0 e il davanti verso +z.
   Usato dall'anteprima (anteprima-modelli.html); il gioco li usera' dopo l'approvazione.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, PI = Math.PI;
  const C = {
    osso: '#dcd0b2', ossoS: '#a99c7f', chitina: '#3a3646', chitinaS: '#2a2733', stoffa: '#5c4772', stoffaS: '#3f3150',
    occhio: 0x9dffb0, oro: '#e6b54e', oroS: '#a87c2a', rosso: 0xff5a4a, ambra: 0xffb347, pelle: '#77825f', pelleS: '#566043', ferro: '#5d6270'
  };
  let L = 0.022;   // spessore del contorno (piu' sottile sulle armi, che si vedono da vicino)
  const mat = c => typeof c === 'string' ? M(c) : c;
  const glowM = {}; const luce = c => glowM[c] || (glowM[c] = new T.MeshBasicMaterial({ color: c }));
  function box(g, w, h, d, c, x, y, z) { const m = mesh(new T.BoxGeometry(w, h, d), mat(c), { x, y, z, lb: L, cast: false, recv: false }); g.add(m); return m; }
  function sfera(g, r, c, x, y, z, sx, sy, sz) { const m = mesh(new T.SphereGeometry(r, 18, 12), mat(c), { x, y, z, l: L / Math.max(sx || 1, sy || 1, sz || 1), cast: false, recv: false }); m.scale.set(sx || 1, sy || 1, sz || 1); g.add(m); return m; }
  function cono(g, r, h, c, x, y, z, seg) { const m = mesh(new T.ConeGeometry(r, h, seg || 10), mat(c), { x, y, z, l: L, cast: false, recv: false }); g.add(m); return m; }
  function cil(g, r1, r2, h, c, x, y, z, seg) { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 12), mat(c), { x, y, z, l: L, cast: false, recv: false }); g.add(m); return m; }
  function brilla(g, r, c, x, y, z, sx, sy, sz) { const m = new T.Mesh(new T.SphereGeometry(r, 12, 8), luce(c)); m.position.set(x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1); g.add(m); return m; }
  function alone(g, r, c, x, y, z, op) { const m = new T.Mesh(new T.SphereGeometry(r, 16, 10), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op || 0.18, depthWrite: false })); m.position.set(x, y, z); g.add(m); return m; }
  function perno(g, x, y, z) { const p = new T.Group(); p.position.set(x, y, z); g.add(p); return p; }
  function stracci(g, r, h, c, y, n) {    // gonna a brandelli: strisce di stoffa in cerchio
    for (let i = 0; i < n; i++) { const a = i / n * PI * 2, s = box(g, 0.16 * r * 4, h * (0.75 + (i % 3) * 0.15), 0.05, c, Math.sin(a) * r, y - h / 2, Math.cos(a) * r); s.rotation.y = a; s.rotation.x = 0.12; }
  }

  /* ---------- NEMICI ---------- */
  // Strisciante: piccolo, gobbo, teschio enorme con tre occhi, braccia lunghe con artigli. Corre in branco.
  function strisciante() {
    const root = new T.Group(), corpo = perno(root, 0, 0, 0);
    const gL = perno(corpo, -0.14, 0.5, 0), gR = perno(corpo, 0.14, 0.5, 0);
    [gL, gR].forEach(p => { box(p, 0.12, 0.42, 0.13, C.chitina, 0, -0.22, 0); box(p, 0.16, 0.08, 0.24, C.ossoS, 0, -0.46, 0.05); });
    const busto = perno(corpo, 0, 0.55, 0); busto.rotation.x = 0.55;
    sfera(busto, 0.24, C.chitina, 0, 0.22, 0, 1, 1.15, 0.85); box(busto, 0.3, 0.06, 0.2, C.osso, 0, 0.12, 0.12); box(busto, 0.28, 0.06, 0.19, C.osso, 0, 0.24, 0.13); box(busto, 0.24, 0.06, 0.17, C.osso, 0, 0.36, 0.12);
    stracci(busto, 0.2, 0.3, C.stoffaS, 0.08, 7);
    const testa = perno(busto, 0, 0.5, 0.12);
    sfera(testa, 0.3, C.osso, 0, 0.08, 0.05, 1, 0.92, 1.1); sfera(testa, 0.2, C.ossoS, 0, -0.1, 0.2, 1, 0.6, 0.9);
    [[-0.11, 0.12], [0.11, 0.12], [0, 0.24]].forEach(o => { sfera(testa, 0.075, '#141218', o[0], o[1], 0.3); brilla(testa, 0.04, C.occhio, o[0], o[1], 0.35); });
    for (let i = 0; i < 5; i++) box(testa, 0.03, 0.06, 0.03, C.osso, -0.08 + i * 0.04, -0.2, 0.36);
    for (let i = 0; i < 3; i++) { const c = cono(testa, 0.05, 0.25, C.ossoS, (i - 1) * 0.12, 0.33, -0.12); c.rotation.x = -0.9; }
    const bL = perno(busto, -0.27, 0.32, 0.05), bR = perno(busto, 0.27, 0.32, 0.05);
    [bL, bR].forEach((p, k) => { cil(p, 0.05, 0.04, 0.55, C.chitina, 0, -0.27, 0); const av = perno(p, 0, -0.55, 0); cil(av, 0.04, 0.035, 0.45, C.osso, 0, -0.22, 0); [-0.05, 0, 0.05].forEach(x => { const c = cono(av, 0.025, 0.2, C.osso, x, -0.5, 0.03); c.rotation.x = PI + 0.4; }); p.userData.av = av; });
    const anim = (t, dt, vel) => {
      const v = vel === undefined ? 0.35 : vel, f = t * (6 + v * 8);
      gL.rotation.x = Math.sin(f) * 0.6 * v; gR.rotation.x = -Math.sin(f) * 0.6 * v;
      bL.rotation.x = -0.4 + Math.sin(f + 1) * 0.5; bR.rotation.x = -0.4 - Math.sin(f + 1) * 0.5; bL.rotation.z = 0.25; bR.rotation.z = -0.25;
      bL.userData.av.rotation.x = -0.6 + Math.sin(t * 3) * 0.2; bR.userData.av.rotation.x = -0.6 + Math.cos(t * 3) * 0.2;
      corpo.position.y = Math.abs(Math.sin(f)) * 0.05; testa.rotation.z = Math.sin(t * 2.3) * 0.12; testa.rotation.y = Math.sin(t * 1.3) * 0.25;
    };
    return { root, anim, alt: 1.35, nome: 'Strisciante' };
  }

  // Novizio: soldato semplice, elmo a cresta con una fessura luminosa, spara sfere verdi con un bastone-arma.
  function novizio() {
    const root = new T.Group(), corpo = perno(root, 0, 0, 0);
    const gL = perno(corpo, -0.15, 0.6, 0), gR = perno(corpo, 0.15, 0.6, 0);
    [gL, gR].forEach(p => { box(p, 0.16, 0.55, 0.18, C.chitina, 0, -0.28, 0); box(p, 0.2, 0.12, 0.28, C.chitinaS, 0, -0.56, 0.04); box(p, 0.17, 0.14, 0.05, C.ossoS, 0, -0.18, 0.1); });
    const busto = perno(corpo, 0, 0.62, 0);
    box(busto, 0.52, 0.55, 0.32, C.chitina, 0, 0.28, 0); box(busto, 0.42, 0.36, 0.06, C.osso, 0, 0.34, 0.17); box(busto, 0.06, 0.36, 0.07, C.ossoS, 0, 0.34, 0.19);
    stracci(busto, 0.24, 0.32, C.stoffa, 0.05, 9);
    [-1, 1].forEach(s => { sfera(busto, 0.17, C.osso, s * 0.33, 0.55, 0, 1.1, 0.75, 1); const sp = cono(busto, 0.05, 0.22, C.ossoS, s * 0.4, 0.72, -0.02); sp.rotation.z = -s * 0.5; });
    const testa = perno(busto, 0, 0.78, 0.02);
    sfera(testa, 0.27, C.osso, 0, 0.12, 0, 1, 1.05, 1); box(testa, 0.36, 0.08, 0.1, '#141218', 0, 0.1, 0.24); brilla(testa, 0.05, C.occhio, 0, 0.1, 0.29, 2.4, 0.6, 0.6);
    const cresta = cono(testa, 0.14, 0.55, C.chitina, 0, 0.42, -0.14, 6); cresta.rotation.x = -0.75; cresta.scale.x = 0.4;
    sfera(testa, 0.12, C.stoffa, 0, 0.0, -0.22, 1.4, 1.2, 1);
    const bL = perno(busto, -0.33, 0.48, 0), bR = perno(busto, 0.33, 0.48, 0);
    [bL, bR].forEach(p => { box(p, 0.12, 0.42, 0.13, C.chitina, 0, -0.2, 0); sfera(p, 0.08, C.ossoS, 0, -0.43, 0); });
    const arma = perno(bR, 0, -0.42, 0.05); cil(arma, 0.04, 0.05, 0.85, C.ferro, 0, 0, 0.25, 8).rotation.x = PI / 2; cono(arma, 0.09, 0.2, C.osso, 0, 0, -0.18, 6).rotation.x = -PI / 2;
    const cri = brilla(arma, 0.07, C.occhio, 0, 0.02, 0.7, 1, 1, 1.6); alone(arma, 0.15, C.occhio, 0, 0.02, 0.7, 0.25);
    const anim = (t, dt, vel) => {
      const v = vel === undefined ? 0.2 : vel, f = t * (5 + v * 6);
      gL.rotation.x = Math.sin(f) * 0.5 * v; gR.rotation.x = -Math.sin(f) * 0.5 * v; bL.rotation.x = -Math.sin(f) * 0.3 * v; bR.rotation.x = -1.2;
      corpo.position.y = Math.abs(Math.cos(f)) * 0.04 * v + Math.sin(t * 2) * 0.01; testa.rotation.y = Math.sin(t * 0.9) * 0.3; cri.scale.setScalar(1 + Math.sin(t * 6) * 0.15);
    };
    return { root, anim, alt: 2.0, nome: 'Novizio' };
  }

  // Guardacripta: corazzato, lento, elmo con corna, mannaia enorme e scudo d'osso. Para i colpi davanti.
  function guardacripta() {
    const root = new T.Group(), corpo = perno(root, 0, 0, 0);
    const gL = perno(corpo, -0.3, 0.85, 0), gR = perno(corpo, 0.3, 0.85, 0);
    [gL, gR].forEach(p => { box(p, 0.3, 0.8, 0.34, C.chitina, 0, -0.4, 0); box(p, 0.36, 0.18, 0.46, C.chitinaS, 0, -0.78, 0.06); box(p, 0.32, 0.26, 0.08, C.osso, 0, -0.3, 0.18); });
    const busto = perno(corpo, 0, 0.88, 0);
    box(busto, 1.0, 0.95, 0.6, C.chitina, 0, 0.45, 0); box(busto, 0.8, 0.6, 0.1, C.osso, 0, 0.55, 0.3); brilla(busto, 0.09, C.occhio, 0, 0.55, 0.36, 1.4, 1.4, 0.6);
    box(busto, 0.9, 0.16, 0.62, C.stoffaS, 0, 0.0, 0); stracci(busto, 0.42, 0.45, C.stoffa, -0.02, 11);
    [-1, 1].forEach(s => { sfera(busto, 0.32, C.osso, s * 0.62, 0.92, 0, 1.15, 0.8, 1.1); for (let k = 0; k < 3; k++) { const c = cono(busto, 0.07, 0.42, C.ossoS, s * (0.55 + k * 0.12), 1.18 - k * 0.04, -0.05 + k * 0.05); c.rotation.z = -s * (0.25 + k * 0.2); } });
    const testa = perno(busto, 0, 1.12, 0.05);
    sfera(testa, 0.3, C.osso, 0, 0.12, 0, 1, 1.05, 1.05); box(testa, 0.42, 0.1, 0.1, '#141218', 0, 0.1, 0.27); [-0.09, 0.09].forEach(x => brilla(testa, 0.04, C.occhio, x, 0.1, 0.32));
    [-1, 1].forEach(s => { const c1 = cil(testa, 0.06, 0.03, 0.4, C.ossoS, s * 0.3, 0.38, -0.05, 8); c1.rotation.z = -s * 0.9; const c2 = cono(testa, 0.035, 0.3, C.osso, s * 0.52, 0.62, -0.05, 8); c2.rotation.z = -s * 0.2; });
    const bL = perno(busto, -0.66, 0.8, 0), bR = perno(busto, 0.66, 0.8, 0);
    [bL, bR].forEach(p => { box(p, 0.26, 0.7, 0.28, C.chitina, 0, -0.33, 0); box(p, 0.3, 0.22, 0.32, C.osso, 0, -0.62, 0.02); });
    const man = perno(bR, 0, -0.7, 0.1); cil(man, 0.04, 0.04, 0.9, C.ferro, 0, 0, 0.2, 8).rotation.x = PI / 2;
    const lama = box(man, 0.08, 0.55, 0.85, C.ossoS, 0, 0.22, 0.9); box(man, 0.09, 0.08, 0.86, C.osso, 0, 0.5, 0.9); lama.rotation.x = 0.1;
    const scudo = perno(bL, -0.08, -0.5, 0.22); sfera(scudo, 0.3, C.ossoS, 0, 0, 0.05, 1, 1.3, 0.3); sfera(scudo, 0.18, C.chitinaS, 0, 0.02, 0.1, 1, 1.3, 0.3); brilla(scudo, 0.05, C.occhio, 0, 0.05, 0.16);
    const anim = (t, dt, vel) => {
      const v = vel === undefined ? 0.15 : vel, f = t * (3.5 + v * 4);
      gL.rotation.x = Math.sin(f) * 0.4 * v; gR.rotation.x = -Math.sin(f) * 0.4 * v; bR.rotation.x = -0.3 + Math.sin(t * 1.2) * 0.15; bL.rotation.x = -0.6;
      corpo.position.y = Math.abs(Math.cos(f)) * 0.06 * v; busto.rotation.y = Math.sin(t * 0.8) * 0.12;
    };
    root.scale.setScalar(1.15);
    return { root, anim, alt: 3.3, nome: 'Guardacripta' };
  }

  // Cantrice del Lutto: fluttua, veste lunga, corona di spine, mani di luce. Il suo canto uccide se non la fermi.
  function cantrice() {
    const root = new T.Group(), corpo = perno(root, 0, 0, 0);
    const veste = cono(corpo, 0.48, 1.25, C.stoffa, 0, 0.75, 0, 14); veste.rotation.x = PI;
    stracci(corpo, 0.42, 0.35, C.stoffaS, 0.28, 12);
    const busto = perno(corpo, 0, 1.3, 0);
    box(busto, 0.46, 0.5, 0.3, C.chitina, 0, 0.12, 0); box(busto, 0.32, 0.32, 0.05, C.osso, 0, 0.14, 0.16); brilla(busto, 0.06, C.occhio, 0, 0.16, 0.2);
    sfera(busto, 0.26, C.stoffaS, 0, 0.34, -0.06, 1.3, 0.7, 1.1);
    const testa = perno(busto, 0, 0.62, 0);
    sfera(testa, 0.24, C.osso, 0, 0.05, 0, 1, 1.12, 1); [[-0.08, 0.07], [0.08, 0.07], [0, 0.17]].forEach(o => brilla(testa, 0.035, C.occhio, o[0], o[1], 0.23));
    for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.4, c = cono(testa, 0.04, 0.42 - Math.abs(i - 3) * 0.06, i % 2 ? C.ossoS : C.osso, Math.sin(a) * 0.2, 0.36, Math.cos(a) * 0.05 - 0.04); c.rotation.z = -a * 0.45; }
    const velo = new T.Mesh(new T.ConeGeometry(0.34, 0.6, 12, 1, true), new T.MeshBasicMaterial({ color: 0x2a2236, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false })); velo.position.set(0, -0.12, -0.02); testa.add(velo);
    const mani = [-1, 1].map(s => { const p = perno(busto, s * 0.5, 0.0, 0.25); sfera(p, 0.09, C.osso, 0, 0, 0); brilla(p, 0.06, C.occhio, 0, 0, 0.08); alone(p, 0.2, C.occhio, 0, 0, 0.05, 0.22); return p; });
    const aura = alone(corpo, 1.0, C.occhio, 0, 1.2, 0, 0.08); aura.scale.set(1, 1.4, 1);
    const anello = new T.Mesh(new T.TorusGeometry(0.75, 0.02, 6, 40), luce(C.occhio)); anello.rotation.x = PI / 2; anello.position.y = 0.2; corpo.add(anello);
    const anim = (t) => {
      corpo.position.y = 0.25 + Math.sin(t * 1.6) * 0.12; veste.rotation.y = Math.sin(t) * 0.1;
      mani.forEach((p, k) => { const s = k ? 1 : -1; p.position.set(s * (0.5 + Math.sin(t * 2 + k) * 0.06), 0.05 + Math.sin(t * 1.4 + k * 2) * 0.12, 0.25); });
      anello.scale.setScalar(1 + Math.sin(t * 3) * 0.08); anello.rotation.z = t * 0.6; aura.material.opacity = 0.06 + Math.sin(t * 2.4) * 0.03;
    };
    return { root, anim, alt: 2.6, nome: 'Cantrice del Lutto' };
  }

  /* ---------- BOSS ---------- */
  // Gran Officiante: sacerdote gigante in oro e osso, mitra alta con l'Occhio Ardente, pastorale con sfera.
  function officiante() {
    const root = new T.Group(), g = perno(root, 0, 0, 0);
    const veste = cono(g, 0.95, 1.9, C.stoffa, 0, 0.95, 0, 16); veste.rotation.x = PI; veste.scale.z = 0.8;
    box(g, 0.5, 1.6, 0.06, C.oro, 0, 0.85, 0.66).rotation.x = -0.36;
    stracci(g, 0.78, 0.4, C.stoffaS, 0.4, 14);
    const busto = perno(g, 0, 1.85, 0);
    box(busto, 1.15, 1.0, 0.65, C.chitina, 0, 0.35, 0); box(busto, 0.9, 0.75, 0.1, C.oro, 0, 0.38, 0.33); box(busto, 0.12, 0.75, 0.12, C.oroS, 0, 0.38, 0.37);
    [-1, 1].forEach(s => { sfera(busto, 0.36, C.oro, s * 0.7, 0.85, 0, 1.2, 0.8, 1.1); for (let k = 0; k < 2; k++) cono(busto, 0.08, 0.5, C.osso, s * (0.62 + k * 0.18), 1.2, -0.05).rotation.z = -s * (0.3 + k * 0.3); });
    const mantello = box(busto, 1.3, 2.4, 0.08, C.stoffaS, 0, -0.35, -0.4); mantello.rotation.x = 0.12;
    const testa = perno(busto, 0, 1.08, 0.05);
    sfera(testa, 0.32, C.osso, 0, 0.12, 0, 1, 1.05, 1); box(testa, 0.42, 0.09, 0.1, '#141218', 0, 0.1, 0.28); [-0.1, 0.1].forEach(x => brilla(testa, 0.04, 0xfff0b0, x, 0.1, 0.33));
    const mitra = perno(testa, 0, 0.38, 0);
    box(mitra, 0.56, 0.95, 0.3, C.oro, 0, 0.42, -0.02).scale.x = 1; cono(mitra, 0.3, 0.5, C.oro, 0, 1.12, -0.02, 4).rotation.y = PI / 4;
    for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 1.6; cono(mitra, 0.04, 0.5, C.oroS, Math.sin(a) * 0.32, 0.95 + Math.cos(a) * 0.15, -0.05, 6).rotation.z = -a * 0.7; }
    const occhio = brilla(mitra, 0.12, 0xfff0b0, 0, 0.5, 0.17, 1.4, 1, 0.5); alone(mitra, 0.26, 0xffd27a, 0, 0.5, 0.18, 0.3);
    const bL = perno(busto, -0.75, 0.7, 0), bR = perno(busto, 0.75, 0.7, 0);
    [bL, bR].forEach(p => { cil(p, 0.18, 0.22, 0.95, C.stoffa, 0, -0.4, 0); sfera(p, 0.14, C.osso, 0, -0.95, 0.05); });
    const bast = perno(bR, 0.05, -0.95, 0.15); cil(bast, 0.05, 0.05, 3.6, C.oroS, 0, 0.6, 0, 8); const sf = brilla(bast, 0.2, 0xffd27a, 0, 2.55, 0); alone(bast, 0.38, 0xffd27a, 0, 2.55, 0, 0.25);
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2, c = cono(bast, 0.04, 0.4, C.oro, Math.sin(a) * 0.22, 2.4, Math.cos(a) * 0.22, 6); c.rotation.x = Math.cos(a) * 0.5; c.rotation.z = -Math.sin(a) * 0.5; }
    bL.rotation.x = -0.5; bL.rotation.z = 0.2;
    const anim = (t) => { busto.rotation.y = Math.sin(t * 0.6) * 0.1; g.position.y = Math.sin(t * 1.1) * 0.03; occhio.scale.set(1.4 + Math.sin(t * 3) * 0.2, 1 + Math.sin(t * 3) * 0.15, 0.5); sf.scale.setScalar(1 + Math.sin(t * 2.2) * 0.1); bR.rotation.x = -0.15 + Math.sin(t * 0.9) * 0.05; };
    root.scale.setScalar(1.7);
    return { root, anim, alt: 6.8, nome: 'Gran Officiante' };
  }

  // Bruthak l'Insaziabile: bestia enorme e gobba, ventre d'ambra (unico punto debole), pustola rossa sulla schiena per lo Sguardo, catene ai polsi.
  function bruthak() {
    const root = new T.Group(), g = perno(root, 0, 0, 0);
    const gL = perno(g, -0.9, 1.2, -0.1), gR = perno(g, 0.9, 1.2, -0.1);
    [gL, gR].forEach(p => { cil(p, 0.42, 0.36, 1.0, C.pelleS, 0, -0.55, 0); box(p, 0.8, 0.3, 0.95, C.chitina, 0, -1.05, 0.15); for (let k = 0; k < 3; k++) cono(p, 0.08, 0.22, C.osso, -0.25 + k * 0.25, -1.08, 0.66).rotation.x = PI / 2; });
    const busto = perno(g, 0, 1.3, 0);
    sfera(busto, 1.45, C.pelle, 0, 1.05, -0.2, 1.15, 1.0, 1.0);
    const ventre = brilla(busto, 0.62, C.ambra, 0, 0.75, 1.0, 1, 1, 0.65); const vA = alone(busto, 0.95, C.ambra, 0, 0.75, 1.05, 0.22);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; box(busto, 0.12, 0.12, 0.5, C.pelleS, Math.sin(a) * 0.72, 0.75 + Math.cos(a) * 0.72, 0.95).lookAt(new T.Vector3(0, 0.75, 3)); }
    box(busto, 2.6, 0.7, 1.9, C.chitina, 0, 2.0, -0.35).rotation.x = -0.2;
    for (let i = 0; i < 5; i++) cono(busto, 0.12, 0.7, C.osso, -1.0 + i * 0.5, 2.55, -0.9 + Math.abs(i - 2) * 0.1).rotation.x = -0.6;
    const pustola = brilla(busto, 0.32, C.rosso, 0, 1.75, -1.5); alone(busto, 0.55, C.rosso, 0, 1.75, -1.55, 0.25);
    const testa = perno(busto, 0, 1.85, 0.75);
    sfera(testa, 0.5, C.pelleS, 0, 0.1, 0, 1.1, 0.85, 1); box(testa, 0.7, 0.18, 0.4, C.osso, 0, -0.18, 0.3);
    [-1, 1].forEach(s => { const z = cono(testa, 0.07, 0.4, C.osso, s * 0.28, 0.05, 0.5); z.rotation.x = -0.5; z.rotation.z = s * 0.3; });
    [[-0.22, 0.25], [0, 0.32], [0.22, 0.25], [-0.12, 0.42], [0.12, 0.42]].forEach(o => brilla(testa, 0.055, 0xffd27a, o[0], o[1], 0.42));
    const bL = perno(busto, -1.7, 1.55, 0.1), bR = perno(busto, 1.7, 1.55, 0.1);
    [bL, bR].forEach((p, k) => {
      const s = k ? 1 : -1; sfera(p, 0.55, C.pelle, 0, 0, 0); cil(p, 0.38, 0.32, 1.3, C.pelle, s * 0.1, -0.75, 0.1); const av = perno(p, s * 0.15, -1.45, 0.15);
      sfera(av, 0.48, C.pelleS, 0, -0.25, 0.1, 1, 0.8, 1.1); cil(av, 0.36, 0.36, 0.25, C.ferro, 0, 0.1, 0.05, 10);
      for (let c = 0; c < 4; c++) { const an = new T.Mesh(new T.TorusGeometry(0.12, 0.035, 6, 12), M(C.ferro)); an.position.set(s * 0.1, -0.05 - c * 0.2, -0.3 - c * 0.02); an.rotation.y = c % 2 ? PI / 2 : 0; av.add(an); }
      p.userData.av = av;
    });
    const anim = (t) => {
      const r = Math.sin(t * 1.2); busto.rotation.x = r * 0.03; busto.position.y = 1.3 + r * 0.05; testa.rotation.y = Math.sin(t * 0.7) * 0.3;
      bL.rotation.x = Math.sin(t * 1.2) * 0.12; bR.rotation.x = -Math.sin(t * 1.2) * 0.12;
      ventre.scale.set(1 + r * 0.06, 1 + r * 0.06, 0.65); vA.material.opacity = 0.18 + r * 0.06; pustola.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
    };
    root.scale.setScalar(1.25);
    return { root, anim, alt: 6.0, nome: 'Bruthak l\'Insaziabile' };
  }

  // Il Re Senza Luce (boss finale, prossima versione): alto e sottile, corazza a costole, corona enorme, cuore di vuoto, spadone.
  function reSenzaLuce() {
    const root = new T.Group(), g = perno(root, 0, 0, 0);
    const gL = perno(g, -0.28, 1.5, 0), gR = perno(g, 0.28, 1.5, 0);
    [gL, gR].forEach(p => { cil(p, 0.13, 0.1, 1.45, C.chitina, 0, -0.72, 0, 8); box(p, 0.24, 0.12, 0.5, C.chitinaS, 0, -1.45, 0.12); sfera(p, 0.15, C.osso, 0, -0.75, 0.06); });
    const busto = perno(g, 0, 1.55, 0);
    box(busto, 0.75, 0.3, 0.42, C.chitina, 0, 0.1, 0); cil(busto, 0.3, 0.45, 1.0, C.chitina, 0, 0.7, 0, 10);
    for (let i = 0; i < 4; i++) { const c = new T.Mesh(new T.TorusGeometry(0.36 - i * 0.02, 0.035, 6, 16, PI), M(C.osso)); c.position.set(0, 0.45 + i * 0.17, 0.04); c.rotation.set(0, 0, PI); busto.add(c); }
    const cuore = new T.Mesh(new T.SphereGeometry(0.16, 16, 12), new T.MeshBasicMaterial({ color: 0x120a1e })); cuore.position.set(0, 0.85, 0.3); busto.add(cuore); const cA = alone(busto, 0.32, 0x9a6bff, 0, 0.85, 0.3, 0.35);
    [-1, 1].forEach(s => { sfera(busto, 0.27, C.chitinaS, s * 0.52, 1.25, 0, 1.2, 0.8, 1); for (let k = 0; k < 3; k++) cono(busto, 0.05, 0.45 + k * 0.12, C.osso, s * (0.5 + k * 0.1), 1.5 + k * 0.05, -0.1).rotation.z = -s * (0.2 + k * 0.25); });
    const mant = box(busto, 1.2, 2.6, 0.06, '#1d1826', 0, 0.05, -0.32); mant.rotation.x = 0.1; stracci(busto, 0.3, 0.5, '#1d1826', -1.1, 6);
    const testa = perno(busto, 0, 1.55, 0);
    sfera(testa, 0.24, C.osso, 0, 0.1, 0, 0.9, 1.15, 1); box(testa, 0.3, 0.06, 0.08, '#141218', 0, 0.12, 0.2); [-0.07, 0.07].forEach(x => brilla(testa, 0.03, 0xc7a8ff, x, 0.12, 0.24));
    for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.6, h = 0.9 - Math.abs(i - 4) * 0.14; const c = cono(testa, 0.05, h, i % 2 ? C.ossoS : C.osso, Math.sin(a) * 0.3, 0.35 + h / 2, Math.cos(a) * 0.08 - 0.08, 6); c.rotation.z = -a * 0.35; }
    const bL = perno(busto, -0.62, 1.2, 0), bR = perno(busto, 0.62, 1.2, 0);
    [bL, bR].forEach(p => { cil(p, 0.1, 0.08, 0.9, C.chitina, 0, -0.45, 0, 8); sfera(p, 0.1, C.osso, 0, -0.92, 0.04); });
    const spada = perno(bR, 0, -0.95, 0.1); cil(spada, 0.04, 0.04, 0.5, C.ferro, 0, 0, 0, 8); box(spada, 0.5, 0.08, 0.14, C.osso, 0, 0.28, 0);
    const lama = box(spada, 0.16, 2.6, 0.05, '#2b2340', 0, 1.6, 0); const fil = new T.Mesh(new T.BoxGeometry(0.03, 2.5, 0.06), luce(0x9a6bff)); fil.position.set(0.09, 1.6, 0); spada.add(fil);
    spada.rotation.x = 0.15; bL.rotation.x = -0.3;
    const anim = (t) => { g.position.y = Math.sin(t * 0.9) * 0.03; busto.rotation.y = Math.sin(t * 0.5) * 0.12; cA.scale.setScalar(1 + Math.sin(t * 2) * 0.15); cA.material.opacity = 0.3 + Math.sin(t * 2) * 0.1; mant.rotation.x = 0.1 + Math.sin(t * 1.3) * 0.04; };
    root.scale.setScalar(1.85);
    return { root, anim, alt: 8.5, nome: 'Il Re Senza Luce' };
  }

  /* ---------- ARMI (in mano al giocatore, viste in prima persona) ----------
     Piu' realistiche: il profilo laterale di ogni pezzo (corpo, calcio, impugnatura, caricatore) e' disegnato
     e poi estruso con i bordi smussati; metallo lucido e plastica opaca (materiali con riflessi, senza contorno).
     Il davanti e' verso -z, la bocca della canna a z = -0.6 (li' compare il lampo dello sparo).
     anim(t, dt, info): info = { ric: avanzamento della ricarica 0..1 (0 = non ricarica), colpo: true quando spara }. */
  const cacheP = {};
  function mp(c, lucido, em) {   // materiale con riflessi: lucido 0..1
    const k = c + '/' + lucido + '/' + (em || 0); if (cacheP[k]) return cacheP[k];
    return (cacheP[k] = new T.MeshPhongMaterial({ color: c, specular: new T.Color(0x222222).lerp(new T.Color(0xbfc6d4), lucido), shininess: 8 + lucido * 90, emissive: em || 0 }));
  }
  const MET = () => mp(0x2a2d34, 0.75), MET2 = () => mp(0x43474f, 0.85), POL = () => mp(0x1b1d22, 0.15), POL2 = () => mp(0x26282e, 0.2);
  // profilo [[z, y], ...] estruso per "spessore" (asse x), con smusso
  function profilo(g, punti, spessore, mat, x, smusso) {
    const sh = new T.Shape(); punti.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1]))); sh.closePath();
    const b = smusso === undefined ? 0.006 : smusso;
    const geo = new T.ExtrudeGeometry(sh, { depth: spessore, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
    geo.translate(0, 0, -spessore / 2); geo.rotateY(-PI / 2); geo.computeVertexNormals();
    const m = new T.Mesh(geo, mat); m.position.x = x || 0; g.add(m); return m;
  }
  function pz2(g, geo, mat, x, y, z) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; }
  const tubo = (g, r, len, mat, x, y, z, seg) => { const m = pz2(g, new T.CylinderGeometry(r, r, len, seg || 14), mat, x, y, z); m.rotation.x = PI / 2; return m; };
  const blocco = (g, w, h, d, mat, x, y, z) => pz2(g, new T.BoxGeometry(w, h, d), mat, x, y, z);
  function slitta(g, z0, z1, y) {   // slitta picatinny: base e denti
    blocco(g, 0.034, 0.01, z1 - z0, MET(), 0, y, (z0 + z1) / 2);
    for (let z = z0 + 0.012; z < z1; z += 0.026) blocco(g, 0.042, 0.009, 0.012, MET2(), 0, y + 0.009, z);
  }
  function ponticello(g, z, y) {   // ponticello e grilletto
    const t = pz2(g, new T.TorusGeometry(0.034, 0.006, 6, 16, PI), MET(), 0, y, z); t.rotation.set(0, PI / 2, PI);
    const gr = blocco(g, 0.012, 0.035, 0.01, MET2(), 0, y + 0.004, z - 0.004); gr.rotation.x = 0.35;
  }
  const viti = (g, lista, mat) => lista.forEach(p => { const v = pz2(g, new T.CylinderGeometry(0.006, 0.006, 0.006, 8), mat || MET2(), p[0], p[1], p[2]); v.rotation.z = PI / 2; });
  const scatto = (s, dt, colpo, dur) => { if (colpo) s.k = dur; s.k = Math.max(0, (s.k || 0) - dt); return s.k / dur; };
  const fuori = r => (r <= 0 ? 0 : r < 0.32 ? r / 0.32 : r < 0.62 ? 1 : Math.max(0, (1 - r) / 0.38));   // caricatore: esce, resta fuori, rientra
  function baseArma() { const root = new T.Group(), g = perno(root, 0, 0, 0); return [root, g]; }

  // Rondine: fucile automatico, leggero e veloce. Fusto in metallo brunito, astina color osso, accenti azzurri.
  function rondine() {
    const [root, g] = baseArma(), az = mp(0x7ad8ff, 0.4, 0x2a6f88), osso = mp(0xd8cfb6, 0.35);
    profilo(g, [[-0.2, 0.07], [0.27, 0.07], [0.3, 0.05], [0.3, -0.035], [0.12, -0.055], [0.03, -0.075], [-0.09, -0.075], [-0.2, -0.045]], 0.072, MET());
    profilo(g, [[0.29, 0.05], [0.47, 0.032], [0.52, 0.032], [0.53, -0.105], [0.5, -0.115], [0.43, -0.05], [0.3, -0.03]], 0.058, POL());
    blocco(g, 0.062, 0.14, 0.018, POL2(), 0, -0.04, 0.522);   // calciolo in gomma
    profilo(g, [[0.06, -0.06], [0.125, -0.06], [0.175, -0.215], [0.158, -0.232], [0.1, -0.232], [0.05, -0.085]], 0.064, POL());
    for (let i = 0; i < 4; i++) blocco(g, 0.068, 0.006, 0.03, POL2(), 0, -0.1 - i * 0.03, 0.105 + i * 0.012);   // zigrinatura dell'impugnatura
    ponticello(g, 0.035, -0.083);
    const car = perno(g, 0, 0, 0); profilo(car, [[-0.065, -0.07], [0.0, -0.07], [0.03, -0.2], [0.005, -0.275], [-0.075, -0.262], [-0.088, -0.12]], 0.048, MET2());
    blocco(car, 0.052, 0.014, 0.085, MET(), 0, -0.266, -0.034).rotation.x = -0.25;
    profilo(g, [[-0.49, 0.055], [-0.19, 0.055], [-0.19, -0.042], [-0.47, -0.042], [-0.49, -0.025]], 0.068, osso);   // astina
    for (let i = 0; i < 5; i++) [-1, 1].forEach(s => blocco(g, 0.006, 0.05, 0.022, POL(), s * 0.038, 0.006, -0.25 - i * 0.045));   // prese d'aria
    [-1, 1].forEach(s => blocco(g, 0.004, 0.012, 0.22, az, s * 0.04, -0.03, -0.33));   // filetti azzurri luminosi
    tubo(g, 0.016, 0.2, MET2(), 0, 0.012, -0.54); tubo(g, 0.024, 0.06, MET(), 0, 0.012, -0.6, 8);   // canna e freno di bocca
    [-1, 1].forEach(s => blocco(g, 0.006, 0.026, 0.01, POL(), s * 0.024, 0.012, -0.6));
    slitta(g, -0.46, 0.25, 0.078);
    // mirino olografico: due fianchi, cappuccio e vetro con il punto azzurro
    const ott = perno(g, 0, 0.094, -0.02);
    [-1, 1].forEach(s => blocco(ott, 0.008, 0.06, 0.1, MET(), s * 0.028, 0.03, 0));
    blocco(ott, 0.064, 0.008, 0.1, MET(), 0, 0.062, 0); blocco(ott, 0.064, 0.014, 0.1, MET(), 0, 0.004, 0);
    pz2(ott, new T.PlaneGeometry(0.05, 0.048), new T.MeshPhongMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.25, shininess: 120, specular: 0xffffff }), 0, 0.034, -0.03);
    brilla(ott, 0.0045, 0x7ad8ff, 0, 0.034, -0.032);
    const leva = blocco(g, 0.05, 0.018, 0.03, MET2(), 0, 0.055, 0.245);   // leva di armamento: scatta indietro a ogni colpo
    viti(g, [[0.037, 0.02, 0.12], [0.037, 0.02, -0.1], [-0.037, 0.02, 0.12], [-0.037, 0.02, -0.1]]);
    const s = {};
    const anim = (t, dt, info) => {
      info = info || {}; const k = scatto(s, dt || 0, info.colpo, 0.07), r = fuori(info.ric || 0);
      leva.position.z = 0.245 + k * 0.035; car.position.y = -r * 0.26; car.position.z = r * 0.05; car.rotation.x = r * 0.4;
      g.rotation.z = Math.sin(t * 1.5) * 0.03;
    };
    return { root, anim, alt: 0.4, nome: 'Rondine' };
  }
  // Tridente: fucile a impulsi bullpup, tre canne con anello d'oro, raffiche da 3. Viola scuro e oro.
  function tridente() {
    const [root, g] = baseArma(), corpo = mp(0x3a3242, 0.55), oro = mp(0xd9a441, 0.9, 0x3a2a08), oroL = mp(0xffd27a, 0.4, 0x8a6418);
    profilo(g, [[-0.26, 0.08], [0.31, 0.08], [0.35, 0.05], [0.37, -0.08], [0.2, -0.1], [-0.04, -0.09], [-0.26, -0.06]], 0.088, corpo);
    profilo(g, [[0.31, 0.06], [0.5, 0.045], [0.535, 0.03], [0.54, -0.12], [0.5, -0.13], [0.37, -0.1]], 0.08, POL());
    blocco(g, 0.074, 0.15, 0.016, POL2(), 0, -0.045, 0.548);
    profilo(g, [[-0.07, -0.085], [-0.005, -0.085], [0.04, -0.235], [0.022, -0.252], [-0.035, -0.252], [-0.08, -0.1]], 0.066, POL());   // impugnatura avanti (bullpup)
    for (let i = 0; i < 4; i++) blocco(g, 0.07, 0.006, 0.03, POL2(), 0, -0.12 - i * 0.03, -0.028 + i * 0.012);
    ponticello(g, -0.085, -0.105);
    const car = perno(g, 0, 0, 0); profilo(car, [[0.2, -0.095], [0.29, -0.095], [0.3, -0.2], [0.21, -0.2]], 0.05, MET2());   // caricatore dietro l'impugnatura
    blocco(g, 0.092, 0.012, 0.5, oro, 0, 0.082, 0.04);   // filetto d'oro sul dorso
    [-1, 1].forEach(s => blocco(g, 0.004, 0.022, 0.3, oro, s * 0.046, 0.0, 0.08));
    // tre canne a triangolo sotto una copertura a mezzo cilindro
    [[-0.026, 0.02], [0.026, 0.02], [0, -0.025]].forEach(o => tubo(g, 0.016, 0.38, MET2(), o[0], o[1], -0.44));
    const cop = pz2(g, new T.CylinderGeometry(0.058, 0.058, 0.3, 18, 1, true, -PI / 2, PI), new T.MeshPhongMaterial({ color: 0x3a3242, specular: 0x8a8a96, shininess: 50, side: T.DoubleSide }), 0, 0.005, -0.4); cop.rotation.x = PI / 2;
    const anello = pz2(g, new T.TorusGeometry(0.06, 0.012, 8, 24), oroL, 0, 0.005, -0.6);
    [0, 1, 2].forEach(i => blocco(g, 0.006, 0.02, 0.07, oroL, 0, 0.0, -0.6).rotation.z = i * PI * 2 / 3);
    // cannocchiale con anelli e lente
    const sc = perno(g, 0, 0.13, -0.02);
    tubo(sc, 0.022, 0.2, MET(), 0, 0, 0); tubo(sc, 0.03, 0.05, MET(), 0, 0, -0.11); tubo(sc, 0.028, 0.04, MET(), 0, 0, 0.11);
    [-0.05, 0.05].forEach(z => blocco(sc, 0.03, 0.04, 0.02, MET2(), 0, -0.035, z));
    pz2(sc, new T.CircleGeometry(0.025, 18), new T.MeshPhongMaterial({ color: 0x223a5a, shininess: 140, specular: 0xffffff, emissive: 0x06121e }), 0, 0, -0.136).rotation.y = PI;
    const otturatore = blocco(g, 0.02, 0.02, 0.05, oro, 0.046, 0.04, 0.2);
    viti(g, [[0.046, 0.03, -0.15], [0.046, -0.04, 0.25], [-0.046, 0.03, -0.15], [-0.046, -0.04, 0.25]], oro);
    const s = {};
    const anim = (t, dt, info) => {
      info = info || {}; const k = scatto(s, dt || 0, info.colpo, 0.06), r = fuori(info.ric || 0);
      anello.rotation.z = t * 2 + k * 2; otturatore.position.z = 0.2 + k * 0.03;
      car.position.y = -r * 0.24; car.position.z = r * 0.06; car.rotation.x = -r * 0.3;
      g.rotation.z = Math.sin(t * 1.5) * 0.03;
    };
    return { root, anim, alt: 0.4, nome: 'Tridente' };
  }
  // Martello: cannone a mano a tamburo. Acciaio, guancette di legno, bagliore arancio alla bocca.
  function martello() {
    const [root, g] = baseArma(), legno = mp(0x5a3a24, 0.3), legnoS = mp(0x3f2818, 0.2), acc = mp(0x9aa0aa, 0.95);
    profilo(g, [[-0.12, 0.065], [0.15, 0.065], [0.2, 0.035], [0.2, -0.04], [0.12, -0.052], [0.05, -0.04], [-0.12, -0.035]], 0.058, acc);
    // canna lunga con bindella e mirino
    const canna = pz2(g, new T.CylinderGeometry(0.034, 0.036, 0.46, 8), acc, 0, 0.032, -0.35); canna.rotation.x = PI / 2;
    tubo(g, 0.016, 0.02, POL(), 0, 0.032, -0.585, 12);   // la bocca, scura
    blocco(g, 0.026, 0.026, 0.44, acc, 0, 0.068, -0.34); blocco(g, 0.012, 0.03, 0.03, MET(), 0, 0.09, -0.55);
    blocco(g, 0.05, 0.022, 0.32, MET(), 0, -0.003, -0.31);   // alloggio dell'estrattore sotto la canna
    // tamburo da 6 colpi con scanalature: gira a ogni colpo e si apre in ricarica
    const perTamb = perno(g, 0, -0.01, -0.05), tamb = perno(perTamb, 0, 0.045, 0);
    tubo(tamb, 0.07, 0.13, MET(), 0, 0, 0, 18);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; blocco(tamb, 0.014, 0.016, 0.12, POL(), Math.sin(a) * 0.068, Math.cos(a) * 0.068, 0).rotation.z = -a; }
    for (let i = 0; i < 6; i++) { const a = (i + 0.5) / 6 * PI * 2; tubo(tamb, 0.012, 0.004, mp(0xc9a24a, 0.9), Math.sin(a) * 0.042, Math.cos(a) * 0.042, -0.066, 10); }
    // impugnatura di legno con medaglione
    profilo(g, [[0.12, -0.04], [0.2, -0.04], [0.275, -0.215], [0.245, -0.26], [0.16, -0.262], [0.1, -0.085]], 0.074, legno, 0, 0.008);
    for (let i = 0; i < 5; i++) blocco(g, 0.078, 0.004, 0.04, legnoS, 0, -0.1 - i * 0.03, 0.15 + i * 0.016);
    [-1, 1].forEach(s => { const md = pz2(g, new T.CylinderGeometry(0.014, 0.014, 0.004, 14), mp(0xd9a441, 0.9), s * 0.04, -0.15, 0.185); md.rotation.z = PI / 2; });
    ponticello(g, 0.075, -0.07);
    const cane = perno(g, 0, 0.055, 0.17); blocco(cane, 0.018, 0.06, 0.025, MET(), 0, 0.03, 0).rotation.x = -0.4;
    brilla(g, 0.018, 0xff8a5a, 0, 0.032, -0.6);
    viti(g, [[0.031, 0.02, 0.1], [-0.031, 0.02, 0.1], [0.031, -0.02, -0.15], [-0.031, -0.02, -0.15]]);
    const s = { giro: 0, ang: 0 };
    const anim = (t, dt, info) => {
      info = info || {}; if (info.colpo) s.giro += PI / 3; s.ang += (s.giro - s.ang) * Math.min(1, (dt || 0) * 18);
      const k = scatto(s, dt || 0, info.colpo, 0.12), r = fuori(info.ric || 0);
      tamb.rotation.z = s.ang + (info.ric > 0 ? t * 9 * r : 0); perTamb.position.x = r * 0.07; perTamb.rotation.z = r * 0.9;
      cane.rotation.x = k > 0 ? -0.6 * k : -0.05; g.rotation.z = Math.sin(t * 1.5) * 0.03;
    };
    return { root, anim, alt: 0.4, nome: 'Martello' };
  }

  B.ModelliRaid = { strisciante, novizio, guardacripta, cantrice, officiante, bruthak, reSenzaLuce, rondine, tridente, martello, COLORI: C };
})();
