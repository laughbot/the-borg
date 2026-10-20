/* =====================================================================
   La Cripta del Re senza Luce: EQUIPAGGIAMENTO SULL'AVATAR
   Casco, armatura, guanti, scarpe e mantello si vedono addosso, con un aspetto
   diverso per ogni rarita' (0 comune ... 4 stellare).
   B3.ArmatureCripta.veste(av, equip) -> gruppo da togliere con .togli()
   equip = { casco: r, armatura: r, guanti: r, scarpe: r, mantello: r } (r = rarita', o null)
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, PI = Math.PI;

  // aspetto per rarita': metallo principale, rifinitura, gemma, bagliore
  const STILI = [
    { met: '#7a6a58', bordo: '#4e3f30', gemma: null, luce: 0 },                     // comune: cuoio e ferro grezzo
    { met: '#5f82b0', bordo: '#2f4f80', gemma: '#5b9cf0', luce: 0 },                // rara: acciaio blu
    { met: '#6a4a9a', bordo: '#c9a8ff', gemma: '#d08aff', luce: 0.35 },             // epica: viola con rune
    { met: '#c98f24', bordo: '#ffe08a', gemma: '#ff6a2a', luce: 0.45 },             // leggendaria: oro
    { met: '#3f9fca', bordo: '#bff7ff', gemma: '#7fe8ff', luce: 1.0, cristallo: 1 } // stellare: cristallo di cometa
  ];
  const MAT = (col, luce) => M(col, luce ? { emissive: new T.Color(col), emissiveIntensity: luce * 0.5 } : null);

  function gemma(g, S, x, y, z, r) {
    if (!S.gemma) return;
    g.add(mesh(new T.OctahedronGeometry(r || 0.045, 0), MAT(S.gemma, 0.9), { x, y, z, cast: false }));
  }

  /* ---------- casco ---------- */
  function casco(av, r) {
    const S = STILI[r], g = new T.Group(); av.testa.add(g);
    const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6);
    const cal = mesh(new T.SphereGeometry(0.5, 28, 18, 0, PI * 2, 0, PI * 0.5), met, { y: 0.1, l: 0.02 }); cal.scale.set(1.1, 1.02, 1.08); g.add(cal);
    // paranuca: copre la nuca e i lati sotto la calotta
    const nucaMat = new T.MeshToonMaterial({ color: new T.Color(S.met), side: T.DoubleSide, gradientMap: M('#fff').gradientMap, emissive: new T.Color(S.met), emissiveIntensity: S.cristallo ? 0.12 : 0 });
    const nuca = new T.Mesh(new T.CylinderGeometry(0.55, 0.53, 0.3, 28, 1, true, PI * 0.42, PI * 1.16), nucaMat); nuca.position.y = -0.04; nuca.scale.z = 1.06; nuca.castShadow = true; g.add(nuca);
    const anello = mesh(new T.TorusGeometry(0.5, 0.035, 8, 32), bordo, { y: 0.11 }); anello.rotation.x = PI / 2; anello.scale.set(1.1, 1.08, 1); g.add(anello);
    // protezione del naso e guance (dalla rara in su)
    if (r >= 1) [-1, 1].forEach(s => { const gu = mesh(new T.BoxGeometry(0.05, 0.22, 0.18), met, { x: s * 0.52, y: -0.02, z: 0.02, l: 0.012 }); g.add(gu); });   // paraorecchie (il viso resta libero)
    if (r === 0) g.add(mesh(new T.BoxGeometry(0.5, 0.04, 0.08), bordo, { y: 0.36, z: 0.3 }));                 // fascia di cuoio
    if (r === 1) { const cr = mesh(new T.BoxGeometry(0.05, 0.12, 0.7), bordo, { y: 0.55 }); g.add(cr); }      // cresta bassa
    if (r === 2) [-1, 1].forEach(s => { const al = mesh(new T.ConeGeometry(0.07, 0.4, 6), bordo, { x: s * 0.42, y: 0.42, z: -0.05 }); al.rotation.z = -s * 0.9; g.add(al); });   // ali
    if (r === 3) for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.32, pu = mesh(new T.ConeGeometry(0.05, 0.28, 5), bordo, { x: Math.sin(a) * 0.36, y: 0.6 - Math.abs(i - 2) * 0.06, z: Math.cos(a) * 0.2 }); pu.rotation.z = -a * 0.6; g.add(pu); }   // corona
    if (r === 4) { const al = new T.Mesh(new T.TorusGeometry(0.42, 0.025, 8, 40), MAT('#bff7ff', 1.2)); al.position.set(0, 0.8, -0.08); al.rotation.x = PI / 2 - 0.35; al.userData.gira = 1; g.add(al); }   // aureola
    gemma(g, S, 0, 0.36, 0.52, 0.06);
    return g;
  }

  /* ---------- armatura: corazza sul busto e spalline ---------- */
  function armatura(av, r) {
    const S = STILI[r], b = av.parti.busto, g = new T.Group(); b.add(g);
    const met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6);
    const cor = mesh(new T.CylinderGeometry(0.265, 0.285, 0.36, 20), met, { y: 0.3, l: 0.02 }); cor.scale.z = 0.86; g.add(cor);
    const cint = mesh(new T.CylinderGeometry(0.292, 0.292, 0.05, 20), bordo, { y: 0.12 }); cint.scale.z = 0.86; g.add(cint);
    const coll = mesh(new T.CylinderGeometry(0.2, 0.27, 0.06, 18), bordo, { y: 0.49 }); coll.scale.z = 0.86; g.add(coll);
    [-1, 1].forEach(s => {
      const sp = mesh(new T.SphereGeometry(0.13 + r * 0.012, 16, 10, 0, PI * 2, 0, PI * 0.55), met, { x: s * 0.3, y: 0.5, l: 0.018 }); sp.scale.set(1.1, 0.9, 1); g.add(sp);
      g.add(mesh(new T.TorusGeometry(0.13 + r * 0.012, 0.018, 6, 18), bordo, { x: s * 0.3, y: 0.5 }).rotateX(PI / 2));
      if (r >= 3) { const pu = mesh(new T.ConeGeometry(0.04, 0.16, 5), bordo, { x: s * 0.36, y: 0.64 }); pu.rotation.z = -s * 0.5; g.add(pu); }
    });
    if (r >= 1) { const fr = mesh(new T.BoxGeometry(0.04, 0.3, 0.02), bordo, { y: 0.3, z: 0.25 }); g.add(fr); }
    if (r >= 2) g.add(mesh(new T.TorusGeometry(0.075, 0.016, 6, 20), bordo, { y: 0.34, z: 0.248 }));
    gemma(g, S, 0, 0.34, 0.26, 0.05);
    if (S.cristallo) for (let i = 0; i < 3; i++) g.add(mesh(new T.OctahedronGeometry(0.035, 0), MAT('#bff7ff', 1.2), { x: -0.12 + i * 0.12, y: 0.2, z: 0.25, cast: false }));
    return g;
  }

  /* ---------- guanti: bracciale e mano rivestita, su tutte e due le braccia ---------- */
  function guanti(av, r) {
    const S = STILI[r], met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6), gs = [];
    [av.parti.bL, av.parti.bR].forEach(br => {
      const go = br.userData.go, g = new T.Group(); go.add(g); gs.push(g);
      g.add(mesh(new T.CylinderGeometry(0.08 + r * 0.004, 0.075, 0.1, 12), met, { y: -0.06, l: 0.014 }));
      g.add(mesh(new T.CylinderGeometry(0.084 + r * 0.004, 0.084 + r * 0.004, 0.02, 12), bordo, { y: -0.012 }));
      g.add(mesh(new T.SphereGeometry(0.076, 12, 10), met, { y: -0.14, l: 0.016 }));
      if (r >= 2) for (let i = 0; i < 3; i++) g.add(mesh(new T.ConeGeometry(0.014, 0.05, 4), bordo, { x: -0.03 + i * 0.03, y: -0.05, z: 0.08 }).rotateX(PI / 2));
      gemma(g, S, 0, -0.06, 0.085, 0.03);
    });
    return { togli: () => gs.forEach(g => g.parent && g.parent.remove(g)), lista: gs };
  }

  /* ---------- scarpe: schinieri sopra gli stivali ---------- */
  function scarpe(av, r) {
    const S = STILI[r], met = MAT(S.met, S.cristallo ? 0.25 : 0), bordo = MAT(S.bordo, S.luce * 0.6), gs = [];
    [av.parti.gL, av.parti.gR].forEach(gb => {
      const gin = gb.userData.gin, g = new T.Group(); gin.add(g); gs.push(g);
      g.add(mesh(new T.CylinderGeometry(0.112, 0.118, 0.17, 14), met, { y: -0.12, l: 0.016 }));
      const pu = mesh(new T.SphereGeometry(0.11, 14, 10), met, { y: -0.2, z: 0.08, l: 0.016 }); pu.scale.set(1.02, 0.66, 1.3); g.add(pu);
      g.add(mesh(new T.CylinderGeometry(0.122, 0.122, 0.03, 14), bordo, { y: -0.03 }));
      if (r >= 2) [-1, 1].forEach(s => { const al = mesh(new T.ConeGeometry(0.03, 0.14, 4), bordo, { x: s * 0.12, y: -0.08 }); al.rotation.z = -s * 1.1; g.add(al); });   // alette (doppio salto)
      if (r === 4) g.add(mesh(new T.TorusGeometry(0.15, 0.015, 6, 24), MAT('#bff7ff', 1.2), { y: -0.26, cast: false }).rotateX(PI / 2));   // anello di volo
      gemma(g, S, 0, -0.12, 0.12, 0.03);
    });
    return { togli: () => gs.forEach(g => g.parent && g.parent.remove(g)), lista: gs };
  }

  /* ---------- mantello: telo sulle spalle che scende dietro ---------- */
  function mantello(av, r) {
    const S = STILI[r], b = av.parti.busto, g = new T.Group(); g.position.set(0, 0.5, -0.24); b.add(g);
    const col = ['#6b4a2e', '#2f4f7a', '#4a2a6a', '#8a1f22', '#1b2a5a'][r], lun = 0.75 + r * 0.06;
    const geo = new T.CylinderGeometry(0.3, 0.42 + r * 0.02, lun, 20, 4, true, PI * 0.6, PI * 0.8);
    const mat = new T.MeshToonMaterial({ color: new T.Color(col), side: T.DoubleSide, gradientMap: M('#fff').gradientMap, emissive: new T.Color(S.cristallo ? '#3a5aa8' : '#000000'), emissiveIntensity: S.cristallo ? 0.5 : 0 });
    const telo = new T.Mesh(geo, mat); telo.position.y = -lun / 2 + 0.02; telo.castShadow = true; g.add(telo);
    const orlo = new T.Mesh(new T.CylinderGeometry(0.42 + r * 0.02, 0.42 + r * 0.02, 0.03, 20, 1, true, PI * 0.6, PI * 0.8), new T.MeshToonMaterial({ color: new T.Color(S.bordo), side: T.DoubleSide, gradientMap: M('#fff').gradientMap, emissive: new T.Color(S.bordo), emissiveIntensity: S.luce * 0.6 }));
    orlo.position.y = -lun + 0.03; g.add(orlo);
    g.add(mesh(new T.CylinderGeometry(0.06, 0.06, 0.04, 12), MAT(S.bordo, S.luce * 0.6), { x: 0, y: 0, z: 0.42 }).rotateX(PI / 2));   // fermaglio
    gemma(g, S, 0, 0, 0.45, 0.04);
    if (S.cristallo) for (let i = 0; i < 9; i++) { const a = PI * 0.6 + (i % 3 + 0.5) / 3 * PI * 0.8, y = -0.15 - Math.floor(i / 3) * 0.22, rr = 0.33 + (Math.floor(i / 3)) * 0.035; g.add(mesh(new T.OctahedronGeometry(0.022, 0), MAT('#ffffff', 1.5), { x: Math.sin(a) * rr * -1, y, z: Math.cos(a) * rr * -1, cast: false })); }   // stelle
    return g;
  }

  const PEZZI = { casco, armatura, guanti, scarpe, mantello };
  function veste(av, equip) {
    if (!av || !av.parti) return { togli() { } };
    const messi = [];
    Object.keys(PEZZI).forEach(k => { const r = equip && equip[k]; if (r === null || r === undefined || r < 0) return; messi.push(PEZZI[k](av, Math.max(0, Math.min(4, r | 0)))); });
    // con il casco i capelli si stringono un po', cosi' non bucano la calotta (e tornano come prima togliendolo)
    const cap = equip && equip.casco !== null && equip.casco !== undefined && equip.casco >= 0 ? av.testa.children.filter(c => c.name === 'capelli') : [];
    cap.forEach(c => { c.userData.sc = c.scale.x; c.scale.multiplyScalar(0.86); });
    return { togli() { messi.forEach(g => g.togli ? g.togli() : g.parent && g.parent.remove(g)); cap.forEach(c => { c.scale.setScalar(c.userData.sc || 1); }); }, gira(dt) { messi.forEach(g => (g.lista || [g]).forEach(x => x.traverse(o => { if (o.userData.gira) o.rotation.z += dt * 1.2; }))); } };
  }
  B.ArmatureCripta = { veste, STILI };
})();
