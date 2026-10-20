/* =====================================================================
   La Cripta del Re senza Luce: EQUIPAGGIAMENTO SULL'AVATAR
   Ogni pezzo ha un SET (la forma) e una RARITA' (colori e bagliore).
   Set: portatore (lanterna, equilibrato), sentinella (pesante), viandante (leggero),
        oracolo (mistico). Gli STELLARI hanno forma e potere tutti loro.
   B3.ArmatureCripta.veste(av, equip) -> { togli(), anima(dt) }
   equip = { casco: { r, set } | { r: 4, k } | null, armatura: ..., guanti, scarpe, mantello }
   (per compatibilita' un numero vale { r: numero, set: 'portatore' })
   Non si copiano forme o nomi di altri giochi: solo lo spirito.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, PI = Math.PI;

  /* ---------- colori per rarita' ---------- */
  const STILI = [
    { met: '#7a6a58', bordo: '#4e3f30', gemma: null, luce: 0, rune: 0 },                       // comune: cuoio e ferro grezzo
    { met: '#5f82b0', bordo: '#2f4f80', gemma: '#5b9cf0', luce: 0, rune: 0.3 },                // rara: acciaio blu
    { met: '#6a4a9a', bordo: '#c9a8ff', gemma: '#d08aff', luce: 0.35, rune: 0.6 },             // epica: viola con rune
    { met: '#c98f24', bordo: '#ffe08a', gemma: '#ff6a2a', luce: 0.45, rune: 0.8 },             // leggendaria: oro
    { met: '#3f9fca', bordo: '#bff7ff', gemma: '#7fe8ff', luce: 1.0, rune: 1, cristallo: 1 }   // stellare: cristallo di cometa
  ];
  // stoffa dei set (cappucci, sciarpe, vesti, mantelli) per rarita'
  const STOFFA = {
    portatore: ['#6b4a2e', '#2f4f7a', '#4a2a6a', '#8a1f22', '#1b2a5a'],
    sentinella: ['#5a4a3a', '#3a4a5a', '#3f2f5a', '#5a1f1f', '#22305a'],
    viandante: ['#4a5a3a', '#2f5a5a', '#4a3a6a', '#6a2f2a', '#1f3f5a'],
    oracolo: ['#5a4a6a', '#2a3f6a', '#3a1f5a', '#5a1a3a', '#0f1f4a']
  };
  const SET = ['portatore', 'sentinella', 'viandante', 'oracolo'];
  const MAT = (col, luce) => M(col, luce ? { emissive: new T.Color(col), emissiveIntensity: luce * 0.5 } : null);
  const LUCE = (col, k) => M(col, { emissive: new T.Color(col), emissiveIntensity: k === undefined ? 0.9 : k });
  const TELA = (col, luce, colLuce) => new T.MeshToonMaterial({ color: new T.Color(col), side: T.DoubleSide, gradientMap: M('#fff').gradientMap, emissive: new T.Color(colLuce || col), emissiveIntensity: luce || 0 });
  const add = (g, m) => { g.add(m); return m; };
  const box = (g, mat, sx, sy, sz, x, y, z, l) => add(g, mesh(new T.BoxGeometry(sx, sy, sz), mat, { x, y, z, l }));
  const sfera = (g, mat, r, x, y, z, l) => add(g, mesh(new T.SphereGeometry(r, 14, 10), mat, { x, y, z, l }));
  const cil = (g, mat, r1, r2, h, x, y, z, l, seg) => add(g, mesh(new T.CylinderGeometry(r1, r2, h, seg || 14), mat, { x, y, z, l }));
  const cono = (g, mat, r, h, x, y, z, seg) => add(g, mesh(new T.ConeGeometry(r, h, seg || 6), mat, { x, y, z }));
  const anello = (g, mat, R, t, x, y, z, rx) => { const m = add(g, mesh(new T.TorusGeometry(R, t, 8, 28), mat, { x, y, z, cast: false })); m.rotation.x = rx === undefined ? PI / 2 : rx; return m; };
  function gemma(g, S, x, y, z, r) { if (S.gemma) add(g, mesh(new T.OctahedronGeometry(r || 0.045, 0), LUCE(S.gemma), { x, y, z, cast: false })); }
  // piccola lanterna: gabbia, fiamma e (dalla rara in su) luce
  function lanterna(g, S, x, y, z, k) {
    k = k || 1; const L = new T.Group(); L.position.set(x, y, z); L.scale.setScalar(k); g.add(L);
    const fe = MAT(S.bordo, S.luce * 0.4);
    box(L, fe, 0.11, 0.02, 0.11, 0, 0.07, 0); box(L, fe, 0.11, 0.02, 0.11, 0, -0.07, 0);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cil(L, fe, 0.008, 0.008, 0.14, a * 0.05, 0, b * 0.05, 0, 4));
    const f = add(L, mesh(new T.SphereGeometry(0.035, 10, 8), LUCE(S.cristallo ? '#9ff4ff' : '#ffd27a', 1.2), { cast: false })); f.scale.y = 1.4; f.userData.fiamma = 1;
    anello(L, fe, 0.03, 0.008, 0, 0.1, 0, 0);
    return L;
  }
  // rune: piccoli segni luminosi, piu' accesi con la rarita'
  function rune(g, S, pts) { if (!S.rune) return; const mt = LUCE(S.bordo, S.rune); pts.forEach(p => box(g, mt, p[3] || 0.05, p[4] || 0.012, 0.01, p[0], p[1], p[2])); }

  /* =====================================================================
     CASCO
     ===================================================================== */
  function calotta(g, S, met, r, alt) {   // calotta + paranuca (coprono capelli e nuca, il viso resta libero)
    const c = add(g, mesh(new T.SphereGeometry(0.5, 28, 18, 0, PI * 2, 0, PI * 0.5), met, { y: 0.1, l: 0.02 })); c.scale.set(1.1, alt || 1.02, 1.08);
    const nuca = add(g, new T.Mesh(new T.CylinderGeometry(0.55, 0.53, 0.3, 28, 1, true, PI * 0.42, PI * 1.16), TELA(S.met, S.cristallo ? 0.12 : 0))); nuca.position.y = -0.04; nuca.scale.z = 1.06;
    anello(g, MAT(S.bordo, S.luce * 0.6), 0.5, 0.035, 0, 0.11, 0).scale.set(1.1, 1.08, 1);
    return c;
  }
  const CASCHI = {
    portatore(g, S, r) {   // calotta con cresta a lanterna
      const met = MAT(S.met, S.cristallo ? 0.25 : 0); calotta(g, S, met);
      box(g, MAT(S.bordo, S.luce * 0.6), 0.06, 0.08, 0.62, 0, 0.6, -0.02);
      lanterna(g, S, 0, 0.72, 0.05, 0.9 + r * 0.05);
      [-1, 1].forEach(s => box(g, met, 0.05, 0.2, 0.17, s * 0.52, -0.02, 0.02, 0.012));
      rune(g, S, [[-0.18, 0.38, 0.45], [0.18, 0.38, 0.45]]);
      gemma(g, S, 0, 0.3, 0.52, 0.05);
    },
    sentinella(g, S, r) {   // elmo squadrato, visiera alzata sulla fronte, creste laterali
      const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6);
      const c = calotta(g, S, met, r, 0.9); c.scale.x = 1.16;
      box(g, met, 1.02, 0.14, 0.2, 0, 0.2, 0.42, 0.016);        // visiera alzata
      box(g, bordo, 0.5, 0.025, 0.04, 0, 0.2, 0.53);            // fessura
      [-1, 1].forEach(s => box(g, met, 0.12, 0.32, 0.36, s * 0.55, 0.0, 0.0, 0.016));
      box(g, met, 0.08, 0.1 + r * 0.03, 0.66, 0, 0.6, -0.04, 0.012);
      if (r >= 2) box(g, bordo, 0.09, 0.03, 0.68, 0, 0.66 + r * 0.015, -0.04);
      rune(g, S, [[0, 0.32, 0.53, 0.2]]);
      gemma(g, S, 0, 0.42, 0.5, 0.055);
    },
    viandante(g, S, r) {   // cappuccio di stoffa con bordo di metallo sulla fronte
      const st = TELA(STOFFA.viandante[r]);
      const cap = add(g, new T.Mesh(new T.SphereGeometry(0.56, 28, 18, PI / 2 + 0.95, PI * 2 - 1.9, 0, PI * 0.66), st)); cap.position.y = 0.04; cap.scale.set(1.04, 1.06, 1.06); cap.castShadow = true;
      const vis = add(g, new T.Mesh(new T.SphereGeometry(0.565, 28, 18, PI / 2 - 0.95, 1.9, 0, PI * 0.3), st)); vis.position.y = 0.04; vis.scale.set(1.04, 1.06, 1.06);   // sopra la fronte
      const punta = add(g, new T.Mesh(new T.ConeGeometry(0.2, 0.35, 12), st)); punta.position.set(0, 0.5, -0.38); punta.rotation.x = -1.1;
      const bordo = MAT(S.bordo, S.luce * 0.6);
      const ar = add(g, mesh(new T.TorusGeometry(0.5, 0.03, 8, 30, PI * 0.9), MAT(S.met), { y: 0.2, cast: false })); ar.rotation.set(-0.25, 0, PI * 0.05); ar.position.z = 0.06;
      [-1, 1].forEach(s => add(g, mesh(new T.OctahedronGeometry(0.03, 0), bordo, { x: s * 0.36, y: 0.32, z: 0.38 })));
      rune(g, S, [[0, 0.46, 0.42, 0.12]]);
      gemma(g, S, 0, 0.36, 0.5, 0.045);
    },
    oracolo(g, S, r) {   // fascia alta con occhio di gemma e anello di rune che gira dietro la testa
      const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6);
      const fa = add(g, mesh(new T.CylinderGeometry(0.48, 0.5, 0.2, 28, 1, true), met, { y: 0.24, l: 0.014 })); fa.scale.set(1.04, 1, 1.02);
      const pl = add(g, mesh(new T.CylinderGeometry(0.11, 0.11, 0.04, 6), met, { y: 0.4, z: 0.5, l: 0.012 })); pl.rotation.x = PI / 2;
      add(g, mesh(new T.SphereGeometry(0.06, 14, 10), LUCE(S.gemma || '#c9b8ff', 0.6 + S.luce), { y: 0.4, z: 0.53, cast: false })).scale.z = 0.5;
      [-1, 1].forEach(s => { const ala = box(g, met, 0.03, 0.1, 0.26, s * 0.18, 0.5, 0.42); ala.rotation.z = -s * 0.7; });
      const halo = anello(g, LUCE(S.bordo, 0.4 + S.luce * 0.6), 0.36, 0.02, 0, 0.36, -0.42, 0.25); halo.userData.gira = 1;
      if (r >= 1) for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2, q = add(halo, mesh(new T.BoxGeometry(0.06, 0.04, 0.01), LUCE(S.bordo, 0.6), { x: Math.cos(a) * 0.36, y: Math.sin(a) * 0.36, cast: false })); q.rotation.z = a; }
      calotta(g, S, MAT(STOFFA.oracolo[r]), r, 0.96);
    }
  };
  const CASCHI_STELLARI = {
    occhio(g, S) {   // Occhio della Cometa: grande lente sulla fronte e antenna
      calotta(g, S, MAT('#1f2f4a', 0.1));
      const l = add(g, mesh(new T.SphereGeometry(0.13, 18, 14), LUCE('#7fe8ff', 1.4), { y: 0.36, z: 0.46, cast: false })); l.scale.z = 0.5;
      anello(g, MAT('#bff7ff', 0.5), 0.14, 0.025, 0, 0.36, 0.47, 0);
      cil(g, MAT('#bff7ff'), 0.012, 0.012, 0.4, 0.3, 0.72, -0.1, 0, 6).rotation.z = -0.4;
      sfera(g, LUCE('#7fe8ff', 1.4), 0.04, 0.38, 0.9, -0.1);
    },
    faro(g, S) {   // Faro del Borgo: grande lanterna sulla testa che illumina
      calotta(g, S, MAT('#2a2230'));
      lanterna(g, S, 0, 0.78, 0, 2.0);
      [-1, 1].forEach(s => { const ala = box(g, MAT('#ffe08a', 0.4), 0.04, 0.2, 0.32, s * 0.5, 0.35, -0.05); ala.rotation.z = -s * 0.5; });
    }
  };

  /* =====================================================================
     ARMATURA (busto)
     ===================================================================== */
  function piastre(g, S, met, bordo, n) {   // corazza a piastre sovrapposte (non la sfera del Cavaliere dell'editor)
    for (let i = 0; i < n; i++) { const p = add(g, mesh(new T.CylinderGeometry(0.27 - i * 0.012, 0.29 - i * 0.012, 0.13, 20), met, { y: 0.16 + i * 0.12, l: 0.018 })); p.scale.z = 0.86; anello(g, bordo, 0.29 - i * 0.012, 0.012, 0, 0.1 + i * 0.12, 0).scale.y = 0.86; }
  }
  function emblemaLanterna(g, S, z) { lanterna(g, S, 0, 0.3, z, 0.9); }
  const ARMATURE = {
    portatore(g, S, r) {
      const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6);
      piastre(g, S, met, bordo, 3);
      [-1, 1].forEach(s => { const sp = add(g, mesh(new T.SphereGeometry(0.17, 16, 10, 0, PI * 2, 0, PI * 0.55), met, { x: s * 0.32, y: 0.5, l: 0.018 })); sp.scale.set(1.2, 0.85, 1.05); anello(g, bordo, 0.17, 0.018, s * 0.32, 0.5, 0); box(g, met, 0.2, 0.05, 0.24, s * 0.34, 0.41, 0, 0.012); });
      emblemaLanterna(g, S, 0.27);
      add(g, mesh(new T.CylinderGeometry(0.3, 0.3, 0.05, 20), MAT('#5a3a22'), { y: 0.08 })).scale.z = 0.86;   // cintura
      if (r >= 2) lanterna(g, S, 0.24, 0.0, 0.14, 0.8);                                                    // lanterna alla cintura
      rune(g, S, [[-0.13, 0.42, 0.25], [0.13, 0.42, 0.25]]);
    },
    sentinella(g, S, r) {   // corazza massiccia, spallacci squadrati, gorgiera
      const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6);
      const c = add(g, mesh(new T.CylinderGeometry(0.3, 0.32, 0.42, 4), met, { y: 0.3, l: 0.02 })); c.rotation.y = PI / 4; c.scale.set(1.05, 1, 0.8);
      add(g, mesh(new T.CylinderGeometry(0.22, 0.3, 0.1, 18), met, { y: 0.52, l: 0.016 }));
      [-1, 1].forEach(s => { box(g, met, 0.26, 0.12, 0.3, s * 0.36, 0.53, 0, 0.018); box(g, met, 0.22, 0.08, 0.26, s * 0.38, 0.43, 0, 0.014); box(g, bordo, 0.27, 0.025, 0.31, s * 0.36, 0.6, 0); });
      box(g, bordo, 0.3, 0.05, 0.03, 0, 0.36, 0.25); box(g, bordo, 0.05, 0.22, 0.03, 0, 0.3, 0.25);
      const tab = add(g, new T.Mesh(new T.PlaneGeometry(0.26, 0.4), TELA(STOFFA.sentinella[r]))); tab.position.set(0, -0.08, 0.24);   // stendardo davanti
      gemma(g, S, 0, 0.36, 0.27, 0.05);
      rune(g, S, [[-0.1, 0.18, 0.26], [0.1, 0.18, 0.26]]);
    },
    viandante(g, S, r) {   // corpetto leggero, cinghie incrociate e tasche
      const met = MAT(S.met), cuoio = MAT('#5a3a22'), st = MAT(STOFFA.viandante[r]);
      const c = add(g, mesh(new T.CylinderGeometry(0.26, 0.275, 0.4, 18), st, { y: 0.28, l: 0.018 })); c.scale.z = 0.86;
      [-1, 1].forEach(s => { const cg = box(g, cuoio, 0.05, 0.6, 0.02, s * 0.05, 0.28, 0.24); cg.rotation.z = s * 0.6; });
      [-0.15, 0, 0.15].forEach(x => box(g, cuoio, 0.09, 0.08, 0.06, x, 0.1, 0.24, 0.01));
      [-1, 1].forEach(s => { const sp = add(g, mesh(new T.SphereGeometry(0.11, 12, 8, 0, PI * 2, 0, PI * 0.5), met, { x: s * 0.3, y: 0.5, l: 0.014 })); sp.scale.set(1, 0.7, 1); });
      gemma(g, S, 0, 0.32, 0.26, 0.04);
      if (r >= 2) [-1, 1].forEach(s => { const pu = cono(g, MAT(S.bordo, S.luce * 0.6), 0.025, 0.12, s * 0.22, 0.12, 0.25, 4); pu.rotation.x = PI / 2; });   // pugnali
      rune(g, S, [[0, 0.44, 0.25, 0.1]]);
    },
    oracolo(g, S, r) {   // veste lunga con collo alto e fascia di rune
      const st = TELA(STOFFA.oracolo[r]), met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6);
      const ve = add(g, mesh(new T.CylinderGeometry(0.27, 0.285, 0.42, 20), MAT(STOFFA.oracolo[r]), { y: 0.28, l: 0.018 })); ve.scale.z = 0.86;
      const fa = box(g, MAT(S.bordo, S.luce * 0.4), 0.08, 0.6, 0.02, 0, 0.28, 0.25); fa.rotation.z = 0.55;   // fascia di traverso
      add(g, mesh(new T.CylinderGeometry(0.295, 0.295, 0.06, 20), MAT('#3a2418'), { y: 0.09 })).scale.z = 0.86;   // cintura
      const li = box(g, MAT('#4a2a1a'), 0.12, 0.15, 0.06, 0.26, 0.0, 0.1, 0.012); li.rotation.y = 0.5; box(g, MAT(S.bordo, S.luce * 0.5), 0.13, 0.02, 0.065, 0.26, 0.0, 0.1).rotation.y = 0.5;   // libro alla cintura
      const co = add(g, mesh(new T.CylinderGeometry(0.2, 0.27, 0.18, 18, 1, true), met, { y: 0.55, l: 0.014 })); co.scale.z = 0.86;
      box(g, met, 0.12, 0.62, 0.03, 0, 0.18, 0.27, 0.01);
      rune(g, S, [[0, 0.42, 0.29, 0.06, 0.03], [0, 0.3, 0.29, 0.06, 0.03], [0, 0.18, 0.29, 0.06, 0.03], [0, 0.06, 0.29, 0.06, 0.03]]);
      gemma(g, S, 0, 0.5, 0.26, 0.05);
      [-1, 1].forEach(s => { const sp = add(g, mesh(new T.SphereGeometry(0.12, 12, 8, 0, PI * 2, 0, PI * 0.5), met, { x: s * 0.3, y: 0.5, l: 0.014 })); sp.scale.set(1, 0.6, 1); });
    }
  };
  const ARMATURE_STELLARI = {
    cratere(g, S) {   // Cuore del Cratere: corazza scura con un nucleo di cometa che pulsa
      const met = MAT('#2a2a38'), bordo = LUCE('#7fe8ff', 0.6);
      piastre(g, S, met, bordo, 3);
      const n = add(g, mesh(new T.IcosahedronGeometry(0.1, 1), LUCE('#7fe8ff', 1.5), { y: 0.3, z: 0.25, cast: false })); n.userData.pulsa = 1;
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2, cr = box(g, LUCE('#bff7ff', 1), 0.02, 0.12, 0.01, Math.cos(a) * 0.13, 0.3 + Math.sin(a) * 0.13, 0.255); cr.rotation.z = a + PI / 2; }
      [-1, 1].forEach(s => { const sp = add(g, mesh(new T.SphereGeometry(0.15, 16, 10, 0, PI * 2, 0, PI * 0.55), met, { x: s * 0.3, y: 0.5, l: 0.018 })); sp.scale.set(1.15, 0.85, 1); add(g, mesh(new T.OctahedronGeometry(0.05, 0), LUCE('#7fe8ff', 1.2), { x: s * 0.32, y: 0.62, cast: false })); });
    },
    specchio(g, S) {   // Corazza Specchio: piastre lucide che rimandano indietro i colpi
      const sp = M('#e6eef8', { emissive: new T.Color('#9fb8d8'), emissiveIntensity: 0.4 }), bordo = LUCE('#bff7ff', 0.6);
      piastre(g, S, sp, bordo, 3);
      [-1, 1].forEach(s => { const sc = box(g, sp, 0.3, 0.06, 0.32, s * 0.34, 0.54, 0, 0.016); sc.rotation.z = -s * 0.25; });
      const sc = add(g, mesh(new T.CircleGeometry(0.11, 6), sp, { y: 0.32, z: 0.27 }));
      anello(g, bordo, 0.11, 0.015, 0, 0.32, 0.272, 0);
    }
  };

  /* =====================================================================
     GUANTI (avambraccio e mano, su tutte e due le braccia)
     ===================================================================== */
  const GUANTI = {
    portatore(g, S, r) { const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6); cil(g, met, 0.095, 0.085, 0.11, 0, -0.06, 0, 0.014, 8); anello(g, bordo, 0.084, 0.012, 0, -0.012, 0); sfera(g, met, 0.076, 0, -0.14, 0, 0.016); gemma(g, S, 0, -0.06, 0.085, 0.028); },
    sentinella(g, S, r) { const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6); box(g, met, 0.17, 0.13, 0.17, 0, -0.06, 0, 0.016); box(g, met, 0.16, 0.1, 0.16, 0, -0.15, 0, 0.016); box(g, bordo, 0.18, 0.02, 0.18, 0, 0.0, 0); [-0.05, 0, 0.05].forEach(x => box(g, bordo, 0.025, 0.03, 0.03, x, -0.14, 0.085)); gemma(g, S, 0, -0.06, 0.09, 0.03); },
    viandante(g, S, r) { const fa = MAT(STOFFA.viandante[r]), cuoio = MAT('#5a3a22'); for (let i = 0; i < 3; i++) { const b = add(g, mesh(new T.TorusGeometry(0.074, 0.02, 6, 16), fa, { y: -0.03 - i * 0.04, cast: false })); b.rotation.x = PI / 2 + (i - 1) * 0.15; } sfera(g, cuoio, 0.072, 0, -0.14, 0, 0.014); if (r >= 2) { const la = cono(g, MAT(S.bordo, S.luce * 0.6), 0.02, 0.14, 0, -0.06, 0.09, 4); la.rotation.x = PI / 2; } gemma(g, S, 0, -0.07, 0.08, 0.025); },
    oracolo(g, S, r) { const met = MAT(S.met, S.cristallo ? 0.25 : 0); sfera(g, MAT(STOFFA.oracolo[r]), 0.072, 0, -0.14, 0, 0.014); anello(g, met, 0.08, 0.015, 0, -0.03, 0); anello(g, met, 0.075, 0.015, 0, -0.08, 0); if (S.rune) { const o = anello(g, LUCE(S.bordo, 0.5 + S.luce * 0.5), 0.13, 0.008, 0, -0.06, 0); o.userData.gira = 1; } gemma(g, S, 0, -0.14, 0.08, 0.025); }
  };
  const GUANTI_STELLARI = {
    scintilla(g, S) { const met = MAT('#2a2a38'); cil(g, met, 0.085, 0.078, 0.11, 0, -0.06, 0, 0.014, 12); sfera(g, met, 0.08, 0, -0.14, 0, 0.016); for (let i = 0; i < 5; i++) { const s = add(g, mesh(new T.OctahedronGeometry(0.022, 0), LUCE('#ffd27a', 1.4), { x: Math.cos(i * 1.3) * 0.1, y: -0.14 + Math.sin(i * 1.9) * 0.06, z: Math.sin(i * 1.3) * 0.1, cast: false })); s.userData.scintilla = i; } },
    tuono(g, S) { const met = MAT('#3f5f9a', 0.2), bordo = LUCE('#bff7ff', 0.8); cil(g, met, 0.1, 0.09, 0.12, 0, -0.06, 0, 0.016, 10); const pu = sfera(g, met, 0.11, 0, -0.17, 0, 0.018); pu.scale.set(1.1, 1, 1.1); [-1, 1].forEach(s => { const f = box(g, bordo, 0.015, 0.12, 0.015, s * 0.06, -0.06, 0.1); f.rotation.z = s * 0.4; }); anello(g, bordo, 0.1, 0.012, 0, -0.01, 0); }
  };

  /* =====================================================================
     SCARPE (stinco e piede)
     ===================================================================== */
  function stivale(g, mat, bordo, alt) {   // stivale alto e robusto
    cil(g, mat, 0.124, 0.13, alt || 0.19, 0, -0.12, 0, 0.016, 10);
    const pu = box(g, mat, 0.23, 0.1, 0.34, 0, -0.215, 0.07, 0.016);
    cil(g, bordo, 0.136, 0.136, 0.035, 0, -0.025, 0, 0, 10);
  }
  const SCARPE = {
    portatore(g, S, r) { const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6); stivale(g, met, bordo); box(g, bordo, 0.06, 0.08, 0.03, 0, -0.11, 0.12); gemma(g, S, 0, -0.11, 0.135, 0.025); },
    sentinella(g, S, r) { const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6); stivale(g, met, bordo, 0.2); box(g, met, 0.2, 0.18, 0.06, 0, -0.1, 0.11, 0.014); box(g, met, 0.24, 0.07, 0.3, 0, -0.24, 0.05, 0.014); gemma(g, S, 0, -0.1, 0.145, 0.03); },
    viandante(g, S, r) { const cuoio = MAT('#5a3a22'), fa = MAT(STOFFA.viandante[r]); stivale(g, cuoio, MAT(S.met)); for (let i = 0; i < 2; i++) { const b = add(g, mesh(new T.TorusGeometry(0.138, 0.018, 6, 16), fa, { y: -0.08 - i * 0.06, cast: false })); b.rotation.x = PI / 2; } if (r >= 2) [-1, 1].forEach(s => { for (let i = 0; i < 2; i++) { const al = box(g, MAT(S.bordo, S.luce * 0.6), 0.018, 0.05, 0.2 - i * 0.06, s * 0.14, -0.07 + i * 0.05, -0.05); al.rotation.set(-0.6, 0, -s * 0.45); } }); gemma(g, S, 0, -0.08, 0.125, 0.022); },
    oracolo(g, S, r) { const st = MAT(STOFFA.oracolo[r]), met = MAT(S.met, S.cristallo ? 0.25 : 0); stivale(g, st, met); if (S.rune) { const o = anello(g, LUCE(S.bordo, 0.4 + S.luce * 0.6), 0.16, 0.01, 0, -0.27, 0.03); o.userData.gira = 1; } gemma(g, S, 0, -0.06, 0.125, 0.025); }
  };
  const SCARPE_STELLARI = {
    cometa(g, S) {   // Passi di Cometa (volo): propulsori sotto il tallone con scia di luce
      const met = MAT('#2a2a38'), bordo = LUCE('#7fe8ff', 0.8); stivale(g, met, bordo, 0.2);
      const pr = cil(g, MAT('#4a4a58'), 0.055, 0.07, 0.14, 0, -0.12, -0.15, 0.012, 10); pr.rotation.x = -0.5;
      anello(g, LUCE('#7fe8ff', 1.2), 0.07, 0.015, 0, -0.18, -0.19, PI / 2 - 0.5);
      const fi = add(g, mesh(new T.ConeGeometry(0.055, 0.2, 10), LUCE('#bff7ff', 1.8), { y: -0.26, z: -0.25, cast: false })); fi.rotation.x = PI - 0.5; fi.userData.fiamma = 1;
      [-1, 1].forEach(s => box(g, bordo, 0.015, 0.14, 0.015, s * 0.115, -0.12, 0.02));
    },
    rondine(g, S) {   // Ali di Rondine (doppio salto): alette di piume ai lati della caviglia
      const met = MAT('#3a6aa8', 0.15), bordo = LUCE('#bff7ff', 0.6); stivale(g, met, bordo);
      [-1, 1].forEach(s => { for (let i = 0; i < 4; i++) { const pi = box(g, i % 2 ? LUCE('#7fe8ff', 0.7) : M('#ffffff', { emissive: new T.Color('#bff7ff'), emissiveIntensity: 0.3 }), 0.02, 0.07, 0.36 - i * 0.06, s * 0.17, -0.02 + i * 0.055, -0.1 - i * 0.02, 0.006); pi.rotation.set(-0.5 - i * 0.12, 0, -s * 0.75); } });
    },
    ombra(g, S) {   // Passo d'Ombra (scatto): stivali scuri che lasciano fumo
      const met = MAT('#1a1622'), bordo = LUCE('#9a6aff', 0.8); stivale(g, met, bordo);
      for (let i = 0; i < 5; i++) { const f = add(g, mesh(new T.SphereGeometry(0.07 + i * 0.02, 10, 8), new T.MeshBasicMaterial({ color: 0x9a6aff, transparent: true, opacity: 0.5 - i * 0.08, depthWrite: false }), { x: (i % 2 ? 1 : -1) * 0.06, y: -0.18 + i * 0.05, z: -0.14 - i * 0.08, cast: false })); f.userData.fumo = i; }
      [-1, 1].forEach(s => box(g, bordo, 0.015, 0.16, 0.015, s * 0.115, -0.12, 0.02));
    }
  };

  /* =====================================================================
     MANTELLO (sulla schiena)
     ===================================================================== */
  function telo(g, col, lun, larg, luce, colLuce, bordoCol, bordoLuce) {   // mantello dritto da cavaliere: largo di spalle, scende quasi diritto
    larg = Math.min(larg, 0.36);
    const geo = new T.CylinderGeometry(0.33, larg, lun, 14, 4, true, PI * 0.64, PI * 0.72);
    const t = add(g, new T.Mesh(geo, TELA(col, luce, colLuce))); t.position.y = -lun / 2 + 0.02; t.scale.z = 0.8; t.castShadow = true;
    const o = add(g, new T.Mesh(new T.CylinderGeometry(larg, larg, 0.04, 14, 1, true, PI * 0.64, PI * 0.72), TELA(bordoCol, bordoLuce))); o.position.y = -lun + 0.03; o.scale.z = 0.8;
    [-1, 1].forEach(s => box(g, MAT(bordoCol, bordoLuce), 0.14, 0.05, 0.1, s * 0.25, 0.01, 0.18));   // fibbie sulle spalle
    return t;
  }
  const MANTELLI = {
    portatore(g, S, r) { telo(g, STOFFA.portatore[r], 0.7 + r * 0.04, 0.36, 0, null, S.bordo, S.luce * 0.6); lanterna(g, S, 0, -0.3, -0.3, 0.9); add(g, mesh(new T.CylinderGeometry(0.06, 0.06, 0.04, 12), MAT(S.bordo, S.luce * 0.6), { z: 0.42 })).rotation.x = PI / 2; },
    sentinella(g, S, r) {   // stendardo corto: due drappi squadrati
      [-1, 1].forEach(s => { const d = add(g, new T.Mesh(new T.PlaneGeometry(0.22, 0.6), TELA(STOFFA.sentinella[r]))); d.position.set(s * 0.12, -0.3, -0.06); d.rotation.y = PI; anello(g, MAT(S.bordo, S.luce * 0.6), 0.03, 0.01, s * 0.12, -0.6, -0.06, 0); });
      box(g, MAT(S.met), 0.5, 0.06, 0.06, 0, 0.0, -0.04, 0.012); gemma(g, S, 0, -0.2, -0.08, 0.04);
    },
    viandante(g, S, r) {   // sciarpa lunga a due code che svolazzano
      const st = TELA(STOFFA.viandante[r]);
      const giro = add(g, new T.Mesh(new T.TorusGeometry(0.22, 0.06, 8, 20), st)); giro.rotation.x = PI / 2; giro.position.set(0, 0.04, 0.24);
      [-1, 1].forEach((s, i) => { const c = add(g, new T.Mesh(new T.PlaneGeometry(0.12, 0.75 + r * 0.05, 1, 6), st)); c.position.set(s * 0.08, -0.36, -0.04); c.rotation.set(0.2, PI, s * 0.08); c.userData.coda = i; });
    },
    oracolo(g, S, r) {   // falde del cappotto divise in due, con bordo di rune
      [-1, 1].forEach(s => { const f = add(g, new T.Mesh(new T.PlaneGeometry(0.26, 0.85 + r * 0.04, 1, 4), TELA(STOFFA.oracolo[r]))); f.position.set(s * 0.14, -0.62, -0.02); f.rotation.set(0.12, PI, -s * 0.1); if (S.rune) box(f, LUCE(S.bordo, S.rune), 0.24, 0.02, 0.01, 0, -(0.4 + r * 0.02), -0.005); });
      gemma(g, S, 0, -0.1, -0.06, 0.04);
    }
  };
  const MANTELLI_STELLARI = {
    notte(g, S) {   // Mantello della Notte Chiara: cielo stellato
      telo(g, '#121a3a', 0.85, 0.36, 0.35, '#2a3a8a', '#bff7ff', 0.8);
      for (let i = 0; i < 14; i++) { const a = PI * 0.66 + ((i * 37) % 100) / 100 * PI * 0.68, y = -0.12 - ((i * 53) % 100) / 100 * 0.7, rr = 0.335 + (-y) * 0.035; const st = add(g, mesh(new T.OctahedronGeometry(0.018 + (i % 3) * 0.006, 0), LUCE('#ffffff', 1.5), { x: Math.sin(a) * (rr + 0.012), y, z: Math.cos(a) * (rr + 0.012) * 0.8, cast: false })); st.userData.stella = i; }
    },
    velo(g, S) {   // Velo dell'Invisibile: telo trasparente che sfuma
      const geo = new T.CylinderGeometry(0.33, 0.36, 0.85, 14, 4, true, PI * 0.64, PI * 0.72);
      const t = add(g, new T.Mesh(geo, new T.MeshToonMaterial({ color: new T.Color('#b8a8ff'), transparent: true, opacity: 0.45, side: T.DoubleSide, gradientMap: M('#fff').gradientMap, emissive: new T.Color('#6a5aff'), emissiveIntensity: 0.4, depthWrite: false }))); t.position.y = -0.41; t.scale.z = 0.8; t.userData.velo = 1;
    },
    stendardo(g, S) {   // Stendardo del Borgo: asta sulla schiena con bandiera della lanterna (aiuta la squadra)
      const asta = cil(g, MAT('#5a3a22'), 0.022, 0.022, 1.7, 0.18, 0.35, -0.1, 0.008, 8); asta.rotation.z = -0.18;
      const b = add(g, new T.Mesh(new T.PlaneGeometry(0.5, 0.6, 4, 1), TELA('#b8262a', 0.2, '#ff6a2a'))); b.position.set(0.55, 1.0, -0.1); b.userData.bandiera = 1;
      const b2 = add(g, new T.Mesh(new T.PlaneGeometry(0.5, 0.06), TELA('#ffe08a', 0.6))); b2.position.set(0.55, 0.69, -0.1);
      lanterna(g, STILI[3], 0.55, 1.02, -0.07, 1.4); lanterna(g, STILI[3], 0.55, 1.02, -0.13, 1.4);
      sfera(g, LUCE('#ffe08a', 0.8), 0.05, 0.34, 1.19, -0.1);
    }
  };

  /* =====================================================================
     CATALOGO: nomi e funzioni (le funzioni le applica il gioco)
     ===================================================================== */
  const CATALOGO = {
    set: {
      portatore: { nome: 'del Portatore', desc: 'Equilibrato: un po\' di tutto.' },
      sentinella: { nome: 'della Sentinella', desc: 'Pesante: molta piu\' difesa, un po\' piu\' lento.' },
      viandante: { nome: 'del Viandante', desc: 'Leggero: piu\' veloce, ricarica piu\' in fretta; le scarpe epiche e migliori danno il doppio salto.' },
      oracolo: { nome: 'dell\'Oracolo', desc: 'Mistico: la vita torna prima, le granate si ricaricano piu\' in fretta.' }
    },
    stellari: {
      casco: { occhio: { nome: 'Occhio della Cometa', potere: 'I nemici vicini si vedono attraverso i muri.' }, faro: { nome: 'Faro del Borgo', potere: 'Ogni nemico che elimini ti cura un po\'; la lanterna illumina intorno.' } },
      armatura: { cratere: { nome: 'Cuore del Cratere', potere: 'Sotto il 30% di vita prendi meta\' dei danni.' }, specchio: { nome: 'Corazza Specchio', potere: 'A volte un colpo a distanza torna indietro a chi l\'ha sparato.' } },
      guanti: { scintilla: { nome: 'Mani di Scintilla', potere: 'Le granate esplodono due volte.' }, tuono: { nome: 'Pugni del Tuono', potere: 'Il pugno fa il triplo del danno e fa un\'onda d\'urto.' } },
      scarpe: { cometa: { nome: 'Passi di Cometa', potere: 'In aria tieni premuto il salto e voli per 2,5 secondi.' }, rondine: { nome: 'Ali di Rondine', potere: 'Doppio salto, e il secondo salto e\' piu\' alto.' }, ombra: { nome: 'Passo d\'Ombra', potere: 'Scivolando fai uno scatto lungo e per un attimo i nemici non ti vedono.' } },
      mantello: { notte: { nome: 'Mantello della Notte Chiara', potere: 'Quando rientri sei invulnerabile per 3 secondi.' }, velo: { nome: 'Velo dell\'Invisibile', potere: 'Accovacciato e fermo, i nemici smettono di vederti.' }, stendardo: { nome: 'Stendardo del Borgo', potere: 'I compagni vicini fanno il 10% di danno in piu\'.' } }
    }
  };

  /* ---------- montaggio sull'avatar ---------- */
  const DOVE = {
    casco: av => [av.testa], armatura: av => [av.parti.busto], mantello: av => [av.parti.busto],
    guanti: av => [av.parti.bL.userData.go, av.parti.bR.userData.go], scarpe: av => [av.parti.gL.userData.gin, av.parti.gR.userData.gin]
  };
  const FORME = { casco: [CASCHI, CASCHI_STELLARI], armatura: [ARMATURE, ARMATURE_STELLARI], guanti: [GUANTI, GUANTI_STELLARI], scarpe: [SCARPE, SCARPE_STELLARI], mantello: [MANTELLI, MANTELLI_STELLARI] };
  function cosciali(av, slot, S, set, r) {
    const gs = [], met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6), stoffa = MAT((STOFFA[set] || STOFFA.portatore)[r]);
    [av.parti.gL, av.parti.gR].forEach((an, i) => {
      const g = new T.Group(); an.add(g); gs.push(g); const s = i ? -1 : 1;
      cil(g, set === 'viandante' || set === 'oracolo' ? stoffa : MAT('#2a2430'), 0.125, 0.115, 0.22, 0, -0.11, 0, 0.016, 10);   // pantalone rinforzato
      if (set === 'viandante') { for (let k = 0; k < 2; k++) anello(g, MAT('#5a3a22'), 0.128, 0.015, 0, -0.06 - k * 0.09, 0); }
      else { const pl = box(g, met, 0.2, 0.18, 0.08, s * 0.02, -0.07, 0.09, 0.014); pl.rotation.x = -0.15; box(g, bordo, 0.21, 0.02, 0.085, s * 0.02, 0.02, 0.095); if (set === 'sentinella') box(g, met, 0.08, 0.16, 0.2, s * 0.13, -0.07, 0, 0.014); }
    });
    return gs;
  }
  const norm = v => v === null || v === undefined ? null : typeof v === 'number' ? (v < 0 ? null : { r: v, set: 'portatore' }) : v;
  function veste(av, equip) {
    if (!av || !av.parti) return { togli() { }, anima() { } };
    const gruppi = [];
    Object.keys(FORME).forEach(slot => {
      const e = norm(equip && equip[slot]); if (!e) return;
      const r = Math.max(0, Math.min(4, e.r | 0)), S = STILI[r];
      const f = e.k && FORME[slot][1][e.k] ? FORME[slot][1][e.k] : FORME[slot][0][SET.includes(e.set) ? e.set : 'portatore'];
      DOVE[slot](av).forEach(dove => {
        const g = new T.Group(); if (slot === 'mantello') g.position.set(0, 0.5, -0.24);
        dove.add(g); f(g, S, r); gruppi.push(g);
      });
    });
    // con l'armatura gonne e vestiti dell'editor spariscono e al loro posto ci sono i cosciali
    const ea = norm(equip && equip.armatura), gonne = ea ? av.parti.busto.children.filter(o => o.userData.gonna) : [];
    gonne.forEach(o => { o.userData.vis = o.visible; o.visible = false; });
    if (ea) gruppi.push(...cosciali(av, 'armatura', STILI[Math.max(0, Math.min(4, ea.r | 0))], ea.k ? 'sentinella' : ea.set || 'portatore', Math.max(0, Math.min(4, ea.r | 0))));
    // il casco copre i capelli e gli accessori della testa: i capelli si stringono un po', gli accessori si nascondono
    const conCasco = !!norm(equip && equip.casco), cap = conCasco ? av.testa.children.filter(c => c.name === 'capelli') : [];
    const acc = conCasco ? [...av.testa.children, ...cap.flatMap(c => c.children)].filter(o => o.userData.accessorio) : [];
    cap.forEach(c => { c.userData.sc = c.scale.x; c.scale.multiplyScalar(0.86); });
    acc.forEach(o => { o.userData.vis = o.visible; o.visible = false; });
    let t = 0;
    return {
      togli() { gruppi.forEach(g => g.parent && g.parent.remove(g)); gonne.forEach(o => { o.visible = o.userData.vis !== false; }); cap.forEach(c => c.scale.setScalar(c.userData.sc || 1)); acc.forEach(o => { o.visible = o.userData.vis !== false; }); },
      anima(dt) {   // aureole che girano, fiamme che tremano, nuclei che pulsano, stelle e code
        t += dt;
        gruppi.forEach(g => g.traverse(o => {
          const u = o.userData;
          if (u.gira) o.rotation.z += dt * 1.2;
          if (u.fiamma) o.scale.y = 1.3 + Math.sin(t * 14 + o.id) * 0.15;
          if (u.pulsa) o.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
          if (u.scintilla !== undefined) o.position.y = -0.14 + Math.sin(t * 6 + u.scintilla * 1.7) * 0.07;
          if (u.coda !== undefined) o.rotation.x = 0.2 + Math.sin(t * 3 + u.coda) * 0.12;
          if (u.bandiera) o.rotation.y = Math.sin(t * 2.5) * 0.15;
          if (u.velo) o.material.opacity = 0.35 + Math.sin(t * 2) * 0.12;
          if (u.fumo !== undefined) o.material.opacity = Math.max(0.05, 0.45 - u.fumo * 0.08 + Math.sin(t * 5 + u.fumo) * 0.08);
        }));
      }
    };
  }
  B.ArmatureCripta = { veste, STILI, SET, CATALOGO };
})();
